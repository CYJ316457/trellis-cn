# 开发工作流 (Development Workflow)

---

## 核心原则 (Core Principles)

1. **先计划，再写代码 (Plan before code)** — 动手前先确认要做什么。
2. **规范靠注入，不靠记忆 (Specs injected, not remembered)** — 指南通过 hook/skill 注入，不依赖模型临时回忆。
3. **所有过程都落盘 (Persist everything)** — research、decision、lesson 都写入文件；对话会压缩，文件不会。
4. **增量开发 (Incremental development)** — 一次只推进一个 task。
5. **沉淀经验 (Capture learnings)** — 每个 task 结束后复盘，把新的知识写回 spec。

---

## Trellis 系统 (Trellis System)

### 开发者身份 (Developer Identity)

首次使用时，初始化你的开发者身份：

```bash
python3 ./.trellis/scripts/init_developer.py <your-name>
```

这会创建 `.trellis/.developer` (gitignored) 和 `.trellis/workspace/<your-name>/`。

### Spec 系统 (Spec System)

`.trellis/spec/` 保存按 package 和 layer 组织的编码规范。

- `.trellis/spec/<package>/<layer>/index.md` — 入口文件，包含 **Pre-Development Checklist** 和 **Quality Check**。真正的规则在它指向的 `.md` 文件中。
- `.trellis/spec/guides/index.md` — 跨 package 的思考指南。

```bash
python3 ./.trellis/scripts/get_context.py --mode packages   # 列出 package / layer
```

**什么时候更新 spec**：发现新的 pattern/convention · 需要把 bug-fix 防线固化下来 · 做了新的技术决策。

### Task 系统 (Task System)

每个 task 都有自己的目录：`.trellis/tasks/{MM-DD-name}/`，里面保存 `prd.md`、`implement.jsonl`、`check.jsonl`、`task.json`，以及可选的 `research/`、`info.md`。

```bash
# 任务生命周期
python3 ./.trellis/scripts/task.py create "<title>" [--slug <name>] [--parent <dir>]
python3 ./.trellis/scripts/task.py start <name>          # 设置活动任务（如可用则按 session 作用域）
python3 ./.trellis/scripts/task.py current --source      # 显示活动任务及来源
python3 ./.trellis/scripts/task.py finish                # 清除活动任务（触发 after_finish hooks）
python3 ./.trellis/scripts/task.py archive <name>        # 移动到 archive/{year-month}/
python3 ./.trellis/scripts/task.py list [--mine] [--status <s>]
python3 ./.trellis/scripts/task.py list-archive

# 代码规范上下文（通过 JSONL 注入到 implement/check agents）。
# `implement.jsonl` / `check.jsonl` 会在 `task create` 时为支持 sub-agent 的
# 平台预置；AI 会在 Phase 1.3 整理真实的 spec + research 条目。
python3 ./.trellis/scripts/task.py add-context <name> <action> <file> <reason>
python3 ./.trellis/scripts/task.py list-context <name> [action]
python3 ./.trellis/scripts/task.py validate <name>

# 任务元数据
python3 ./.trellis/scripts/task.py set-branch <name> <branch>
python3 ./.trellis/scripts/task.py set-base-branch <name> <branch>    # PR 目标
python3 ./.trellis/scripts/task.py set-scope <name> <scope>

# 父子任务
python3 ./.trellis/scripts/task.py add-subtask <parent> <child>
python3 ./.trellis/scripts/task.py remove-subtask <parent> <child>

# 创建 PR
python3 ./.trellis/scripts/task.py create-pr [name] [--dry-run]
```

> 运行 `python3 ./.trellis/scripts/task.py --help` 查看权威且最新的命令列表。

**当前任务机制 (Current-task mechanism)**：`task.py create` 创建 task 目录；如果当前平台能提供 session identity，会自动设置本 session 的 active-task 指针，让 planning breadcrumb 立即生效。`task.py start` 写入同一个指针 (已设置时幂等)，并把 `task.json.status` 从 `planning` 切到 `in_progress`。状态保存在 `.trellis/.runtime/sessions/`。如果 hook input、`TRELLIS_CONTEXT_ID` 或平台原生 session 环境变量都没有提供 context key，就没有 active task，`task.py start` 会带着 session identity 提示失败。`task.py finish` 删除当前 session 文件 (不改 status)。`task.py archive <task>` 写入 `status=completed`，把目录移动到 `archive/`，并删除仍指向该归档 task 的 runtime session 文件。

### Workspace 系统 (Workspace System)

在 `.trellis/workspace/<developer>/` 记录每次 AI session，方便跨 session 追踪。

- `journal-N.md` — session log。**每个文件最多 2000 行**；超过后自动创建新的 `journal-(N+1).md`。
- `index.md` — 个人索引 (total sessions, last active)。

```bash
python3 ./.trellis/scripts/add_session.py --title "Title" --commit "hash" --summary "Summary"
```

### 上下文脚本 (Context Script)

```bash
python3 ./.trellis/scripts/get_context.py                            # 完整 session runtime
python3 ./.trellis/scripts/get_context.py --mode packages            # 可用 packages + spec layers
python3 ./.trellis/scripts/get_context.py --mode phase --step <X.Y>  # 某个 workflow step 的详细指引
```

---

