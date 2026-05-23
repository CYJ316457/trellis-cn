import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const hookSource = path.join(
  repoRoot,
  "packages/cli/src/templates/shared-hooks/stop-check.py",
);

function resolvePython(): { command: string; args: string[] } | null {
  const candidates = [
    { command: "python3", args: [] as string[] },
    { command: "python", args: [] as string[] },
    { command: "py", args: ["-3"] },
  ];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate.command, [...candidate.args, "--version"], {
        stdio: "ignore",
      });
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function setupRepo(status: string): { root: string; hookPath: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-stop-"));
  fs.mkdirSync(path.join(root, ".trellis"), { recursive: true });
  fs.cpSync(path.join(repoRoot, ".trellis", "scripts"), path.join(root, ".trellis", "scripts"), {
    recursive: true,
  });

  const taskDir = path.join(root, ".trellis", "tasks", "demo-task");
  fs.mkdirSync(taskDir, { recursive: true });
  writeJson(path.join(taskDir, "task.json"), {
    id: "demo-task",
    status,
  });
  writeJson(path.join(root, ".trellis", ".runtime", "sessions", "unit.json"), {
    current_task: ".trellis/tasks/demo-task",
  });

  const hookPath = path.join(root, "stop-check.py");
  fs.copyFileSync(hookSource, hookPath);
  return { root, hookPath };
}

describe("stop-check.py", () => {
  it("blocks Stop for an unfinished active task", () => {
    const python = resolvePython();
    if (!python) {
      throw new Error("Python is not available");
    }
    const { root, hookPath } = setupRepo("in_progress");
    try {
      const result = spawnSync(python.command, [...python.args, hookPath], {
        cwd: root,
        encoding: "utf-8",
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: root,
          TRELLIS_CONTEXT_ID: "unit",
        },
        input: JSON.stringify({ cwd: root }),
      });
      expect(result.status).toBe(0);
      expect(result.error).toBeUndefined();
      const payload = JSON.parse(result.stdout.trim()) as {
        decision: string;
        reason: string;
      };
      expect(payload.decision).toBe("block");
      expect(payload.reason).toContain("demo-task");
      expect(payload.reason).toContain("in_progress");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("stays silent when the active task is already completed", () => {
    const python = resolvePython();
    if (!python) {
      throw new Error("Python is not available");
    }
    const { root, hookPath } = setupRepo("completed");
    try {
      const result = spawnSync(python.command, [...python.args, hookPath], {
        cwd: root,
        encoding: "utf-8",
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: root,
          TRELLIS_CONTEXT_ID: "unit",
        },
        input: JSON.stringify({ cwd: root }),
      });
      expect(result.status).toBe(0);
      expect(result.error).toBeUndefined();
      expect(result.stdout.trim()).toBe("");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
