"""Local desktop bridge between the React UI and the Windows agent engine."""

from __future__ import annotations

import os
import queue
import threading
import uuid
from typing import Any, Optional

import windows_autopilot as engine


class DesktopBridge:
    """Expose a small, approval-gated API to the embedded React application."""

    def __init__(self) -> None:
        self._events: queue.Queue[dict[str, Any]] = queue.Queue()
        self._lock = threading.Lock()
        self._busy = False
        self._pending_approval: Optional[dict[str, Any]] = None
        self._messages = [{"role": "system", "content": engine.build_system_prompt()}]
        self._model = engine.DEFAULT_MODEL

    def get_status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "configured": bool(engine.OPENROUTER_API_KEY),
                "busy": self._busy,
                "model": self._model,
            }

    def poll_events(self) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        while True:
            try:
                result.append(self._events.get_nowait())
            except queue.Empty:
                return result

    def start_task(self, prompt: str) -> dict[str, Any]:
        request = str(prompt or "").strip()
        if not request:
            return {"ok": False, "error": "Scrivi una richiesta prima di inviarla."}
        if not engine.OPENROUTER_API_KEY:
            return {
                "ok": False,
                "error": (
                    "OPENROUTER_API_KEY non è configurata. Impostala nelle "
                    "variabili d'ambiente di Windows e riavvia l'app."
                ),
            }

        with self._lock:
            if self._busy:
                return {"ok": False, "error": "È già in corso una richiesta."}
            self._busy = True
            worker = threading.Thread(
                target=self._run_task,
                args=(request,),
                name="windows-agent-task",
                daemon=True,
            )
            worker.start()

        engine.add_to_history(request)
        return {"ok": True}

    def respond_to_approval(self, approval_id: str, approved: bool) -> dict[str, Any]:
        with self._lock:
            pending = self._pending_approval
            if not pending or pending["id"] != approval_id:
                return {"ok": False, "error": "La richiesta di conferma non è più attiva."}
            if pending["event"].is_set():
                return {"ok": False, "error": "La decisione per questo comando è già stata inviata."}
            pending["approved"] = bool(approved)
            pending["event"].set()
        return {"ok": True}

    def new_conversation(self) -> dict[str, Any]:
        with self._lock:
            if self._busy:
                return {"ok": False, "error": "Attendi la fine dell'attività in corso."}
            self._messages = [
                {"role": "system", "content": engine.build_system_prompt()}
            ]
        return {"ok": True}

    def shutdown(self) -> None:
        with self._lock:
            if self._pending_approval:
                self._pending_approval["approved"] = False
                self._pending_approval["event"].set()

    def _emit(self, event: dict[str, Any]) -> None:
        self._events.put(event)

    def _run_task(self, prompt: str) -> None:
        task = engine.iter_task_events(
            prompt,
            self._messages,
            self._model,
            engine.MAX_STEPS,
            stream=False,
            show_progress=False,
            hidden_window=True,
        )
        try:
            event = next(task)
            while True:
                decision: Optional[str] = None
                event_type = event["type"]

                if event_type == "approval_required":
                    approval_id = uuid.uuid4().hex
                    approval_event = threading.Event()
                    pending = {
                        "id": approval_id,
                        "event": approval_event,
                        "approved": False,
                    }
                    with self._lock:
                        self._pending_approval = pending
                    self._emit({
                        "type": "approval",
                        "id": approval_id,
                        "command": event["command"],
                        "reason": event["reason"],
                        "risk": event["level"],
                        "reasons": event["reasons"],
                    })
                    approval_event.wait()
                    decision = "yes" if pending["approved"] else "no"
                    with self._lock:
                        if self._pending_approval is pending:
                            self._pending_approval = None
                elif event_type == "status":
                    self._emit(event)
                elif event_type == "assistant":
                    self._emit({"type": "message", "text": event["message"]})
                elif event_type == "command_result":
                    self._emit({"type": "command_result", **event})
                elif event_type == "step_limit":
                    self._emit({
                        "type": "notice",
                        "text": (
                            f"Raggiunto il limite di {event['max_steps']} passaggi. "
                            "L'attività è stata fermata in modo sicuro."
                        ),
                    })
                    decision = "stop"
                elif event_type == "error":
                    self._emit({"type": "error", "text": event["message"]})
                elif event_type == "complete":
                    self._emit({"type": "status", "status": "success"})
                elif event_type == "stopped":
                    self._emit({"type": "status", "status": "idle"})

                event = task.send(decision)
        except StopIteration as result:
            self._messages = result.value
        except Exception as exc:
            self._emit({
                "type": "error",
                "text": f"Errore imprevisto del backend: {exc}",
            })
        finally:
            with self._lock:
                if self._pending_approval:
                    self._pending_approval["approved"] = False
                    self._pending_approval["event"].set()
                    self._pending_approval = None
                self._busy = False
            self._emit({"type": "task_finished"})