<!--
  工作流状态面包屑契约（编辑下面的状态块前先看这里）

  下方 Phase Index 里嵌入的 4 个 [workflow-state:STATUS] 块，是每个平台
  UserPromptSubmit hook 读取 per-turn `<workflow-state>` 面包屑的唯一
  真相源。Python 平台的 inject-workflow-state.py 和 OpenCode 插件的
  inject-workflow-state.js 只解析这些内容；自 v0.5.0-rc.0 之后，脚本里
  不再内置兜底字典。

  STATUS 字符集：[A-Za-z0-9_-]+。当 hook 找不到 tag 时，会退化成一行
  通用提示 "Refer to workflow.md for current step."，这样用户能看到并
  修复损坏的 workflow.md。

  不变量（test/regression.test.ts）：
    每个标记为 `[required 路 once]` 的 workflow-walkthrough 步骤，都必须在
    所在 phase 的 `[workflow-state:*]` block 里有对应的 enforcement line。
    面包屑是唯一的 per-turn 通道；如果某个必需步骤没有出现在这里，AI 就会
    静默跳过它（Phase 1.3 jsonl curation skip 和 Phase 3.4 commit skip
    都是通过这个缺口暴露出来的）。

  TAG → PHASE 范围：
    [workflow-state:no_task]      → 没有活动任务；Phase 1 之前
    [workflow-state:planning]     → Phase 1 全部内容（status='planning'）
    [workflow-state:in_progress]  → Phase 2 + Phase 3.1-3.4
                                    （status 从 task.py start 到
                                    task.py archive 期间保持 'in_progress'）
    [workflow-state:completed]    → 目前是 DEAD：cmd_archive 会在同一次调用里
                                    同时改 status 并移动目录，所以 resolver
                                    会丢失指针（先保留这个块，未来如果要做
                                    显式 in_progress→completed 迁移再启用）

  编辑清单：
    - 修改任意 [workflow-state:STATUS] block 时，也要检查对应 phase 里
      `[required 路 once]` 的 walkthrough 步骤是否同步
    - 编辑后运行 `trellis update`，把新内容推送到下游用户项目（按 block
      级别管理替换）
    - 完整 runtime contract：
      .trellis/spec/cli/backend/workflow-state-contract.md
-->

## 阶段索引 (Phase Index)

```
Phase 1: Plan    → 明确要做什么 (brainstorm + research → prd.md)
Phase 2: Execute → 写代码并通过质量检查
Phase 3: Finish  → 沉淀经验并收尾
```

<!-- 当前没有活动任务时显示的 per-turn breadcrumb（Phase 1 之前） -->

[workflow-state:no_task]
当前没有活动任务 (No active task)。**A 直接回答 (Direct answer)** — 纯 Q&A / explanation / lookup / chat；不写文件 + 一句话回答 + repo 读取 ≤ 2 个文件 → AI 自行判断，不需要用户 override。
**B 创建 task (Create a task)** — 任何 implementation / code change / build / refactor 工作都走这里。入口顺序：(1) 运行 `python3 ./.trellis/scripts/task.py create "<title>"` 创建 task (status=planning，breadcrumb 切到 [workflow-state:planning]，用于 brainstorm + jsonl 阶段引导) → (2) 加载 `trellis-brainstorm` skill，与用户澄清需求并迭代 `prd.md` → (3) `prd.md` 完成且 jsonl 已 curated 后，运行 `task.py start <task-dir>` 进入 [workflow-state:in_progress]，开始实现。**"It looks small" is NOT grounds for downgrading B to A or C**。
**C Inline change** (仅当前 turn 生效，是 B 的逃生口) — 用户当前消息 MUST 明确包含以下任一短语："skip trellis" / "no task" / "just do it" / "don't create a task" / "跳过 trellis" / "别走流程" / "小修一下" / "直接改" / "先别建任务" → 简短确认 ("ok, skipping trellis flow this turn")，然后 inline。**Without seeing one of these phrases you must NOT inline on your own**；不要替用户发明 override。
[/workflow-state:no_task]

### Phase 1: Plan / 计划
- 1.0 Create task `[required · once]` (只运行 `task.py create`；status 进入 planning)
- 1.1 Requirement exploration `[required · repeatable]` / 需求澄清
- 1.2 Research `[optional · repeatable]` / 调研
- 1.3 Configure context `[required · once]` / 配置上下文 — Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi
- 1.4 Activate task `[required · once]` (运行 `task.py start`；status → in_progress)
- 1.5 Completion criteria / 完成标准

<!-- Phase 1 期间显示的 per-turn breadcrumb（status='planning'） -->

[workflow-state:planning]
加载 `trellis-brainstorm` skill，与用户迭代 `prd.md`。
如果 `.trellis/config.yaml` 显式开启了 `brainstorm.mode: external`，可以先让 `.trellis/scripts/brainstorm_runner.py` 辅助生成问题草案 / 方案草案 / PRD 草稿；如果外部配置不完整或调用失败，必须立即回退到原生 brainstorm 流程。
执行 Phase 1 任一步骤时，开始前打印 `📌步骤 X.Y 开始执行`，完成后打印 `✅步骤 X.Y 执行完成`；如果跳过，打印 `⏭️步骤 X.Y 跳过，跳过原因：<原因>`。
读取或写入任意规范 `.md` 文件前，打印 `🦆正在读规范<文件名>.md` 或 `🦆正在写规范<文件名>.md`。
Phase 1.3 (required, once)：在运行 `task.py start` 之前，MUST curate `implement.jsonl` 和 `check.jsonl` — 列出 sub-agents 需要的 spec / research 文件，确保注入正确上下文。只有当 jsonl 已经包含 agent-curated entries 时才可以跳过 (仅有 seed `_example` 行不算)。
然后运行 `task.py start <task-dir>`，把 status 切到 in_progress。
[/workflow-state:planning]

