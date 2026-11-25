"""Launch the React desktop interface without a console window."""

from __future__ import annotations

import os
from pathlib import Path

import webview

from desktop_backend import DesktopBridge


def main() -> None:
    if os.name != "nt":
        raise SystemExit("The Windows desktop interface is supported on Windows only.")

    app_dir = Path(__file__).resolve().parent
    index_file = app_dir / "ui" / "dist" / "index.html"
    if not index_file.is_file():
        raise SystemExit(
            "React UI not built. Run `npm --prefix ui install` and "
            "`npm --prefix ui run build` first."
        )

    bridge = DesktopBridge()
    webview.create_window(
        "Assistente Windows",
        index_file.as_uri(),
        js_api=bridge,
        min_size=(900, 620),
    )
    try:
        webview.start(
            debug=os.getenv("AGENT_GUI_DEBUG", "").lower() in {"1", "true", "yes"}
        )
    finally:
        bridge.shutdown()


if __name__ == "__main__":
    main()
