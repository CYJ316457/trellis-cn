# Half Chinese Workflow Init Template

## Goal

Make `trellis init` generate a half-Chinese `.trellis/workflow.md` by default.

## Requirements

- Translate user-facing workflow explanations and prompts in `packages/cli/src/templates/trellis/workflow.md` into Chinese.
- Preserve machine-readable workflow contracts unchanged, including `[workflow-state:*]` markers, closing tags, command names, file paths, JSONL filenames, and task status values.
- Keep the result practical for Chinese users while retaining English identifiers needed by hooks, tests, and platform templates.

## Validation

- Verify the template still contains all required workflow-state markers.
- Verify the template includes Chinese user-facing workflow wording.
- Run the targeted regression/template test and build or typecheck if feasible.
