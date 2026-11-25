import json
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
