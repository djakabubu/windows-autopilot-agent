"""Launch the local Python server and an Edge app window."""

from __future__ import annotations

import ctypes
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
import traceback
import urllib.error
import urllib.request
from typing import Optional

from desktop_server import APP_NAME, HOST, PORT, run_server, write_error_log

HEALTH_URL = f"http://{HOST}:{PORT}/api/health"
APP_URL = f"http://{HOST}:{PORT}/"
SERVER_START_TIMEOUT = 20
MANAGED_ENV = "AGENT_DESKTOP_MANAGED"


def _show_error(message: str) -> None:
    ctypes.windll.user32.MessageBoxW(
        None, message, "Assistente Windows", 0x10 | 0x1000
    )


def _install_exception_hooks() -> None:
    def handle_exception(
        exc_type: type[BaseException], exc: BaseException, tb: object
    ) -> None:
        details = "".join(traceback.format_exception(exc_type, exc, tb))
        write_error_log("Uncaught exception", details)

    sys.excepthook = handle_exception

    if hasattr(threading, "excepthook"):
        def handle_thread_exception(args: threading.ExceptHookArgs) -> None:
            details = "".join(
                traceback.format_exception(args.exc_type, args.exc_value, args.exc_traceback)
            )
            write_error_log(f"Uncaught exception in {args.thread.name}", details)

        threading.excepthook = handle_thread_exception


def _run_frontend_build(app_dir: Path) -> bool:
    ui_dir = app_dir / "ui"
    dist_index = ui_dir / "dist" / "index.html"
    if not _frontend_needs_build(app_dir, dist_index):
        return True

    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        write_error_log("Frontend build failed", "Node.js/npm is not installed or not on PATH.")
        _show_error(
            "La build dell'interfaccia non esiste e npm non è disponibile.\n"
            "Installa Node.js 20.19+ oppure 22.12+ e riapri l'app.\n\n"
            f"Log: {desktop_server_log_path()}"
        )
        return False

    commands: list[list[str]] = []
    if not (ui_dir / "node_modules" / ".bin" / "vite.cmd").is_file():
        commands.append([npm, "ci"])
    commands.append([npm, "run", "build"])

    for command in commands:
        try:
            result = subprocess.run(
                subprocess.list2cmdline(command),
                cwd=ui_dir,
                capture_output=True,
                text=True,
                check=False,
                shell=True,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except OSError:
            write_error_log("Frontend build failed", traceback.format_exc())
            _show_error(
                "Non è stato possibile avviare npm.\n\n"
                f"Log: {desktop_server_log_path()}"
            )
            return False
        if result.returncode:
            write_error_log(
                f"Frontend build failed (exit code {result.returncode})",
                f"Command: {subprocess.list2cmdline(command)}\n\n"
                f"{result.stdout}\n{result.stderr}",
            )
            _show_error(
                "La build dell'interfaccia non è riuscita.\n"
                f"Controlla il log: {desktop_server_log_path()}"
            )
            return False

    if not dist_index.is_file():
        write_error_log(
            "Frontend build failed",
            f"The build command completed but did not create {dist_index}.",
        )
        _show_error(
            "La build non ha generato i file dell'interfaccia.\n\n"
            f"Log: {desktop_server_log_path()}"
        )
        return False
    return True


def _frontend_needs_build(app_dir: Path, dist_index: Path) -> bool:
    if not dist_index.is_file():
        return True
    sources = [
        app_dir / "mascot-organic-demo.svg",
        app_dir / "ui" / "index.html",
        app_dir / "ui" / "package.json",
        app_dir / "ui" / "package-lock.json",
    ]
    sources.extend(path for path in (app_dir / "ui" / "src").rglob("*") if path.is_file())
    build_time = dist_index.stat().st_mtime
    return any(path.stat().st_mtime > build_time for path in sources if path.is_file())


def desktop_server_log_path() -> Path:
    from desktop_server import ERROR_LOG

    return ERROR_LOG


def _health_check(timeout: float = 1.0) -> bool:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, dict):
                return False
            return (
                response.status == 200
                and payload.get("ok") is True
                and payload.get("app") == APP_NAME
            )
    except (OSError, ValueError, urllib.error.URLError):
        return False