<!-- 当 codex.dispatch_mode=inline 且处于 Phase 1 时显示的 per-turn breadcrumb。
     这是 [workflow-state:planning] 的 Codex 专用可选分支。主 agent 会在
     Phase 2 直接改代码，所以 Phase 1.3 的 jsonl curation 会跳过 —— inline
     workflow 会直接加载 `trellis-before-dev`，而不是把 JSONL 注入给
     sub-agent。 -->

[workflow-state:planning-inline]
加载 `trellis-brainstorm` skill，与用户迭代 `prd.md`。
执行 Phase 1 任一步骤时，开始前打印 `📌步骤 X.Y 开始执行`，完成后打印 `✅步骤 X.Y 执行完成`；如果跳过，打印 `⏭️步骤 X.Y 跳过，跳过原因：<原因>`。
读取或写入任意规范 `.md` 文件前，打印 `🦆正在读规范<文件名>.md` 或 `🦆正在写规范<文件名>.md`。
inline dispatch mode 下，Phase 1.3 jsonl curation 会 **skipped** — main session 会在 Phase 2 直接加载 `trellis-before-dev` 并自行读取 spec context，因此没有 sub-agent 需要 jsonl 注入。
然后运行 `task.py start <task-dir>`，把 status 切到 in_progress。
[/workflow-state:planning-inline]

### Phase 2: Execute / 执行
- 2.1 Implement `[required · repeatable]` / 实现
- 2.2 Quality check `[required · repeatable]` / 质量检查
- 2.3 Rollback `[on demand]` / 按需回滚

<!-- status='in_progress' 时显示的 per-turn breadcrumb。
     范围：Phase 2 + Phase 3.1-3.4 全部内容（status 会从 task.py start 一直
     保持到 task.py archive；只有 archive 会切换它）。因此这里的正文必须
     覆盖从实现到提交的每个必需步骤，包括 Phase 3.3 spec update 和
     Phase 3.4 commit。 -->

[workflow-state:in_progress]
**Tools / 工具**：`trellis-implement` / `trellis-research` 只是 sub-agent types (Task/Agent tool, NOT Skill — there is no skill by these names)。`trellis-update-spec` 是 skill。`trellis-check` 两种形态都有；代码改动后的验证优先使用 Agent form。
**Flow / 流程**：trellis-implement → trellis-check → trellis-update-spec → commit (Phase 3.4) → `/trellis:finish-work`。
**Comment rule / 注释规则**：修改代码逻辑时，遇到关键业务分支、状态流转、边界条件、跨模块调用或复杂算法，必须补简洁注释，只解释为什么，不要给显而易见的代码写废话注释。
**Step logging / 步骤打印**：执行 Phase 2 / 3 任一步骤时，开始前打印 `📌步骤 X.Y 开始执行`，完成后打印 `✅步骤 X.Y 执行完成`；如果跳过，打印 `⏭️步骤 X.Y 跳过，跳过原因：<原因>`。
**Spec read/write logging / 规范读写提示**：读取或写入任意规范 `.md` 文件前，打印 `🦆正在读规范<文件名>.md` 或 `🦆正在写规范<文件名>.md`。
**Main-session default (no override)**：默认 dispatch `trellis-implement` / `trellis-check` sub-agents — main agent 默认不直接改代码。Phase 3.4 commit (required, once)：在 trellis-update-spec 之后，或实现已可验证完成时，main agent **drives the commit** — 先用用户可见文本说明 commit plan，再运行 `git commit` — BEFORE suggesting `/trellis:finish-work`。`/finish-work` 会拒绝 dirty working tree (不含 `.trellis/workspace/` 和 `.trellis/tasks/` 的路径)。
**SVN override**：如果项目使用 SVN 而不是 Git，Phase 3.4 必须打印 `⏭️步骤 3.4 跳过，跳过原因：项目使用 SVN 工作流`，直接进入 Phase 3.5；归档阶段再让用户决定是否执行 `svn commit`。
**Sub-agent self-exemption**：如果你已经是 `trellis-implement` sub-agent (already running as `trellis-implement`)，就直接基于已加载的 task context 实现，do NOT spawn another `trellis-implement`；如果你已经是 `trellis-check` (already running as `trellis-check`)，就直接 review/fix，do NOT spawn another `trellis-check`。默认 dispatch 规则只适用于 main session only。
**Sub-agent dispatch protocol (all platforms, all sub-agents)**：当你 spawn `trellis-implement` / `trellis-check` / `trellis-research` 时，dispatch prompt **MUST** 以这一行开头：`Active task: <task path from \`task.py current\`>`。No exceptions。class-2 platforms (codex / copilot / gemini / qoder) 没有 hook 注入 task context，所以 sub-agent 依赖这一行。class-1 platforms (claude / cursor / opencode / kiro / codebuddy / droid) 通常由 hook 直接注入上下文，这一行一般冗余，但在 hook 失败时是关键 fallback (Windows + Claude Code PreToolUse silent skip, `--continue` resume, fork distribution, hooks disabled, etc.)。对 `trellis-research` 来说，这一行还告诉 sub-agent 要写入哪个 `{task_dir}/research/`。
**Inline override** (仅当前 turn 生效，是 sub-agent dispatch 的逃生口)：用户当前消息 MUST 明确包含以下任一短语："do it inline" / "no sub-agent" / "你直接改" / "别派 sub-agent" / "main session 写就行" / "不用 sub-agent"。**Without seeing one of these phrases you must NOT inline on your own**；不要替用户发明 override。
[/workflow-state:in_progress]

