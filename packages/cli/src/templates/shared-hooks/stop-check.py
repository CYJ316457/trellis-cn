#!/usr/bin/env python3
"""Trellis stop guard hook.

Blocks Stop when the active task is still unfinished, so an interrupted
session can continue on the next prompt instead of ending early.
"""
from __future__ import annotations

import io as _io
import json
import os
import sys
from pathlib import Path
from typing import Optional

if sys.platform.startswith("win"):
    for _stream_name in ("stdin", "stdout", "stderr"):
        _stream = getattr(sys, _stream_name, None)
        if _stream is None:
            continue
        if hasattr(_stream, "reconfigure"):
            try:
                _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
            except Exception:
                pass
        elif hasattr(_stream, "detach"):
            try:
                setattr(
                    sys,
                    _stream_name,
                    _io.TextIOWrapper(_stream.detach(), encoding="utf-8", errors="replace"),
                )
            except Exception:
                pass


def hook_log(message: str) -> None:
    if os.environ.get("TRELLIS_HOOK_DEBUG") == "1":
        print(f"[trellis-hook] {message}", file=sys.stderr, flush=True)


def find_trellis_root(start: Path) -> Optional[Path]:
    cur = start.resolve()
    while cur != cur.parent:
        if (cur / ".trellis").is_dir():
            return cur
        cur = cur.parent
    return None


def detect_platform(input_data: dict) -> str | None:
    if isinstance(input_data.get("cursor_version"), str):
        return "cursor"
    env_map = {
        "CLAUDE_PROJECT_DIR": "claude",
        "CURSOR_PROJECT_DIR": "cursor",
        "CODEBUDDY_PROJECT_DIR": "codebuddy",
        "FACTORY_PROJECT_DIR": "droid",
        "GEMINI_PROJECT_DIR": "gemini",
        "QODER_PROJECT_DIR": "qoder",
        "KIRO_PROJECT_DIR": "kiro",
        "COPILOT_PROJECT_DIR": "copilot",
    }
    for env_name, platform in env_map.items():
        if os.environ.get(env_name):
            return platform
    script_parts = set(Path(sys.argv[0]).parts)
    if ".claude" in script_parts:
        return "claude"
    if ".cursor" in script_parts:
        return "cursor"
    if ".codex" in script_parts:
        return "codex"
    if ".gemini" in script_parts:
        return "gemini"
    if ".qoder" in script_parts:
        return "qoder"
    if ".codebuddy" in script_parts:
        return "codebuddy"
    if ".factory" in script_parts:
        return "droid"
    if ".kiro" in script_parts:
        return "kiro"
    return None


def load_active_task(root: Path, input_data: dict):
    scripts_dir = root / ".trellis" / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from common.active_task import resolve_active_task  # type: ignore[import-not-found]

    return resolve_active_task(root, input_data, platform=detect_platform(input_data))


def read_task_status(root: Path, task_path: str) -> tuple[str, str] | None:
    task_dir = Path(task_path)
    if not task_dir.is_absolute():
        task_dir = root / task_dir
    task_json = task_dir / "task.json"
    if not task_json.is_file():
        return None
    try:
        data = json.loads(task_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    task_id = data.get("id") or task_dir.name
    status = data.get("status")
    if not isinstance(status, str) or not status:
        return None
    return str(task_id), status


def main() -> int:
    hook_log("stop-check start")
    if os.environ.get("TRELLIS_HOOKS") == "0" or os.environ.get("TRELLIS_DISABLE_HOOKS") == "1":
        hook_log("stop-check disabled by env")
        return 0

    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        data = {}
        hook_log("stop-check stdin parse failed; using {}")

    cwd_str = data.get("cwd") or os.getcwd()
    root = find_trellis_root(Path(cwd_str))
    if root is None:
        hook_log("stop-check no trellis root found")
        return 0

    active = load_active_task(root, data)
    hook_log(f"stop-check active_task={active}")
    if not active.task_path or active.stale:
        return 0

    task_status = read_task_status(root, active.task_path)
    if task_status is None:
        return 0

    task_id, status = task_status
    if status == "completed":
        return 0

    reason = (
        f"Trellis task {task_id} is still {status}. "
        "Keep this session open and finish the remaining steps before stopping."
    )
    print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
