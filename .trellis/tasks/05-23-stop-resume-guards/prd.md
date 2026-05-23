# PRD: Add stop/resume guards

## Goal
Add a minimal hook path that can block a premature session stop when the active Trellis task still has required steps pending, and re-surface the unfinished step on the next prompt/session start.

## Scope
- Add a shared stop-check hook for Trellis-managed platforms.
- Wire the hook into Codex, Claude, and CodeBuddy templates.
- Keep the existing workflow-state hook unchanged unless needed for reuse.

## Requirements
1. A stop hook must inspect the active task state before the session ends.
2. If required workflow steps are incomplete, the hook must block stop with a clear continue message.
3. On the next prompt/session start, the system should re-surface the unfinished step so the session can continue from where it left off.
4. The implementation must cover:
   - Codex
   - Claude
   - CodeBuddy

## Acceptance Criteria
- Codex hook config includes a Stop entry.
- Claude template settings include a Stop entry.
- CodeBuddy template settings include a Stop entry.
- The stop hook runs without breaking existing UserPromptSubmit behavior.
- The repo still builds/tests cleanly for the touched package code.