<!-- status='in_progress' 且 codex.dispatch_mode=inline 时显示的 per-turn breadcrumb。
     这是 [workflow-state:in_progress] 的 Codex 专用可选分支。主 session
     直接改代码，不派发 sub-agents。 -->

[workflow-state:in_progress-inline]
**Flow** (inline mode)：main session loads `trellis-before-dev` → main session edits code → main session loads `trellis-check` → run lint / type-check / tests → fix → `trellis-update-spec` → commit (Phase 3.4) → `/trellis:finish-work`。
**Step logging / 步骤打印**：执行 Phase 2 / 3 任一步骤时，开始前打印 `📌步骤 X.Y 开始执行`，完成后打印 `✅步骤 X.Y 执行完成`；如果跳过，打印 `⏭️步骤 X.Y 跳过，跳过原因：<原因>`。
**Spec read/write logging / 规范读写提示**：读取或写入任意规范 `.md` 文件前，打印 `🦆正在读规范<文件名>.md` 或 `🦆正在写规范<文件名>.md`。
**Main-session default (inline dispatch_mode)**：main agent 直接改代码。Do NOT dispatch `trellis-implement` / `trellis-check` sub-agents。写代码前加载 `trellis-before-dev` skill；报告完成前加载 `trellis-check` skill。
Phase 3.4 commit (required, once)：在 `trellis-update-spec` 之后，或实现已可验证完成时，main agent **drives the commit** — 先用用户可见文本说明 commit plan，再运行 `git commit` — BEFORE suggesting `/trellis:finish-work`。`/finish-work` 会拒绝 dirty working tree (不含 `.trellis/workspace/` 和 `.trellis/tasks/` 的路径)。
如果项目使用 SVN 而不是 Git，打印 `⏭️步骤 3.4 跳过，跳过原因：项目使用 SVN 工作流`，直接进入 Phase 3.5；归档阶段再让用户决定是否执行 `svn commit`。
**Comment rule**: 修改代码逻辑时，遇到关键业务分支、状态流转、边界条件、跨模块调用或复杂算法，必须补简洁注释，只解释为什么，不要给显而易见的代码写废话注释。
[/workflow-state:in_progress-inline]

### Phase 3: Finish / 收尾
- 3.1 Quality verification `[required · repeatable]` / 质量验证
- 3.2 Debug retrospective `[on demand]` / Debug 复盘
- 3.3 Spec update `[required · once]` / 更新 spec
- 3.4 Commit changes `[required · once]` / 提交变更
- 3.5 Wrap-up reminder / 收尾提醒
- 3.6 Weekly report archive summary / 周报归档总结
- 3.7 Monthly report summary / 月报总结

<!-- status='completed' 时显示的 per-turn breadcrumb。
     在正常流程里它目前是 DEAD：cmd_archive 会在同一次调用里把 status 写成
     'completed' 并把 task 目录移到 archive/，所以 active-task resolver 会
     丢失指针，hook 也不会在归档任务上触发。这个块保留给未来的
     status-transition 重设计（例如显式的 in_progress→completed 命令）。
     和 live blocks 一样，需要通过同一个 spec channel 来编辑。 -->

[workflow-state:completed]
代码已通过 Phase 3.4 commit；运行 `/trellis:finish-work` 收尾 (archive the task + record session)。
如果到达这个状态时仍有未提交代码，先回到 Phase 3.4 — `/finish-work` 会拒绝 dirty working tree。
`task.py archive` 会删除仍指向该归档 task 的 runtime session 文件。
[/workflow-state:completed]

### 规则 (Rules)

1. 先判断当前处在哪个 Phase，然后从该 Phase 的下一步继续。
2. 每个 Phase 内按顺序执行；`[required]` 步骤不能跳过。
3. Phase 可以回滚 (例如 Execute 发现 prd 缺陷 → 回到 Plan 修正，再重新进入 Execute)。
4. 标记为 `[once]` 的步骤，如果输出已经存在就跳过；不要重复执行。
5. **详细信息要打印出来** — 执行任一步骤时，开始前打印 `📌步骤 X.Y 开始执行`，完成后打印 `✅步骤 X.Y 执行完成`；如果跳过步骤，打印 `⏭️步骤 X.Y 跳过，跳过原因：<原因>`。
6. **读写规范要提示** — 读取规范文件前打印 `🦆正在读规范<文件名>.md`；写入规范文件前打印 `🦆正在写规范<文件名>.md`。
7. **SVN 项目跳过提交步骤** — 如果项目使用 SVN 而不是 Git，步骤 3.4 跳过，直接走 3.5；归档的时候再让用户决定是否执行 `svn commit`。
8. **步骤节点输出要对齐工作流** — 执行任何步骤节点时，必须原样打印：`📌步骤 X.Y 开始执行`、`✅步骤 X.Y 执行完成`、`⏭️步骤 X.Y 跳过，跳过原因：<原因>`、`🦆正在读规范<文件名>.md`、`🦆正在写规范<文件名>.md`。

### Skill 路由 (Skill Routing)

当用户请求匹配以下意图时，先加载对应 skill (或 dispatch 对应 sub-agent) — do not skip skills。

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

