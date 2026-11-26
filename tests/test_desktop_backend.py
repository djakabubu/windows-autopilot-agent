import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import windows_autopilot as engine
from desktop_backend import DesktopBridge


class DesktopBridgeTests(unittest.TestCase):
    def test_approval_levels_are_validated_and_reported(self):
        bridge = DesktopBridge()

        self.assertEqual(
            bridge.get_status()["approval_levels"],
            ["CAUTION", "DANGEROUS", "SAFE"],
        )
        self.assertFalse(bridge.set_approval_levels(["UNKNOWN"])["ok"])
        self.assertFalse(bridge.set_approval_levels([[]])["ok"])
        self.assertEqual(
            bridge.set_approval_levels(["DANGEROUS"]),
            {"ok": True},
        )
        self.assertEqual(bridge.get_status()["approval_levels"], ["DANGEROUS"])

    def test_model_is_validated_saved_and_cannot_change_while_busy(self):
        bridge = DesktopBridge()
        with patch("desktop_backend.save_model", return_value=True) as save_model:
            self.assertFalse(bridge.set_model("  ")["ok"])
            self.assertFalse(bridge.set_model("x" * 201)["ok"])
            self.assertEqual(bridge.set_model("  openrouter/free  "), {"ok": True})
            save_model.assert_called_once_with("openrouter/free")
            self.assertEqual(bridge.get_status()["model"], "openrouter/free")

            bridge._busy = True
            self.assertFalse(bridge.set_model("openrouter/auto")["ok"])
            self.assertEqual(bridge.get_status()["model"], "openrouter/free")
            save_model.assert_called_once_with("openrouter/free")

    def test_saved_model_is_loaded_on_startup(self):
        with tempfile.TemporaryDirectory() as directory:
            settings_path = Path(directory) / "settings.json"
            with patch("desktop_backend.MODEL_SETTINGS_FILE", settings_path):
                bridge = DesktopBridge()
                self.assertEqual(bridge.set_model("openrouter/auto"), {"ok": True})
                reloaded_bridge = DesktopBridge()
        self.assertEqual(reloaded_bridge.get_status()["model"], "openrouter/auto")

    def test_cancel_task_signals_worker_and_rejects_pending_approval(self):
        bridge = DesktopBridge()
        approval_event = threading.Event()
        bridge._busy = True
        bridge._cancel_event = threading.Event()
        bridge._pending_approval = {
            "id": "approval-id",
            "command": "Remove-Item test.txt",
            "approved": True,
            "event": approval_event,
        }

        self.assertEqual(bridge.cancel_task(), {"ok": True})
        self.assertTrue(bridge._cancel_event.is_set())
        self.assertTrue(approval_event.is_set())
        self.assertFalse(bridge._pending_approval["approved"])

        bridge._busy = False
        bridge._cancel_event = None
        self.assertFalse(bridge.cancel_task()["ok"])

    def test_rejecting_approval_keeps_shell_unexecuted(self):
        responses = [
            json.dumps({
                "message": "I can clear that.",
                "action": {
                    "type": "shell",
                    "command": "Clear-RecycleBin -Force",
                    "reason": "Empty the recycle bin",
                },
            }),
            json.dumps({"message": "Nothing was changed.", "action": None}),
        ]
        bridge = DesktopBridge()

        with patch.object(engine, "OPENROUTER_API_KEY", "test-key"):
            with patch.object(engine, "call_openrouter", side_effect=responses):
                with patch.object(
                    engine,
                    "assess_command",
                    return_value=engine.RiskAssessment("CAUTION", ["Deletes files"]),
                ):
                    with patch.object(engine, "execute_shell_command") as execute:
                        with patch.object(engine, "add_to_history"):
                            result = bridge.start_task("Empty the recycle bin")
                        self.assertTrue(result["ok"])

                        events = self._wait_for_event(bridge, "approval")
                        approval = next(event for event in events if event["type"] == "approval")
                        self.assertEqual(approval["command"], "Clear-RecycleBin -Force")
                        self.assertEqual(bridge.respond_to_approval(approval["id"], False), {"ok": True})
                        self.assertFalse(bridge.respond_to_approval(approval["id"], True)["ok"])

                        events.extend(self._wait_for_event(bridge, "task_finished"))

                        execute.assert_not_called()
                        rejection = next(
                            event for event in events
                            if event["type"] == "command_result"
                        )
                        self.assertEqual(rejection["code"], 125)
                        self.assertFalse(bridge.get_status()["busy"])

    @staticmethod
    def _wait_for_event(bridge, event_type):
        deadline = time.monotonic() + 5
        collected = []
        while time.monotonic() < deadline:
            collected.extend(bridge.poll_events())
            if any(event["type"] == event_type for event in collected):
                return collected
            time.sleep(0.01)
        raise AssertionError(f"Timed out waiting for {event_type!r}: {collected!r}")


if __name__ == "__main__":
    unittest.main()
