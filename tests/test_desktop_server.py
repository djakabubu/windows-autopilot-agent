import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import Mock

from desktop_server import APP_NAME, DesktopHTTPServer


class DesktopHTTPServerTests(unittest.TestCase):
    def setUp(self):
        self.bridge = Mock()
        self.bridge.start_task.return_value = {"ok": True}
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.ui_directory = Path(self.temp_dir.name)
        (self.ui_directory / "index.html").write_text(
            '<script type="module" src="/assets/index-test.js"></script>',
            encoding="utf-8",
        )
        self.server = DesktopHTTPServer(
            ("127.0.0.1", 0),
            self.bridge,
            self.ui_directory,
            managed=False,
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_health_endpoint_identifies_this_app(self):
        with urlopen(f"{self.url}/api/health", timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))

        self.assertEqual(response.status, 200)
        self.assertEqual(payload, {"ok": True, "app": APP_NAME})

    def test_root_serves_the_built_frontend(self):
        with urlopen(f"{self.url}/", timeout=2) as response:
            page = response.read().decode("utf-8")

        self.assertEqual(response.status, 200)
        self.assertIn("assets/index-test.js", page)

    def test_presence_endpoint_streams_server_sent_events(self):
        response = urlopen(f"{self.url}/api/presence", timeout=2)
        try:
            self.assertIn("text/event-stream", response.headers["Content-Type"])
            self.assertEqual(response.read(13), b": connected\n\n")
        finally:
            response.close()

    def test_non_local_host_is_rejected(self):
        request = Request(
            f"{self.url}/api/health",
            headers={"Host": "example.com"},
        )

        with self.assertRaises(HTTPError) as raised:
            urlopen(request, timeout=2)

        self.assertEqual(raised.exception.code, 400)

    def test_approval_settings_are_forwarded_to_the_bridge(self):
        self.bridge.set_approval_levels.return_value = {"ok": True}
        body = json.dumps({"levels": ["DANGEROUS"]}).encode("utf-8")
        request = Request(
            f"{self.url}/api/settings/approvals",
            data=body,
            headers={"Content-Type": "application/json", "Origin": self.url},
            method="POST",
        )

        with urlopen(request, timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))

        self.assertEqual(payload, {"ok": True})
        self.bridge.set_approval_levels.assert_called_once_with(["DANGEROUS"])

    def test_model_setting_is_forwarded_to_the_bridge(self):
        self.bridge.set_model.return_value = {"ok": True}
        body = json.dumps({"model": "openrouter/free"}).encode("utf-8")
        request = Request(
            f"{self.url}/api/settings/model",
            data=body,
            headers={"Content-Type": "application/json", "Origin": self.url},
            method="POST",
        )

        with urlopen(request, timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))

        self.assertEqual(payload, {"ok": True})
        self.bridge.set_model.assert_called_once_with("openrouter/free")

    def test_task_request_is_forwarded_to_the_approval_gated_bridge(self):
        body = json.dumps({"prompt": "Check disk space"}).encode("utf-8")
        request = Request(
            f"{self.url}/api/task",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Origin": self.url,
            },
            method="POST",
        )

        with urlopen(request, timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))

        self.assertEqual(payload, {"ok": True})
        self.bridge.start_task.assert_called_once_with("Check disk space")


if __name__ == "__main__":
    unittest.main()