| 用户意图 (User intent) | 路由 (Route) |
|---|---|
| 想做新功能 / 需求不清楚 | `trellis-brainstorm` |
| 准备写代码 / 开始实现 | 按 Phase 2.1 dispatch `trellis-implement` sub-agent |
| 已写完 / 想验证 | 按 Phase 2.2 dispatch `trellis-check` sub-agent |
| 卡住 / 同一个 bug 修了多次 | `trellis-break-loop` |
| 需要更新 spec | `trellis-update-spec` |

**为什么 `trellis-before-dev` 不在表里**：默认情况下不是你在写代码，而是 `trellis-implement` sub-agent 在写。sub-agent platforms 通过 `implement.jsonl` injection / prelude 获得 spec context，不靠 main thread 加载 `trellis-before-dev`。

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-inline, Kilo, Antigravity, Windsurf]

| 用户意图 (User intent) | Skill |
|---|---|
| 想做新功能 / 需求不清楚 | `trellis-brainstorm` |
| 准备写代码 / 开始实现 | `trellis-before-dev` (然后在 main session 直接实现) |
| 已写完 / 想验证 | `trellis-check` |
| 卡住 / 同一个 bug 修了多次 | `trellis-break-loop` |
| 需要更新 spec | `trellis-update-spec` |

[/codex-inline, Kilo, Antigravity, Windsurf]

### 不要跳过 skills (DO NOT skip skills)

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

| 你可能在想 (What you're thinking) | 为什么不对 (Why it's wrong) |
|---|---|
| "This is simple, I'll just code it in the main thread" | Dispatch `trellis-implement` 才是低成本路径；跳过它会诱导你在 main thread 写代码并丢失 spec context — sub-agents 会注入 `implement.jsonl`，你不会 |
| "I already thought it through in plan mode" | Plan-mode 输出只在记忆里 — sub-agents 看不到；必须持久化到 `prd.md` |
| "I already know the spec" | spec 可能在你上次阅读后已经更新；sub-agent 会拿到新副本，你未必会 |
| "Code first, check later" | `trellis-check` 会发现你自己注意不到的问题；越早越便宜 |

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-inline, Kilo, Antigravity, Windsurf]

| 你可能在想 (What you're thinking) | 为什么不对 (Why it's wrong) |
|---|---|
| "This is simple, just code it" | 简单任务经常变复杂；`trellis-before-dev` 不到一分钟，并会加载你需要的 spec context |
| "I already thought it through in plan mode" | Plan-mode 输出只在记忆里 — 写代码前必须持久化到 `prd.md` |
| "I already know the spec" | spec 可能在你上次阅读后已经更新；重新读 |
| "Code first, check later" | `trellis-check` 会发现你自己注意不到的问题；越早越便宜 |

[/codex-inline, Kilo, Antigravity, Windsurf]

### 加载步骤详情 (Loading Step Detail)

每一步都可以运行这个命令获取详细指导：

```bash
python3 ./.trellis/scripts/get_context.py --mode phase --step <step>
# 例如：python3 ./.trellis/scripts/get_context.py --mode phase --step 1.1
```

---

## Phase 1: Plan / 计划

目标：明确要构建什么，产出清晰的需求文档，以及实现所需的上下文。

#### 1.0 Create task / 创建 task `[required · once]`

创建 task 目录 (status 进入 `planning`；当 session identity 可用时，session active-task pointer 会自动指向新 task)：

```bash
python3 ./.trellis/scripts/task.py create "<task title>" --slug <name>
```

`--slug` 只是人类可读名称。Do **not** include the `MM-DD-` date prefix；`task.py create` 会自动添加该前缀。

命令成功后，per-turn breadcrumb 会自动切到 `[workflow-state:planning]`，提示 AI 进入 brainstorm + jsonl curation 阶段。

⚠️ **这里，只运行 `create` — 不要同时运行 `start`**。`start` 会把 status 切到 `in_progress`，导致 breadcrumb 在 brainstorm + jsonl 完成前进入实现阶段 — AI 会静默跳过这些步骤。把 `start` 留到 step 1.4，等 jsonl curation 完成后再运行。

当 `python3 ./.trellis/scripts/task.py current --source` 已经指向某个 task 时，跳过本步。

#### 1.1 Requirement exploration / 需求澄清 `[required · repeatable]`

加载 `trellis-brainstorm` skill，并按该 skill 的指导与用户交互式澄清需求。

brainstorm skill 会指导你：
- 一次只问一个问题
- 优先自己 research，而不是把问题都丢给用户
- 优先提供选项，而不是问开放式问题
- 每次用户回答后立即更新 `prd.md`

需求变化时回到这一步，并修订 `prd.md`。

#### 1.2 Research / 调研 `[optional · repeatable]`

Research 可以在需求澄清期间随时发生。它不局限于本地代码 — 你可以使用任何可用工具 (MCP servers, skills, web search, etc.) 查询外部信息，包括第三方库文档、行业实践、API references 等。

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

Spawn research sub-agent：

- **Agent type**: `trellis-research`
- **Task description**: Research <specific question>
- **Key requirement**: Research output MUST 持久化到 `{TASK_DIR}/research/`

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-inline, Kilo, Antigravity, Windsurf]

直接在 main session 做 research，并把结论写入 `{TASK_DIR}/research/`。(对 `codex-inline` 来说，这避免了 `fork_turns="none"` 隔离导致 `trellis-research` sub-agents 无法解析 active task path。)

[/codex-inline, Kilo, Antigravity, Windsurf]

