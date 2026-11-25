import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import activity_log


class ActivityLogTests(unittest.TestCase):
    def test_records_are_json_lines_and_redact_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            log_path = Path(directory) / "activity.log"
            with patch.object(activity_log, "LOG_DIRECTORY", Path(directory)):
                with patch.object(activity_log, "ACTIVITY_LOG", log_path):
                    activity_log.write_activity_log({
                        "event": "command_result",
                        "command": "Write-Output safe",
                        "stdout": "api_key=supersecret",
                    })

            record = json.loads(log_path.read_text(encoding="utf-8"))

        self.assertEqual(record["event"], "command_result")
        self.assertEqual(record["command"], "Write-Output safe")
        self.assertNotIn("supersecret", record["stdout"])


if __name__ == "__main__":
    unittest.main()
