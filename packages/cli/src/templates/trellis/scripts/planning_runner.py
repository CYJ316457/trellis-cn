#!/usr/bin/env python3
"""Optional enhanced planning runner."""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from common.config import get_planning_config
from common.paths import get_current_task_abs, get_repo_root

READINESS_VALUES = {"ready", "not_ready", "ready_with_risk"}


def _resolve_api_key(config: dict[str, object]) -> str:
    explicit = str(config.get("api_key", "")).strip()
    if explicit:
        return explicit
    env_name = str(config.get("api_key_env", "")).strip()
    return os.environ.get(env_name, "")

def _api_key_source(config: dict[str, object]) -> str:
    if str(config.get("api_key", "")).strip():
        return "config"
    env_name = str(config.get("api_key_env", "")).strip()
    if env_name and os.environ.get(env_name):
        return "env"
    return ""

def _mask_key(key: str) -> str:
    if not key:
        return ""
    return "***" if len(key) <=4 else key[:4] + "***"

def _fallback_reasons(config: dict[str, object]) -> list[str]:
    reasons: list[str] = []
    if not bool(config.get("enhanced")):
        return reasons
    for key in ("provider", "base_url", "model"):
        if not str(config.get(key, "")).strip():
            reasons.append(f"missing {key}")
    api_key = str(config.get("api_key", "")).strip()
    api_key_env = str(config.get("api_key_env", "")).strip()
    if not api_key and not api_key_env:
        reasons.append("missing api_key and api_key_env (need at least one)")
    elif not api_key and api_key_env and not os.environ.get(api_key_env):
        reasons.append(f"environment variable {api_key_env} is not set")
    return reasons

def _fallback_payload(reasons: list[str]) -> dict[str, object]:
    return {
        "mode": "native_fallback",
        "fallback_reasons": reasons,
        "assistant_message": "Enhanced planning unavailable; continue with the normal Trellis brainstorm/research/jsonl flow.",
        "next_action": "native_planning",
        "readiness": "not_ready",
        "research_topics": [],
    }

def cmd_status(_args: argparse.Namespace) -> int:
    repo_root = get_repo_root()
    config = get_planning_config(repo_root)
    reasons = _fallback_reasons(config)
    key = _resolve_api_key(config)
    payload = {
        "enhanced": bool(config.get("enhanced")),
        "model_profile": str(config.get("model_profile", "strong")),
        "provider": str(config.get("provider", "")),
        "model": str(config.get("model", "")),
        "api_key_set": bool(key),
        "api_key_source": _api_key_source(config),
        "api_key_masked": _mask_key(key),
        "fallback_to_native": bool(reasons),
        "fallback_reasons": reasons,
    }
    print(json.dumps(payload, ensure_ascii=False))
    print(f"enhanced: {str(payload['enhanced']).lower()}")
    print(f"model_profile: {payload['model_profile']}")
    if payload["provider"]:
        print(f"provider: {payload['provider']}")
    if payload["model"]:
        print(f"model: {payload['model']}")
    print(f"api_key_set: {str(payload['api_key_set']).lower()} (source: {payload['api_key_source'] or 'none'}, key: {payload['api_key_masked']})")
    print(f"fallback_to_native: {str(payload['fallback_to_native']).lower()}")
    for reason in reasons:
        print(reason)
    return 0

def _read_task_file(task_dir: Path | None, name: str) -> str:
    if task_dir is None:
        return ""
    try:
        return (task_dir / name).read_text(encoding="utf-8")
    except OSError:
        return ""

def _build_prompt(goal: str, task_dir: Path | None) -> str:
    return "\n".join([
        "You are Trellis enhanced planning. Return ONLY a JSON object.",
        "Required string fields: prd_md, implement_jsonl, check_jsonl, assistant_message, next_action, readiness.",
        "readiness must be one of ready, not_ready, ready_with_risk.",
        "research_topics must be an array of strings.",
        "implement_jsonl and check_jsonl must be newline-delimited JSON objects with at least file and reason fields when ready.",
        "Do not change task status. Produce full replacement file contents.",
        "", f"User goal: {goal}", "", "Existing prd.md:",
        _read_task_file(task_dir, "prd.md"), "", "Existing implement.jsonl:",
        _read_task_file(task_dir, "implement.jsonl"), "", "Existing check.jsonl:",
        _read_task_file(task_dir, "check.jsonl"),
    ])