**Research artifact 约定**：
- 每个 research topic 一个文件 (例如 `research/auth-library-comparison.md`)
- 在文件中记录第三方库使用示例、API references、version constraints
- 记录发现的相关 spec 文件路径，供后续引用

Brainstorm 和 research 可以自由交错 — 遇到技术问题就暂停去 research，然后回到用户对话。

**关键原则**：Research output 必须写入文件，不能只留在 chat 里。Conversations 会被压缩；files 不会。

#### 1.3 Configure context / 配置上下文 `[required · once]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

Curate `implement.jsonl` 和 `check.jsonl`，确保 Phase 2 sub-agents 拿到正确的 spec context。这些文件在 `task create` 时会带一行自描述 `_example` seed；这里的工作是填入真实 entries。

**Location / 位置**：`{TASK_DIR}/implement.jsonl` 和 `{TASK_DIR}/check.jsonl` (already exist)。

**Format / 格式**：每行一个 JSON object — `{"file": "<path>", "reason": "<why>"}`。路径相对 repo root。

**放什么**：
- **Spec files** — `.trellis/spec/<package>/<layer>/index.md` 以及与当前 task 相关的具体 guideline files (`error-handling.md`, `conventions.md`, etc.)
- **Research files** — sub-agent 需要查阅的 `{TASK_DIR}/research/*.md`

**不要放什么**：
- Code files (`src/**`, `packages/**/*.ts`, etc.) — 这些由 sub-agent 在实现时读取，不在这里预注册
- 即将修改的文件 — 原因同上

**两个文件如何分工**：
- `implement.jsonl` → implement sub-agent 正确写代码所需的 specs + research
- `check.jsonl` → check sub-agent 所需 specs (quality guidelines, check conventions, 必要时同一份 research)

**如何发现相关 specs**：

```bash
python3 ./.trellis/scripts/get_context.py --mode packages
```

列出每个 package 及其 spec layers 和路径。选择与当前 task domain 匹配的 entries。

**如何追加 entries**：

Either edit the jsonl file directly in your editor, or use:

```bash
python3 ./.trellis/scripts/task.py add-context "$TASK_DIR" implement "<path>" "<reason>"
python3 ./.trellis/scripts/task.py add-context "$TASK_DIR" check "<path>" "<reason>"
```

真实 entries 存在后，可以删除 seed `_example` 行 (可选 — consumers 会自动跳过它)。

跳过条件：`implement.jsonl` 已有 agent-curated entries (仅有 seed row 不算)。

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-inline, Kilo, Antigravity, Windsurf]

跳过本步。Context 会在 Phase 2 由 `trellis-before-dev` skill 直接加载。

[/codex-inline, Kilo, Antigravity, Windsurf]

#### 1.4 Activate task / 激活 task `[required · once]`

当 `prd.md` 完成且 1.3 jsonl curation 完成后，把 task status 切到 `in_progress`：

```bash
python3 ./.trellis/scripts/task.py start <task-dir>
```

命令成功后，breadcrumb 会自动切到 `[workflow-state:in_progress]`，随后进入 Phase 2 / 3。

如果 `task.py start` 报 session-identity 错误 (hook input、`TRELLIS_CONTEXT_ID` 或平台原生 session env 都没有 context key)，按错误提示设置 session identity 后重试。

#### 1.5 Completion criteria / 完成标准

| 条件 (Condition) | Required |
|------|:---:|
| `prd.md` exists | ✅ |
| User confirms requirements | ✅ |
| `task.py start` has been run (status = in_progress) | ✅ |
| `research/` has artifacts (complex tasks) | recommended |
| `info.md` technical design (complex tasks) | optional |

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

| `implement.jsonl` has agent-curated entries (not just the seed row) | ✅ |

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

---

## Phase 2: Execute / 执行

目标：把 prd 转成能通过质量检查的代码。

#### 2.1 Implement / 实现 `[required · repeatable]`

