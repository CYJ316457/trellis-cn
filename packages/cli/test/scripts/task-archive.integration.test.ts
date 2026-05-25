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

function makeTask(
  repo: string,
  name: string,
  prdBody: string | null = "# PRD\n",
): void {
  const dir = path.join(repo, ".trellis", "tasks", name);
  fs.mkdirSync(dir, { recursive: true });
  if (prdBody !== null) {
    fs.writeFileSync(path.join(dir, "prd.md"), prdBody);
  }
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

function runArchiveResult(repo: string, taskName: string) {
  const python = resolvePython();
  if (!python) {
    throw new Error("python is not available");
  }
  return spawnSync(
    python.command,
    [...python.args, ".trellis/scripts/task.py", "archive", taskName],
    { cwd: repo, encoding: "utf-8" },
  );
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

function writeConfig(repo: string, content: string): void {
  fs.writeFileSync(path.join(repo, ".trellis", "config.yaml"), content);
}

function runPythonScript(
  repo: string,
  scriptRelPath: string,
  args: string[] = [],
  env?: NodeJS.ProcessEnv,
) {
  const python = resolvePython();
  if (!python) {
    throw new Error("python is not available");
  }
  return spawnSync(
    python.command,
    [...python.args, scriptRelPath, ...args],
    {
      cwd: repo,
      encoding: "utf-8",
      env: {
        ...process.env,
        ...env,
      },
    },
  );
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

    it("keeps checklist validation off by default", () => {
      makeTask(tmp, "no-prd", null);

      runArchive(tmp, "no-prd");

      const archiveRoot = path.join(tmp, ".trellis", "tasks", "archive");
      const archived = fs.readdirSync(archiveRoot).some((monthDir) => {
        const monthPath = path.join(archiveRoot, monthDir, "no-prd");
        return fs.existsSync(monthPath);
      });
      expect(archived).toBe(true);
    });

    it("blocks archive when checklist validation is enabled and PRD is missing", () => {
      makeTask(tmp, "needs-prd", null);
      writeConfig(
        tmp,
        [
          "session_auto_commit: false",
          "finish_work_checklist_validation: true",
        ].join("\n") + "\n",
      );

      const result = runArchiveResult(tmp, "needs-prd");

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("finish_work_checklist_validation failed");
      expect(result.stderr).toContain("missing prd.md");
      const archiveRoot = path.join(tmp, ".trellis", "tasks", "archive");
      expect(fs.existsSync(archiveRoot)).toBe(false);
      const archived = fs.readdirSync(path.join(tmp, ".trellis", "tasks")).some((entry) =>
        entry === "archive" &&
        fs.readdirSync(archiveRoot).some((monthDir) =>
          fs.existsSync(path.join(archiveRoot, monthDir, "needs-prd")),
        ),
      );
      expect(archived).toBe(false);
    });

    it("passes checklist validation when required artifacts exist", () => {
      fs.mkdirSync(path.join(tmp, ".claude"), { recursive: true });
      makeTask(tmp, "ready", "# PRD\n");
      fs.writeFileSync(
        path.join(tmp, ".trellis", "tasks", "ready", "implement.jsonl"),
        JSON.stringify({ file: ".trellis/spec/guides/index.md", reason: "guide" }) + "\n",
      );
      fs.writeFileSync(
        path.join(tmp, ".trellis", "tasks", "ready", "check.jsonl"),
        JSON.stringify({ file: ".trellis/spec/guides/index.md", reason: "guide" }) + "\n",
      );
      writeConfig(
        tmp,
        [
          "session_auto_commit: false",
          "finish_work_checklist_validation: true",
        ].join("\n") + "\n",
      );

      runArchive(tmp, "ready");

      const archiveRoot = path.join(tmp, ".trellis", "tasks", "archive");
      const archived = fs.readdirSync(archiveRoot).some((monthDir) =>
        fs.existsSync(path.join(archiveRoot, monthDir, "ready")),
      );
      expect(archived).toBe(true);
    });

    it("keeps external brainstorm disabled by default", () => {
      const result = runPythonScript(
        tmp,
        ".trellis/scripts/brainstorm_runner.py",
        ["status"],
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("enabled: false");
      expect(result.stdout).toContain("mode: native");
    });

    it("reports fallback when external brainstorm is enabled but provider config is incomplete", () => {
      writeConfig(
        tmp,
        [
          "session_auto_commit: true",
          "brainstorm:",
          "  enabled: true",
          "  mode: external",
          "  provider: openai_compatible",
          '  model: "deepseek-chat"',
          '  api_key_env: "TRELLIS_BRAINSTORM_API_KEY"',
        ].join("\n") + "\n",
      );

      const result = runPythonScript(
        tmp,
        ".trellis/scripts/brainstorm_runner.py",
        ["status"],
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("enabled: true");
      expect(result.stdout).toContain("mode: external");
      expect(result.stdout).toContain("fallback_to_native: true");
      expect(result.stdout).toContain("missing base_url");
    });

    it("draft falls back to native when external brainstorm config is incomplete", () => {
      writeConfig(
        tmp,
        [
          "brainstorm:",
          "  enabled: true",
          "  mode: external",
          "  provider: openai_compatible",
          '  api_key_env: "TRELLIS_BRAINSTORM_API_KEY"',
          '  model: "deepseek-chat"',
        ].join("\n") + "\n",
      );

      const result = runPythonScript(
        tmp,
        ".trellis/scripts/brainstorm_runner.py",
        ["draft", "--goal", "Add a brainstorm helper"],
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('"mode":"native_fallback"');
      expect(result.stdout).toContain("missing base_url");
    });

    it("draft returns external brainstorm output when provider responds successfully", () => {
      makeTask(tmp, "brainstorm-task", "# PRD\n\n## Goal\n\nExisting goal.\n");
      fs.writeFileSync(
        path.join(tmp, ".trellis", ".current-task"),
        ".trellis/tasks/brainstorm-task\n",
      );
      writeConfig(
        tmp,
        [
          "brainstorm:",
          "  enabled: true",
          "  mode: external",
          "  provider: openai_compatible",
          '  base_url: "https://llm.example.com/v1"',
          '  api_key_env: "TRELLIS_BRAINSTORM_API_KEY"',
          '  model: "deepseek-chat"',
          "  timeout_seconds: 15",
        ].join("\n") + "\n",
      );

      const payload = {
        choices: [
          {
            message: {
              content: "Question 1: What is the MVP scope?\nOption A: Keep it minimal.",
            },
          },
        ],
      };

      const result = runPythonScript(
        tmp,
        ".trellis/scripts/brainstorm_runner.py",
        ["draft", "--goal", "Add a brainstorm helper"],
        {
          TRELLIS_BRAINSTORM_API_KEY: "test-key",
          TRELLIS_BRAINSTORM_FAKE_RESPONSE: JSON.stringify(payload),
        },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('"mode":"external"');
      expect(result.stdout).toContain("Question 1: What is the MVP scope?");
      expect(result.stdout).toContain("Option A: Keep it minimal.");

      const prdContent = fs.readFileSync(
        path.join(tmp, ".trellis", "tasks", "brainstorm-task", "prd.md"),
        "utf-8",
      );
      expect(prdContent).toContain("## Goal");
      expect(prdContent).toContain("Existing goal.");
      expect(prdContent).toContain("## External Brainstorm Draft");
      expect(prdContent).toContain("Question 1: What is the MVP scope?");
      expect(prdContent).toContain("Option A: Keep it minimal.");
    });
  },
);
