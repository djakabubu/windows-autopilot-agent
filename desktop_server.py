"""Loopback HTTP server for the React desktop UI and Python agent bridge."""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import select
import socket
import sys
import threading
import time
import traceback
import sys
from typing import Any, Optional
from urllib.parse import unquote, urlsplit

APP_NAME = "windows-autopilot-agent"
HOST = "127.0.0.1"
PORT = 43127
PRESENCE_GRACE_SECONDS = 5
STARTUP_GRACE_SECONDS = 30
SSE_PING_SECONDS = 15
MAX_REQUEST_BYTES = 1024 * 1024
ERROR_DIRECTORY = Path(
    os.environ.get(
        "LOCALAPPDATA",
        str(Path.home() / "AppData" / "Local"),
    )
) / "WindowsAutopilotAgent"
ERROR_LOG = ERROR_DIRECTORY / "error.log"


def write_error_log(title: str, details: str) -> None:
    try:
        ERROR_DIRECTORY.mkdir(parents=True, exist_ok=True)
        with ERROR_LOG.open("a", encoding="utf-8") as log_file:
            log_file.write(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] {title}\n")
            log_file.write(details.rstrip() + "\n")
    except Exception:
        try:
            if sys.__stderr__:
                sys.__stderr__.write(f"Could not write {ERROR_LOG}\n{title}\n{details}\n")
        except Exception:
            pass


class DesktopHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def __init__(
        self,
        server_address: tuple[str, int],
        bridge: Any,
        ui_directory: Path,
        managed: bool,
    ) -> None:
        self.bridge = bridge
        self.ui_directory = ui_directory.resolve()
        self.managed = managed
        self.stopping = threading.Event()
        self._presence_lock = threading.Lock()
        self._presence_count = 0
        self._shutdown_timer: Optional[threading.Timer] = None
        super().__init__(server_address, DesktopRequestHandler)

    def add_presence(self) -> None:
        with self._presence_lock:
            self._presence_count += 1
            self._cancel_shutdown_timer()

    def remove_presence(self) -> None:
        with self._presence_lock:
            self._presence_count = max(0, self._presence_count - 1)
            if self.managed and self._presence_count == 0:
                self._schedule_shutdown(PRESENCE_GRACE_SECONDS)

    def request_shutdown(self) -> None:
        with self._presence_lock:
            if self.managed and self._presence_count <= 1:
                self._schedule_shutdown(2)

    def _cancel_shutdown_timer(self) -> None:
        if self._shutdown_timer:
            self._shutdown_timer.cancel()
            self._shutdown_timer = None

    def _schedule_shutdown(self, delay: int) -> None:
        self._cancel_shutdown_timer()
        timer = threading.Timer(delay, self._shutdown_if_idle)
        timer.daemon = True
        self._shutdown_timer = timer
        timer.start()

    def _shutdown_if_idle(self) -> None:
        with self._presence_lock:
            self._shutdown_timer = None
            if not self.managed or self._presence_count:
                return
            self.stopping.set()
        self.shutdown()

    def handle_error(self, request: Any, client_address: Any) -> None:
        write_error_log(
            f"HTTP request handler failed for {client_address}",
            traceback.format_exc(),
        )


class DesktopRequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server: DesktopHTTPServer

    def do_GET(self) -> None:
        if not self._has_local_host():
            self._send_json(400, {"ok": False, "error": "Host non locale."})
            return

        route = urlsplit(self.path).path
        if route == "/api/health":
            self._send_json(200, {"ok": True, "app": APP_NAME})
        elif route == "/api/status":
            self._send_json(200, self.server.bridge.get_status())
        elif route == "/api/events":
            self._send_json(200, self.server.bridge.poll_events())
        elif route == "/api/presence":
            self._stream_presence()
        elif route.startswith("/api/"):
            self._send_json(404, {"ok": False, "error": "Endpoint non trovato."})
        else:
            self._serve_static(route)

    def do_POST(self) -> None:
        if not self._has_local_host():
            self._send_json(400, {"ok": False, "error": "Host non locale."})
            return
        if not self._has_local_origin():
            self._send_json(403, {"ok": False, "error": "Origine non consentita."})
            return

        route = urlsplit(self.path).path
        if route == "/api/shutdown":
            self.server.request_shutdown()
            self._send_json(200, {"ok": True})
            return

        try:
            payload = self._read_json()
            if route == "/api/task":
                result = self.server.bridge.start_task(payload.get("prompt", ""))
            elif route == "/api/approval":
                result = self.server.bridge.respond_to_approval(
                    payload.get("approvalId", ""),
                    payload.get("approved", False),
                )
            elif route == "/api/conversation":
                result = self.server.bridge.new_conversation()
            else:
                self._send_json(404, {"ok": False, "error": "Endpoint non trovato."})
                return
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})
            return

        self._send_json(200, result)

    def log_message(self, format_string: str, *args: Any) -> None:
        return

    def _has_local_host(self) -> bool:
        host = self.headers.get("Host", "").strip().lower()
        port = self.server.server_address[1]
        return host in {f"{HOST}:{port}", f"localhost:{port}"}

    def _has_local_origin(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            return True
        try:
            parsed = urlsplit(origin)
            return (
                parsed.scheme == "http"
                and parsed.hostname in {HOST, "localhost"}
                and parsed.port == self.server.server_address[1]
            )
        except ValueError:
            return False

    def _read_json(self) -> dict[str, Any]:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ValueError("Content-Length non valido.") from exc
        if content_length < 0 or content_length > MAX_REQUEST_BYTES:
            raise ValueError("Richiesta troppo grande.")
        raw_body = self.rfile.read(content_length)
        payload = json.loads(raw_body.decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("Il corpo della richiesta deve essere un oggetto JSON.")
        return payload

    def _serve_static(self, route: str) -> None:
        requested = unquote(route).lstrip("/")
        target = (self.server.ui_directory / requested).resolve()
        if not target.is_relative_to(self.server.ui_directory) or not target.is_file():
            if requested in {"", "index.html"}:
                target = self.server.ui_directory / "index.html"
            else:
                self._send_json(404, {"ok": False, "error": "File non trovato."})
                return
        if not target.is_file():
            self._send_json(404, {"ok": False, "error": "Build dell'interfaccia mancante."})
            return

        body = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self._send_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def _stream_presence(self) -> None:
        self.server.add_presence()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self._send_security_headers()
        self.end_headers()
        self.close_connection = True

        next_ping = time.monotonic() + SSE_PING_SECONDS
        try:
            self.wfile.write(b": connected\n\n")
            self.wfile.flush()
            while not self.server.stopping.is_set():
                timeout = max(0, min(1, next_ping - time.monotonic()))
                readable, _, _ = select.select([self.connection], [], [], timeout)
                if readable:
                    try:
                        if not self.connection.recv(1, socket.MSG_PEEK):
                            break
                    except OSError:
                        break
                if time.monotonic() >= next_ping:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    next_ping = time.monotonic() + SSE_PING_SECONDS
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            self.server.remove_presence()

    def _send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def _send_security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; connect-src 'self'; object-src 'none'; "
            "base-uri 'none'; frame-ancestors 'none'",
        )


def run_server(managed: bool) -> None:
    from desktop_backend import DesktopBridge

    app_dir = Path(__file__).resolve().parent
    server = DesktopHTTPServer(
        (HOST, PORT),
        DesktopBridge(),
        app_dir / "ui" / "dist",
        managed,
    )
    if managed:
        server._schedule_shutdown(STARTUP_GRACE_SECONDS)
    try:
        server.serve_forever(poll_interval=0.25)
    except OSError:
        write_error_log("Local server failed", traceback.format_exc())
        raise
    finally:
        server.stopping.set()
        server.server_close()
        server.bridge.shutdown()