[Claude Code, Cursor, OpenCode, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

Spawn implement sub-agent：

- **Agent type**: `trellis-implement`
- **Task description**: 根据 `prd.md` 实现需求，查阅 `{TASK_DIR}/research/` 下的材料；结束前运行 project lint 和 type-check
- **Dispatch prompt guard**: 告诉 spawned agent 它已经是 `trellis-implement` sub-agent (already the `trellis-implement` sub-agent)，必须直接实现，not spawn another `trellis-implement` / `trellis-check`.

platform hook/plugin 会自动处理：
- 读取 `implement.jsonl`，并把引用的 spec files 注入 agent prompt
- 注入 `prd.md` 内容

[/Claude Code, Cursor, OpenCode, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-sub-agent]

Spawn implement sub-agent：

- **Agent type**: `trellis-implement`
- **Task description**: 根据 `prd.md` 实现需求，查阅 `{TASK_DIR}/research/` 下的材料；结束前运行 project lint 和 type-check
- **Dispatch prompt guard**: prompt MUST 以 `Active task: <task path>` 开头，然后明确说明 spawned agent 已经是 `trellis-implement`，必须直接实现，不能再 spawn another `trellis-implement` / `trellis-check`。

Codex sub-agent definition 会自动处理 context load requirement：
- 用 `task.py current --source` 解析 active task，然后读取 `prd.md` 和可选的 `info.md`
- 读取 `implement.jsonl`，并要求 agent 在 coding 前加载每个被引用的 spec file

[/codex-sub-agent]

[Kiro]

Spawn implement sub-agent：

- **Agent type**: `trellis-implement`
- **Task description**: 根据 `prd.md` 实现需求，查阅 `{TASK_DIR}/research/` 下的材料；结束前运行 project lint 和 type-check
- **Dispatch prompt guard**: 告诉 spawned agent 它已经是 `trellis-implement` sub-agent (already the `trellis-implement` sub-agent)，必须直接实现，not spawn another `trellis-implement` / `trellis-check`.

platform prelude 会自动处理 context load requirement：
- 读取 `implement.jsonl`，并把引用的 spec files 注入 agent prompt
- 注入 `prd.md` 内容

[/Kiro]

[codex-inline, Kilo, Antigravity, Windsurf]

1. 加载 `trellis-before-dev` skill 读取 project guidelines
2. 读取 `{TASK_DIR}/prd.md` 获取需求
3. 查阅 `{TASK_DIR}/research/` 下的材料
4. 按需求实现代码
5. 运行 project lint 和 type-check

[/codex-inline, Kilo, Antigravity, Windsurf]

#### 2.2 Quality check / 质量检查 `[required · repeatable]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

Spawn check sub-agent：

- **Agent type**: `trellis-check`
- **Task description**: 对照 spec 和 prd review 所有 code changes；直接修复发现的问题；确保 lint 和 type-check 通过
- **Dispatch prompt guard**: 告诉 spawned agent 它已经是 `trellis-check` sub-agent (already the `trellis-check` sub-agent)，必须直接 review/fix，not spawn another `trellis-check` / `trellis-implement`.

check agent 的职责：
- 对照 specs review code changes
- 自动修复它发现的问题
- 运行 lint 和 typecheck 验证

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-inline, Kilo, Antigravity, Windsurf]

加载 `trellis-check` skill，并按它的指导验证代码：
- Spec compliance
- lint / type-check / tests
- Cross-layer consistency (当变更跨 layer 时)

如果发现问题 → fix → re-check，直到 green。

[/codex-inline, Kilo, Antigravity, Windsurf]

#### 2.3 Rollback / 回滚 `[on demand]`

- `check` 暴露 prd 缺陷 → 回到 Phase 1，修复 `prd.md`，然后重做 2.1
- Implementation 方向错了 → revert code，重做 2.1
- 需要更多 research → research (同 Phase 1.2)，把结论写入 `research/`

---

## Phase 3: Finish / 收尾

目标：确认代码质量，沉淀经验，记录本次工作。

#### 3.1 Quality verification / 质量验证 `[required · repeatable]`

加载 `trellis-check` skill，做最终验证：
- Spec compliance
- lint / type-check / tests
- Cross-layer consistency (当变更跨 layer 时)

如果发现问题 → fix → re-check，直到 green。

#### 3.2 Debug retrospective / Debug 复盘 `[on demand]`

如果这个 task 涉及反复 debugging (同一个问题被修了多次)，加载 `trellis-break-loop` skill：
- 分类 root cause
- 解释之前的修复为什么失败
- 提出 prevention

目标是沉淀 debugging lessons，避免同类问题复发。

#### 3.3 Spec update / 更新 spec `[required · once]`

加载 `trellis-update-spec` skill，判断这个 task 是否产生了值得记录的新知识：
- 新发现的 patterns or conventions
- 踩过的坑
- 新的技术决策

读取规范前打印 `🦆正在读规范<文件名>.md`；写入规范前打印 `🦆正在写规范<文件名>.md`。
按需更新 `.trellis/spec/` 下的 docs。即使结论是 "nothing to update"，也要走一遍判断过程。

#### 3.4 Commit changes / 提交变更 `[required · once]`

AI 负责把本 task 的 code changes 做成 batched commit，这样后续 `/finish-work` 可以干净运行。目标：先产生 work commits，再让 bookkeeping (archive + journal) commits 落后面 — 不要交错。
如果项目使用 SVN 而不是 Git (例如仓库存在 `.svn/` 且不使用 Git)，打印 `⏭️步骤 3.4 跳过，跳过原因：项目使用 SVN 工作流`，然后直接跳到 3.5。

**Step-by-step**:

1. **检查 dirty state**：
   ```bash
   git status --porcelain
   ```
   记录每个 dirty path。如果 working tree 干净，跳到 3.5。

2. **从最近历史学习 commit style** (让草拟 message 融入项目风格)：
   ```bash
   git log --oneline -5
   ```
   记录 prefix convention (`feat:` / `fix:` / `chore:` / `docs:` ...)、language (中文/English)、length style。

3. **把 dirty files 分成两组**：
   - **AI-edited this session** — 本 session 中你通过 Edit/Write/Bash tool calls 写过/改过的文件。你知道改了什么、为什么改。
   - **Unrecognized** — 本 session 中你没有碰过的 dirty files (可能是用户手工改动、之前 session 的 WIP、或无关工作)。Do NOT silently include these.

4. **草拟 commit plan**。把 AI-edited files 按逻辑分组 (每个 coherent change unit 一个 commit，不是每个文件一个 commit)。每条包含：`<commit message>` + file list。把 unrecognized files 单独列在底部。

5. **只展示一次计划，并请求一次性确认**。格式：
   ```
   Proposed commits (in order):
     1. <message>
        - <file>
        - <file>
     2. <message>
        - <file>

   Unrecognized dirty files (NOT in any commit — confirm include/exclude):
     - <file>
     - <file>

   Reply 'ok' / '行' to execute. Reply with edits, or '我自己来' / 'manual' to abort.
   ```