def _start_server(app_dir: Path) -> subprocess.Popen[bytes]:
    environment = os.environ.copy()
    environment[MANAGED_ENV] = "1"
    flags = (
        getattr(subprocess, "DETACHED_PROCESS", 0)
        | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        | getattr(subprocess, "CREATE_NO_WINDOW", 0)
    )
    return subprocess.Popen(
        [sys.executable, str(Path(__file__).resolve()), "--server"],
        cwd=app_dir,
        env=environment,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
        creationflags=flags,
    )


def _wait_for_server(server_process: subprocess.Popen[bytes]) -> bool:
    deadline = time.monotonic() + SERVER_START_TIMEOUT
    while time.monotonic() < deadline:
        if _health_check():
            return True
        if server_process.poll() is not None:
            return False
        time.sleep(0.25)
    return False


def _find_edge() -> Optional[Path]:
    roots = [
        os.environ.get("ProgramFiles(x86)"),
        os.environ.get("ProgramFiles"),
        os.environ.get("LOCALAPPDATA"),
    ]
    for root in roots:
        if root:
            candidate = Path(root) / "Microsoft" / "Edge" / "Application" / "msedge.exe"
            if candidate.is_file():
                return candidate
    return None


def _open_app_window() -> bool:
    edge = _find_edge()
    if edge:
        profile_dir = (
            Path(os.environ.get("LOCALAPPDATA", str(Path.home())))
            / "WindowsAutopilotAgent"
            / "EdgeProfile"
        )
        try:
            profile_dir.mkdir(parents=True, exist_ok=True)
            flags = (
                getattr(subprocess, "DETACHED_PROCESS", 0)
                | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
                | getattr(subprocess, "CREATE_NO_WINDOW", 0)
            )
            subprocess.Popen(
                [
                    str(edge),
                    f"--app={APP_URL}",
                    f"--user-data-dir={profile_dir}",
                    "--window-size=1100,760",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                close_fds=True,
                creationflags=flags,
            )
            return True
        except OSError:
            write_error_log("Could not start Edge app mode", traceback.format_exc())

    try:
        os.startfile(APP_URL)  # type: ignore[attr-defined]
        return True
    except OSError:
        write_error_log("Could not open the desktop window", traceback.format_exc())
        _show_error(
            "Il server locale è attivo, ma non è stato possibile aprire il browser.\n\n"
            f"Log: {desktop_server_log_path()}"
        )
        return False


def launch() -> None:
    if os.name != "nt":
        _show_error("L'interfaccia desktop è supportata solo su Windows.")
        return

    app_dir = Path(__file__).resolve().parent
    if not _run_frontend_build(app_dir):
        return

    if not _health_check():
        try:
            server_process = _start_server(app_dir)
        except OSError:
            write_error_log("Could not start the local server", traceback.format_exc())
            _show_error(
                "Non è stato possibile avviare il server locale.\n\n"
                f"Log: {desktop_server_log_path()}"
            )
            return

        if not _wait_for_server(server_process):
            if server_process.poll() is None:
                problem = (
                    "Il server locale non ha risposto entro il tempo previsto. "
                    "La porta 43127 potrebbe essere già in uso."
                )
            else:
                problem = (
                    "Il server locale si è chiuso durante l'avvio. "
                    "La porta 43127 potrebbe essere già in uso."
                )
            write_error_log(
                "Local server failed to start",
                (
                    f"Child process exited with code {server_process.poll()}."
                    if server_process.poll() is not None
                    else f"Could not reach {HEALTH_URL} within {SERVER_START_TIMEOUT} seconds."
                ),
            )
            _show_error(
                f"{problem}\nChiudi l'altra applicazione o controlla il log.\n\n"
                f"Log: {desktop_server_log_path()}"
            )
            return

    _open_app_window()


def main() -> None:
    _install_exception_hooks()
    if len(sys.argv) > 1 and sys.argv[1] == "--server":
        run_server(managed=os.environ.get(MANAGED_ENV) == "1")
    else:
        launch()


if __name__ == "__main__":
    main()
