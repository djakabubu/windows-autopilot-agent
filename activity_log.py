"""Write bounded, redacted JSONL records for desktop activity."""

from __future__ import annotations

import json
import os
from pathlib import Path
import threading
from typing import Any

LOG_DIRECTORY = Path(
    os.environ.get(
        "LOCALAPPDATA",
        str(Path.home() / "AppData" / "Local"),
    )
) / "WindowsAutopilotAgent"
ACTIVITY_LOG = LOG_DIRECTORY / "activity.log"
MAX_LOG_BYTES = 5 * 1024 * 1024
_LOG_LOCK = threading.Lock()


def _redact(value: Any) -> Any:
    if isinstance(value, str):
        from windows_autopilot import redact_secrets

        return redact_secrets(value)
    if isinstance(value, dict):
        return {key: _redact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


def write_activity_log(record: dict[str, Any]) -> None:
    """Append one redacted JSON record; retain at most one 5 MiB backup."""
    try:
        LOG_DIRECTORY.mkdir(parents=True, exist_ok=True)
        line = json.dumps(_redact(record), ensure_ascii=False) + "\n"
        with _LOG_LOCK:
            if ACTIVITY_LOG.exists() and ACTIVITY_LOG.stat().st_size >= MAX_LOG_BYTES:
                backup = ACTIVITY_LOG.with_suffix(ACTIVITY_LOG.suffix + ".1")
                if backup.exists():
                    backup.unlink()
                ACTIVITY_LOG.replace(backup)
            with ACTIVITY_LOG.open("a", encoding="utf-8") as log_file:
                log_file.write(line)
    except Exception:
        pass