6. **确认后**：按顺序对每个 batch 运行 `git add <files>` + `git commit -m "<msg>"`。不要 amend。不要 push。

7. **如果用户拒绝** (回复 "不行" / "我自己来" / "manual" / 对 plan 有任何 pushback)：停止。不要尝试第二版 plan。用户会手动 commit；等他们确认后再跳到 3.5。

**Rules**:
- No `git commit --amend` anywhere — three-stage three-commit flow (work commits → archive commit → journal commit).
- Never push to remote in this step.
- If the user wants different message wording but accepts the file grouping, edit the message and re-confirm once — but if they reject the grouping, exit to manual mode.
- The batched plan is one prompt; do not prompt per commit.

#### 3.5 Wrap-up reminder / 收尾提醒

完成以上步骤后，提醒用户可以运行 `/finish-work` 收尾 (archive the task, record the session)。如果 `.trellis/config.yaml` 打开 `finish_work_checklist_validation: true`，归档前还会多跑一次总检查；缺项先修完再收尾。
如果项目使用 SVN 而不是 Git，归档时再让用户决定是否执行 `svn commit`，不要在 3.4 自动代做提交。

#### 3.6 Weekly report archive summary / 周报归档总结

归档时，`after_archive` 会生成归档目录内的 `summary.md`，并把同样内容追加到 `.trellis/workspace/<developer>/WeeklyReportMM-DD.md`。同一天多次归档必须追加，不覆盖。`本次改动` 必须详细到逐文件行数，至少包含归档 task artifacts，并包含仍然存在的 `task.json.relatedFiles` 文件。

需要做 7 天周报汇总时，直接用 `{{CMD_REF:weekly-report}}`。它默认读取当前开发者 `.trellis/workspace/<developer>/WeeklyReportMM-DD.md`，合并最近 7 天的工作项，输出 `.trellis/workspace/<developer>/WeeklyReportMM-DD~MM-DD.md`，并在最后一节总结所有修改文件。

#### 3.7 Monthly report summary / 月报总结

需要做当月 1 号到今天的月报汇总时，直接用 `{{CMD_REF:monthly-report}}`。它默认读取当前开发者 `.trellis/workspace/<developer>/WeeklyReportMM-DD.md`，合并当月 1 号到今天的工作项，输出 `.trellis/workspace/<developer>/MonthlyReportYYYY-MM-01~YYYY-MM-DD.md`，并在最后一节总结所有修改文件。

---

## 自定义 Trellis (Customizing Trellis for forks)

本节面向想修改 Trellis workflow 本身的开发者。所有自定义都通过编辑本文件完成；scripts 只是 parsers。

### 修改步骤含义 (Changing what a step means)

编辑上方 Phase 1 / 2 / 3 中对应 step 的 walkthrough body。**关键约束**：如果你修改某个 step 的 `[required · once]` marker，或新增 `[required · once]` step，你 MUST 同时在对应 phase 的 `[workflow-state:STATUS]` tag block 中添加匹配的 enforcement line — 否则 per-turn breadcrumb 会漏掉强化提示，AI 会静默跳过该步骤。regression tests 会断言这一点。

全部 4 个 tag blocks 都在上方 `## Phase Index` section 中，紧跟各 phase summary：

| 范围 (Scope) | 对应 tag |
|---|---|
| No active task (before Phase 1) | `[workflow-state:no_task]` (after the Phase Index ASCII art) |
| All of Phase 1 (task created → ready for implementation) | `[workflow-state:planning]` (after Phase 1 summary) |
| Phase 2 + Phase 3.1–3.4 (implementation + check + wrap-up) | `[workflow-state:in_progress]` (after Phase 2 summary) |
| After Phase 3.5 (archived) | `[workflow-state:completed]` (after Phase 3 summary; **currently DEAD**) |

### 修改每 turn prompt text

直接编辑对应 `[workflow-state:STATUS]` block 的 body。编辑后，如果你是 template maintainer，运行 `trellis update`；如果只是自定义自己的项目，重启 AI session — 不需要改 script。

### 添加自定义 status

添加一个新 block：

```
[workflow-state:my-status]
your per-turn prompt text
[/workflow-state:my-status]
```

约束：
- STATUS charset: `[A-Za-z0-9_-]+` (允许 underscores 和 hyphens，例如 `in-review`, `blocked-by-team`)
- 必须由 lifecycle hook 把 `task.json.status` 写成你的自定义值，否则该 tag 永远不会被读取
- Lifecycle hooks 位于 `task.json.hooks.after_*`，绑定到 `after_create / after_start / after_finish / after_archive` 之一

### 添加 lifecycle hook

在 `task.json` 中添加 `hooks` 字段：

```json
{
  "hooks": {
    "after_finish": [
      "your-script-or-command-here"
    ]
  }
}
```

支持的 events：`after_create / after_start / after_finish / after_archive`。注意 `after_finish` ≠ status change (它只清除 active-task pointer)；如果要做 "task is done" notifications，请使用 `after_archive`。

### 完整契约 (Full contract)

关于 workflow state machine 的 runtime contract、所有 status writers 的位置、pseudo-statuses (`no_task` / `stale_<source_type>`)、hook reachability matrix 以及其他细节，请看：

- `.trellis/spec/cli/backend/workflow-state-contract.md` — runtime contract + writer table + test invariants
- `.trellis/scripts/inject-workflow-state.py` — actual parser (reads workflow.md only, no embedded text)
