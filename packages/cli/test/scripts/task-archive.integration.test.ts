/**
 * Integration tests for `task.py archive` auto-commit behavior.
 *
 * The python script lives under
 * `src/templates/trellis/scripts/common/task_store.py`; this test stamps
 * the templates into a fresh git repo and exercises the real `python3
 * task.py archive` path. Two scenarios:
 *
 *   1. Scope-creep — archive must NOT bundle dirty changes from OTHER
 *      active task dirs into the archive commit.
 *   2. Phantom-delete — after `shutil.move` of a tracked task dir, the
 *      source-side deletions must land in the archive commit (so the
 *      working tree stays clean against HEAD).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEMPLATE_SCRIPTS = path.resolve(
  __dirname,
  "../../src/templates/trellis/scripts",
);

function hasPython(): boolean {
  return resolvePython() !== null;
}

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

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  if (r.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed (rc=${r.status}): ${r.stderr}`,
    );
  }
  return r.stdout.trim();
}

function setupRepo(tmp: string): void {
  fs.mkdirSync(tmp, { recursive: true });
  git(tmp, "init", "-q", "-b", "main");
  // Local commit identity so commit() works in CI without global config.
  git(tmp, "config", "user.email", "test@example.com");
  git(tmp, "config", "user.name", "Test");

  // Stamp the real templates into the test repo.
  const scriptsDest = path.join(tmp, ".trellis", "scripts");
  fs.mkdirSync(scriptsDest, { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, scriptsDest, { recursive: true });

  // session_auto_commit must be enabled for the archive to commit.
  fs.writeFileSync(
    path.join(tmp, ".trellis", "config.yaml"),
    "session_auto_commit: true\n",
  );
}

function makeTask(repo: string, name: string, prdBody: string): void {
  const dir = path.join(repo, ".trellis", "tasks", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "prd.md"), prdBody);
  fs.writeFileSync(
    path.join(dir, "task.json"),
    JSON.stringify({
      id: name,
      name,
      title: name,
      status: "in_progress",
      priority: "P2",
      createdAt: "2026-05-13",
      assignee: "test",
      creator: "test",
      subtasks: [],
      children: [],
      relatedFiles: [],
      meta: {},
    }) + "\n",
  );
}

function runArchive(repo: string, taskName: string): void {
  const python = resolvePython();
  if (!python) {
    throw new Error("python is not available");
  }
  const r = spawnSync(
    python.command,
    [...python.args, ".trellis/scripts/task.py", "archive", taskName],
    { cwd: repo, encoding: "utf-8" },
  );
  if (r.status !== 0) {
    throw new Error(`archive failed: ${r.stderr}`);
  }
}

function runArchiveSummary(repo: string, taskJsonPath: string): void {
  const python = resolvePython();
  if (!python) {
    throw new Error("python is not available");
  }
  const r = spawnSync(
    python.command,
    [...python.args, ".trellis/scripts/hooks/archive_summary.py"],
    {
      cwd: repo,
      encoding: "utf-8",
      env: {
        ...process.env,
        TASK_JSON_PATH: taskJsonPath,
      },
    },
  );
  if (r.status !== 0) {
    throw new Error(`archive_summary failed: ${r.stderr}`);
  }
}

describe.skipIf(!hasPython())(
  "task.py archive auto-commit",
  () => {
    let tmp: string;

    beforeEach(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-archive-test-"));
      setupRepo(tmp);
    });

    afterEach(() => {
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    it("does not bundle dirty changes from other task dirs (scope-creep fix)", () => {
      makeTask(tmp, "task-a", "task A prd\n");
      makeTask(tmp, "task-b", "task B prd v1\n");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");

      // Dirty edit in task-b BEFORE archiving task-a.
      fs.appendFileSync(
        path.join(tmp, ".trellis", "tasks", "task-b", "prd.md"),
        "DIRTY EDIT IN TASK-B SHOULD NOT BE COMMITTED\n",
      );

      runArchive(tmp, "task-a");

      // Last commit: which files?
      const lastFiles = git(
        tmp,
        "show",
        "HEAD",
        "--name-only",
        "--pretty=format:",
      )
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      // task-b paths must NOT appear in the archive commit.
      const leaked = lastFiles.filter((f) => f.includes("/task-b/"));
      expect(leaked).toEqual([]);

      // task-b dirty change still in working tree.
      const status = git(tmp, "status", "--porcelain");
      expect(status).toMatch(/M\s+\.trellis\/tasks\/task-b\/prd\.md/);
    });

    it(
      "stages source-side deletions in the archive commit (phantom-delete fix)",
      () => {
        makeTask(tmp, "big", "# big task\n");
        // Add many files under research/ to mimic the production case that
        // surfaced the bug.
        const researchDir = path.join(
          tmp,
          ".trellis",
          "tasks",
          "big",
          "research",
        );
        fs.mkdirSync(researchDir, { recursive: true });
        for (let i = 0; i < 100; i++) {
          fs.writeFileSync(
            path.join(researchDir, `file-${i}.json`),
            `{"n":${i}}\n`,
          );
        }
        git(tmp, "add", "-A");
        git(tmp, "commit", "-q", "-m", "initial");

        runArchive(tmp, "big");

        // Working tree must be clean (no phantom deletes against HEAD).
        const status = git(tmp, "status", "--porcelain");
        const meaningful = status
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((s) => !s.includes("__pycache__")); // ignore .pyc noise
        expect(meaningful).toEqual([]);

        // Archive commit has deletions at the source location.
        const deletes = git(
          tmp,
          "show",
          "HEAD",
          "--diff-filter=D",
          "--name-only",
          "--pretty=format:",
        )
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        expect(deletes.length).toBeGreaterThan(0);
        expect(
          deletes.every((p) => p.startsWith(".trellis/tasks/big/")),
        ).toBe(true);
      },
      30_000, // python startup + 100-file ops can be slow
    );

    it("parses developer name from .developer before writing weekly report", () => {
      fs.mkdirSync(path.join(tmp, ".trellis", "workspace"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(tmp, ".trellis", ".developer"),
        "name=cyj\ninitialized_at=2026-05-21T21:38:12.909972\n",
      );
      makeTask(tmp, "report", "# report task\n");

      const taskJsonPath = path.join(
        tmp,
        ".trellis",
        "tasks",
        "report",
        "task.json",
      );
      runArchiveSummary(tmp, taskJsonPath);

      const weeklyDir = path.join(tmp, ".trellis", "workspace", "cyj");
      const weeklyFiles = fs
        .readdirSync(weeklyDir)
        .filter((name) => name.startsWith("WeeklyReport"));
      expect(weeklyFiles.length).toBe(1);
      expect(fs.existsSync(path.join(weeklyDir, weeklyFiles[0]))).toBe(true);
    });
  },
);
