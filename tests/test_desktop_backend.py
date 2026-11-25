import json
import time
import unittest
from unittest.mock import patch

import windows_autopilot as engine
from desktop_backend import DesktopBridge


class DesktopBridgeTests(unittest.TestCase):
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
