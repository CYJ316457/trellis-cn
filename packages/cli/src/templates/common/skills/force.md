# Trellis Force

Enforce the full Trellis workflow order for the rest of this session.

Use this only in Trellis-managed repositories when the user wants later edits to stay on the workflow rails instead of skipping steps because the change "looks small".

## Required order

1. If Trellis context is not loaded yet, load `trellis-start` first.
2. If the request is implementation work and the task or requirements are not ready yet, load `trellis-brainstorm` and create or continue the task before coding.
3. Before writing code, follow the current platform's implementation entry:
   - inline platforms: load `trellis-before-dev`
   - sub-agent platforms: dispatch the implementation step Trellis expects for the current phase
4. After implementation, run `trellis-check`.
5. If the work produced a reusable rule, pitfall, or convention, run `trellis-update-spec`.
6. Do not run `trellis-finish-work` until the commit step required by `.trellis/workflow.md` is complete.

## Enforcement rules

- Do not skip required phases or reorder them because the change looks minor.
- Do not bypass the active Trellis phase unless the user explicitly gives a workflow override that the current workflow text allows.
- If the current phase does not permit code changes yet, stop and finish the missing workflow step first.

Applies to Codex, Claude Code, and CodeBuddy in Trellis-managed repositories.
