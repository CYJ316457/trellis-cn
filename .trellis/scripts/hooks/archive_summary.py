#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate archive summary files after task archive."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path


IGNORED_NAMES = {"summary.md"}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def _read_task_json(task_json_path: Path) -> dict:
    try:
        return json.loads(task_json_path.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        print(f"[WARN] archive_summary: failed to read task.json: {exc}", file=sys.stderr)
        return {}


def _repo_root_from_task(task_json_path: Path) -> Path:
    for parent in task_json_path.resolve().parents:
        if (parent / ".trellis").is_dir():
            return parent
    return Path.cwd()


def _repo_relative(path: Path, repo_root: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return str(path)


def _line_count(path: Path) -> int:
    try:
        return len(path.read_text(encoding="utf-8-sig", errors="replace").splitlines())
    except Exception:
        return 0


def _collect_task_files(task_dir: Path) -> list[Path]:
    return sorted(
        (
            path
            for path in task_dir.rglob("*")
            if path.is_file() and path.name not in IGNORED_NAMES
        ),
        key=lambda path: path.as_posix(),
    )


def _collect_related_files(task: dict, repo_root: Path) -> list[Path]:
    related = task.get("relatedFiles")
    if not isinstance(related, list):
        return []

    files: list[Path] = []
    for item in related:
        if not isinstance(item, str) or not item.strip():
            continue
        path = repo_root / item
        if path.is_file():
            files.append(path)
    return sorted(files, key=lambda path: path.as_posix())


def _format_file_lines(paths: list[Path], repo_root: Path) -> list[str]:
    if not paths:
        return ["- 无可统计文件"]
    return [
        f"- {_repo_relative(path, repo_root)}：{_line_count(path)} 行"
        for path in paths
    ]


def _get_developer(repo_root: Path) -> str:
    developer_path = repo_root / ".trellis" / ".developer"
    try:
        content = developer_path.read_text(encoding="utf-8-sig")
        for line in content.splitlines():
            line = line.strip()
            if line.startswith("name="):
                developer = line.split("=", 1)[1].strip()
                if developer:
                    return developer
    except OSError:
        pass
    return "unknown"


def _weekly_report_path(repo_root: Path, developer: str) -> Path:
    today = datetime.now()
    workspace_dir = repo_root / ".trellis" / "workspace" / developer
    workspace_dir.mkdir(parents=True, exist_ok=True)
    return workspace_dir / f"WeeklyReport{today:%m-%d}.md"


def _append_weekly_report(path: Path, title: str, summary_text: str) -> None:
    today = datetime.now()
    header = f"# Weekly Report {today:%m-%d}\n\n"
    entry = f"## {today:%Y-%m-%d %H:%M} - {title}\n\n{summary_text}\n"

    if path.exists() and path.read_text(encoding="utf-8-sig", errors="replace").strip():
        with path.open("a", encoding="utf-8") as file:
            file.write("\n" + entry)
    else:
        path.write_text(header + entry, encoding="utf-8")


def main() -> int:
    raw_path = os.environ.get("TASK_JSON_PATH", "").strip()
    if not raw_path:
        print("[WARN] archive_summary: TASK_JSON_PATH is missing", file=sys.stderr)
        return 1

    task_json_path = Path(raw_path)
    if not task_json_path.is_file():
        print(f"[WARN] archive_summary: task.json not found: {task_json_path}", file=sys.stderr)
        return 1

    repo_root = _repo_root_from_task(task_json_path)
    task_dir = task_json_path.parent
    task = _read_task_json(task_json_path)

    title = str(task.get("title") or task.get("name") or task_dir.name)
    package = str(task.get("package") or "").strip()
    completed_at = str(task.get("completedAt") or "").strip()

    impl_parts = [title]
    if package:
        impl_parts.append(f"包={package}")
    if completed_at:
        impl_parts.append(f"归档时间={completed_at}")

    task_files = _collect_task_files(task_dir)
    related_files = _collect_related_files(task, repo_root)
    change_lines = _format_file_lines(task_files + related_files, repo_root)

    summary_lines = [
        f"本次实现=====> {'；'.join(impl_parts)}",
        "本次改动=====>",
        *change_lines,
    ]
    summary_text = "\n".join(summary_lines) + "\n"

    summary_path = task_dir / "summary.md"
    summary_path.write_text(summary_text, encoding="utf-8")

    developer = _get_developer(repo_root)
    weekly_path = _weekly_report_path(repo_root, developer)
    _append_weekly_report(weekly_path, title, summary_text)

    print(summary_text, end="")
    print(f"[OK] 已写入归档总结: {summary_path}")
    print(f"[OK] 已追加周报: {weekly_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