def _extract_text(response_json: dict[str, object]) -> str:
    choices = response_json.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""
    first = choices[0]
    if not isinstance(first, dict):
        return ""
    message = first.get("message")
    if not isinstance(message, dict):
        return ""
    content = message.get("content")
    return content.strip() if isinstance(content, str) else ""

def _call_openai_compatible(config: dict[str, object], goal: str, task_dir: Path | None) -> str:
    fake_response = os.environ.get("TRELLIS_PLANNING_FAKE_RESPONSE")
    if fake_response:
        return _extract_text(json.loads(fake_response))
    base_url = str(config.get("base_url", "")).rstrip("/")
    timeout_seconds = int(config.get("timeout_seconds",120))
    payload: dict[str, object] = {
        "model": str(config.get("model", "")).strip(),
        "messages": [{"role": "system", "content": "You produce Trellis Phase1 planning artifacts as strict JSON."}, {"role": "user", "content": _build_prompt(goal, task_dir)}],
    }
    effort = str(config.get("reasoning_effort", "")).strip()
    if effort:
        payload["reasoning_effort"] = effort
    req = urllib.request.Request(f"{base_url}/chat/completions", data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json", "Authorization": f"Bearer {_resolve_api_key(config)}"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
        body = response.read().decode("utf-8")
    return _extract_text(json.loads(body))

def _validate_jsonl(name: str, content: str) -> None:
    for lineno, line in enumerate(content.splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        parsed = json.loads(stripped)
        if not isinstance(parsed, dict):
            raise ValueError(f"{name}:{lineno} is not a JSON object")

def _parse_turn_payload(text: str) -> dict[str, object]:
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("planning response is not a JSON object")
    for key in ("prd_md", "implement_jsonl", "check_jsonl", "assistant_message", "next_action", "readiness"):
        if not isinstance(data.get(key), str):
            raise ValueError(f"planning response missing string field {key}")
    if data["readiness"] not in READINESS_VALUES:
        raise ValueError("planning response has invalid readiness")
    topics = data.get("research_topics", [])
    if not isinstance(topics, list) or any(not isinstance(item, str) for item in topics):
        raise ValueError("planning response research_topics must be strings")
    _validate_jsonl("implement_jsonl", str(data["implement_jsonl"]))
    _validate_jsonl("check_jsonl", str(data["check_jsonl"]))
    return data

def _write_artifacts(task_dir: Path | None, payload: dict[str, object]) -> None:
    if task_dir is None:
        return
    task_dir.mkdir(parents=True, exist_ok=True)
    (task_dir / "prd.md").write_text(str(payload["prd_md"]).rstrip() + "\n", encoding="utf-8")
    (task_dir / "implement.jsonl").write_text(str(payload["implement_jsonl"]).rstrip() + "\n", encoding="utf-8")
    (task_dir / "check.jsonl").write_text(str(payload["check_jsonl"]).rstrip() + "\n", encoding="utf-8")

def cmd_turn(args: argparse.Namespace) -> int:
    repo_root = get_repo_root()
    config = get_planning_config(repo_root)
    reasons = _fallback_reasons(config)
    if reasons:
        print(json.dumps(_fallback_payload(reasons), ensure_ascii=False, separators=(",", ":")))
        return 0
    task_dir = get_current_task_abs(repo_root)
    try:
        attempts = int(config.get("retry_count",1)) +1
        last_error: Exception | None = None
        for _ in range(max(1, attempts)):
            try:
                raw = _call_openai_compatible(config, args.goal, task_dir)
                payload = _parse_turn_payload(raw)
                _write_artifacts(task_dir, payload)
                payload = {"mode": "enhanced", "fallback_reasons": [], **payload}
                print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
                return 0
            except (json.JSONDecodeError, ValueError, urllib.error.URLError, TimeoutError) as exc:
                last_error = exc
        raise last_error or ValueError("empty planning response")
    except Exception as exc:
        print(json.dumps(_fallback_payload([str(exc)]), ensure_ascii=False, separators=(",", ":")))
        return 0

def main() -> int:
    parser = argparse.ArgumentParser(description="Optional enhanced planning runner")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("status", help="Print enhanced planning runtime status")
    turn = sub.add_parser("turn", help="Run one enhanced planning turn")
    turn.add_argument("--goal", required=True, help="Current planning goal")
    args = parser.parse_args()
    if args.command == "status":
        return cmd_status(args)
    if args.command == "turn":
        return cmd_turn(args)
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())







