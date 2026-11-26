import json
import threading
import time
import unittest
from unittest.mock import patch

import windows_autopilot as agent


class TaskEventTests(unittest.TestCase):
    def test_safe_task_emits_assistant_and_completion_events(self):
        messages = [{"role": "system", "content": "system"}]
        response = json.dumps({"message": "All set.", "action": None})

        with patch.object(agent, "call_openrouter", return_value=response):
            events = list(agent.iter_task_events(
                "Check the date",
                messages,
                "test-model",
                2,
                stream=False,
            ))

        self.assertEqual(
            [event["type"] for event in events],
            ["status", "assistant", "complete"],
        )
        self.assertEqual(events[1]["message"], "All set.")
        self.assertEqual(messages[-1]["role"], "assistant")

    def test_openrouter_stream_can_be_cancelled_while_waiting_for_data(self):
        class InterruptibleSocket:
            def __init__(self):
                self.closed = threading.Event()

            def shutdown(self, _how):
                self.closed.set()

        class BlockingResponse:
            def __init__(self):
                self.waiting = threading.Event()
                self.socket = InterruptibleSocket()
                self.fp = type("FilePointer", (), {
                    "raw": type("RawSocket", (), {"_sock": self.socket})(),
                })()

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def __iter__(self):
                return self

            def __next__(self):
                self.waiting.set()
                self.socket.closed.wait()
                raise OSError("socket closed")

        cancellation = threading.Event()
        outcome = {}
        response = BlockingResponse()

        def run_request():
            try:
                agent.call_openrouter(
                    [], "test-model", cancel_event=cancellation, show_progress=False,
                )
            except Exception as exc:
                outcome["error"] = exc

        with patch.object(agent, "OPENROUTER_API_KEY", "test-key"):
            with patch.object(agent.urllib.request, "urlopen", return_value=response):
                worker = threading.Thread(target=run_request)
                worker.start()
                self.assertTrue(response.waiting.wait(2))
                cancellation.set()
                worker.join(2)

        self.assertFalse(worker.is_alive())
        self.assertIsInstance(outcome.get("error"), agent.TaskCancelled)

    def test_selected_safe_level_requires_approval(self):
        messages = [{"role": "system", "content": "system"}]
        response = json.dumps({
            "message": "I can inspect that.",
            "action": {"type": "shell", "command": "Get-Date", "reason": "Read the date"},
        })
        task = agent.iter_task_events(
            "Check the date", messages, "test-model", 2, stream=False,
            approval_levels={"SAFE", "CAUTION", "DANGEROUS"},
        )

        with patch.object(agent, "call_openrouter", return_value=response):
            with patch.object(agent, "assess_command", return_value=agent.RiskAssessment("SAFE", [])):
                event = next(task)
                self.assertEqual(event["type"], "status")
                self.assertEqual(next(task)["type"], "assistant")
                self.assertEqual(next(task)["type"], "classification")
                self.assertEqual(next(task)["type"], "approval_required")

    def test_unselected_dangerous_level_runs_without_approval(self):
        messages = [{"role": "system", "content": "system"}]
        responses = [
            json.dumps({
                "message": "I can do that.",
                "action": {"type": "shell", "command": "Remove-Item test.tmp", "reason": "Remove a file"},
            }),
            json.dumps({"message": "Done.", "action": None}),
        ]
        task = agent.iter_task_events(
            "Remove the test file", messages, "test-model", 2, stream=False,
            approval_levels={"SAFE", "CAUTION"},
        )

        with patch.object(agent, "call_openrouter", side_effect=responses):
            with patch.object(
                agent, "assess_command",
                return_value=agent.RiskAssessment("DANGEROUS", ["Possible data loss"]),
            ):
                with patch.object(agent, "execute_shell_command", return_value=("", "", 0, 0.1)) as execute:
                    events = list(task)

        self.assertNotIn("approval_required", [event["type"] for event in events])
        execute.assert_called_once()

    def test_rejected_command_emits_result_without_running_shell(self):
        messages = [{"role": "system", "content": "system"}]
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
        emitted = []
        task = agent.iter_task_events(
            "Empty the recycle bin",
            messages,
            "test-model",
            2,
            stream=False,
        )

        with patch.object(agent, "call_openrouter", side_effect=responses):
            with patch.object(
                agent,
                "assess_command",
                return_value=agent.RiskAssessment("CAUTION", ["Deletes files"]),
            ):
                with patch.object(agent, "execute_shell_command") as execute:
                    event = next(task)
                    while True:
                        emitted.append(event)
                        decision = "no" if event["type"] == "approval_required" else None
                        try:
                            event = task.send(decision)
                        except StopIteration:
                            break
                    execute.assert_not_called()

        rejected = [event for event in emitted if event["type"] == "command_result"]
        self.assertEqual(len(rejected), 1)
        self.assertEqual(rejected[0]["code"], 125)
        self.assertEqual(rejected[0]["stderr"], "Command rejected by the user.")


if __name__ == "__main__":
    unittest.main()
