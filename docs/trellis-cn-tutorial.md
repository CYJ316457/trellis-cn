# Trellis 中文工作流教程

本文面向使用 `CYJ316457/trellis-cn` 和 `@sad678/trellis` 的团队，整理 Trellis 官方教程的核心用法，并补充本 fork 在中文 workflow、npm 发布、多人协作和后续同步官方更新时需要注意的实践细节。

## 1. Trellis 是什么

Trellis 是一个把 AI 编码流程固定到仓库里的工作流框架。它会在项目中生成 `.trellis/` 目录，以及各平台需要的 hooks、skills、agents 或命令文件，让不同开发者、不同 AI 工具尽量遵循同一套项目规则。

核心价值：

- 把项目规范写进 `.trellis/spec/`，让 AI 在任务中自动读取相关规范。
- 把每个需求拆成独立 task，放在 `.trellis/tasks/` 下，包含 PRD、上下文、检查清单和任务状态。
- 把开发者会话记录到 `.trellis/workspace/`，减少跨会话丢上下文。
- 支持多平台协作，例如 Codex、Claude Code、Cursor、OpenCode、Gemini、Kiro、Qoder 等。

官方文档入口：

- 官方快速开始：https://docs.trytrellis.app/zh/start/install-and-first-task
- 官方支持平台：https://docs.trytrellis.app/zh/advanced/multi-platform
- 官方 FAQ：https://docs.trytrellis.app/zh/faq

## 2. 本中文 fork 改了什么

本 fork 基于官方 Trellis，主要做中文化和流程提示增强。

当前发布信息：

```text
GitHub: https://github.com/CYJ316457/trellis-cn
npm:    @sad678/trellis
版本:   0.5.18-cn.2
tag:    cn
```

主要改动：

- `packages/cli/package.json` 的包名改为 `@sad678/trellis`。
- `trellis init` 初始化出的 `.trellis/workflow.md` 已改为半中文版本。
- 保留机器契约不变，包括：
  - `[workflow-state:no_task]`、`[workflow-state:planning]`、`[workflow-state:in_progress]`、`[workflow-state:completed]`
  - `[/workflow-state:...]` 结束标签
  - `task.py create`、`implement.jsonl`、`check.jsonl`
  - `planning`、`in_progress`、`completed`
- 新增步骤打印规则：
  - 开始步骤：`📌步骤 X.Y 开始执行`
  - 完成步骤：`✅步骤 X.Y 执行完成`
  - 跳过步骤：`⏭️步骤 X.Y 跳过，跳过原因：<原因>`
- 新增规范读写提示：
  - 读规范：`🦆正在读规范<文件名>.md`
  - 写规范：`🦆正在写规范<文件名>.md`
- 新增 SVN 规则：
  - 如果项目使用 SVN 而不是 Git，步骤 3.4 跳过，直接走 3.5。
  - 归档时再让用户决定是否执行 `svn commit`。

版本演进：

```text
0.5.18-cn.0  第一版半中文 workflow
0.5.18-cn.1  优化 workflow 注释和用户可见提示
0.5.18-cn.2  新增步骤打印、规范读写提示、SVN 规则
```

## 3. 安装

安装中文 fork：

```bash
npm install -g @sad678/trellis@cn
```

固定安装当前版本：

```bash
npm install -g @sad678/trellis@0.5.18-cn.2
```

检查命令：

```bash
trellis --help
trellis --version
```

Windows PowerShell 如果命令被执行策略影响，可以尝试：

```powershell
trellis.cmd --help
```

注意：目前命令仍是 `trellis` 和 `tl`，还没有改成 `trellis-cn`。

## 4. 初始化新项目

进入项目根目录：

```bash
cd your-project
```

执行初始化：

```bash
trellis init
```

带开发者名：

```bash
trellis init -u your-name
```

按平台初始化，例如只给 Codex 生成配置：

```bash
trellis init --codex -u your-name
```

多个平台一起初始化：

```bash
trellis init --cursor --opencode --codex -u your-name
```

初始化后通常会生成这些内容：

```text
.trellis/
  workflow.md
  config.yaml
  spec/
  tasks/
  workspace/
  scripts/

.codex/ 或 .agents/ 或 .claude/ 等平台目录
```

具体生成哪些平台目录，取决于你传入的 `--codex`、`--cursor`、`--claude` 等参数。

## 5. 已初始化项目如何更新中文 workflow

如果项目以前已经运行过 Trellis 初始化，后续想同步这个中文 fork 的模板：

```bash
trellis update
```

建议先预览：

```bash
trellis update --dry-run
```

如果你维护的是团队项目，更新前先确认当前分支干净：

```bash
git status --short
```

更新后重点检查：

```text
.trellis/workflow.md
.trellis/spec/
.codex/
.agents/
```

如果本地项目已经手动改过 workflow，`trellis update` 可能会提示冲突或跳过，需要人工合并。

## 6. 已初始化项目中加入自己的工作区

如果项目已经由别人初始化好了，你不想重新 `trellis init`，只想添加自己的开发者身份，可以在项目根目录执行：

```bash
python ./.trellis/scripts/init_developer.py your-name
```

Windows PowerShell：

```powershell
python .\.trellis\scripts\init_developer.py your-name
```

如果 `python` 不可用，试：

```powershell
py -3 .\.trellis\scripts\init_developer.py your-name
```

这会创建：

```text
.trellis/.developer
.trellis/workspace/your-name/
```

通常：

- `.trellis/.developer` 是本机当前开发者指针，不提交。
- `.trellis/workspace/your-name/` 是你的个人工作区，是否提交由团队约定决定。

官方也支持在已存在 Trellis 的仓库里再次运行 `trellis init -u your-name` 来加入项目。这个方式适合你已经安装了 Trellis CLI，并希望它顺手检查/补齐平台配置。

## 7. 日常开发流程

Trellis 的核心流程是：

```text
Phase 1: Plan
Phase 2: Execute
Phase 3: Finish
```

常用命令：

```bash
python ./.trellis/scripts/task.py create "实现登录功能"
python ./.trellis/scripts/task.py current --source
python ./.trellis/scripts/task.py start <task-dir>
python ./.trellis/scripts/task.py list
python ./.trellis/scripts/task.py archive <task-dir>
```

典型流程：

1. 用户描述需求。
2. AI 根据 workflow 创建 task。
3. AI 和用户一起澄清需求，写 `prd.md`。
4. AI 整理 `implement.jsonl` 和 `check.jsonl`。
5. AI 进入实现和检查阶段。
6. 完成后执行收尾流程，归档 task，沉淀经验到 spec。

在本中文 fork 中，AI 执行步骤时应该打印：

```text
📌步骤 X.Y 开始执行
✅步骤 X.Y 执行完成
⏭️步骤 X.Y 跳过，跳过原因：<原因>
```

读写规范时应该打印：

```text
🦆正在读规范<文件名>.md
🦆正在写规范<文件名>.md
```

## 8. 多人协作怎么做

推荐团队约定：

```text
.trellis/spec/      团队规范，建议提交并 code review
.trellis/tasks/     任务 PRD、上下文、状态，建议跟功能分支一起提交
.trellis/workspace/ 个人 journal，可按团队习惯决定是否提交
.trellis/.developer 本机身份指针，不提交
```

多人协作的好处：

- 所有人和 AI 都读同一套项目规范。
- 每个需求都有 PRD 和上下文记录，方便 review。
- 新人拉仓库后能看到历史任务、规范和工作流。
- 团队经验可以沉淀回 `.trellis/spec/`，后续自动复用。
- Codex、Claude、Cursor 等不同工具可以复用同一套项目 workflow。

如果项目已经提交了 Trellis 生成文件，普通开发者通常不需要全局安装 `trellis`。需要安装 CLI 的场景主要是：

- 新项目要执行 `trellis init`
- 已有项目要执行 `trellis update`
- 要执行 `trellis uninstall`
- 要重新生成或修复平台配置
- 项目没有完整提交 `.trellis/` 和平台目录

只用 Codex/Claude/Cursor 开发时，拉仓库后通常可以直接使用项目内已有配置。

## 9. 官方版和中文版同时使用

官方包：

```text
@mindfoldhq/trellis
```

中文 fork：

```text
@sad678/trellis
```

两个包都注册同样的全局命令：

```text
trellis
tl
```

所以全局同时安装时，谁最后安装，`trellis` 就指向谁。

推荐用 `npx` 或 `npm exec` 指定包：

```bash
npx @sad678/trellis@cn init
npx @mindfoldhq/trellis init
```

更明确：

```bash
npm exec --package @sad678/trellis@cn -- trellis init
npm exec --package @mindfoldhq/trellis -- trellis init
```

如果想全局切到中文 fork：

```bash
npm uninstall -g @mindfoldhq/trellis
npm install -g @sad678/trellis@cn
```

## 10. 卸载

从项目中移除 Trellis 生成文件：

```bash
trellis uninstall
```

预览删除内容：

```bash
trellis uninstall --dry-run
```

全局卸载中文 fork：

```bash
npm uninstall -g @sad678/trellis
```

## 11. 发布 npm 包

当前 fork 的发布命令示例：

```bash
cd packages/cli
npm publish --tag cn --access public --ignore-scripts
```

这次 Windows 上发布使用了 `--ignore-scripts`，因为原 `prepublishOnly` 依赖裸 `pnpm` 和 Unix 风格 `cp`，在当前环境里不稳定。

发布前建议验证：

```powershell
cd packages\cli
.\node_modules\.bin\vitest.CMD run test\templates\trellis.test.ts
.\node_modules\.bin\tsc.CMD --noEmit
node scripts/copy-templates.js
npm pack --dry-run --ignore-scripts
```

安全注意：

- 不要把 npm token 写入仓库。
- 不要提交 `.npmrc` 中的 `_authToken`。
- 如果用临时 `.npmrc` 发布，发布后立即删除。

检查 npm 发布结果：

```bash
npm view @sad678/trellis@0.5.18-cn.2 version
npm dist-tag ls @sad678/trellis
```

期望：

```text
cn: 0.5.18-cn.2
```

## 12. 推送到自己的 GitHub fork

本项目使用 SSH 推送：

```bash
git remote add cn-origin git@github.com:CYJ316457/trellis-cn.git
git push -u cn-origin main
```

如果后续把自己的仓库设为默认 remote，可以整理 remote：

```bash
git remote rename origin upstream
git remote rename cn-origin origin
```

整理后：

```text
origin   -> 你的 fork: CYJ316457/trellis-cn
upstream -> 官方仓库: mindfold-ai/Trellis
```

本仓库目前有一个较大的演示文件：

```text
assets/trellis-demo-zh.gif
```

它约 58 MB，超过 GitHub 推荐的 50 MB。GitHub 会提示警告，但仍可推送。后续如果继续放大文件，建议改用 Git LFS。

## 13. 后续同步官方更新

首次添加官方源：

```bash
git remote add upstream https://github.com/mindfold-ai/Trellis.git
git fetch upstream
```

以后同步官方：

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

重点关注冲突文件：

```text
README.md
packages/cli/package.json
packages/cli/src/templates/trellis/workflow.md
packages/cli/test/templates/trellis.test.ts
```

合并后检查你的中文 fork 定制是否仍然保留：

```bash
git diff upstream/main -- packages/cli/package.json packages/cli/src/templates/trellis/workflow.md README.md
```

如果官方升级到 `0.5.19`，你的中文版本可以改成：

```json
"version": "0.5.19-cn.0"
```

然后重新验证、发布并推送：

```bash
cd packages/cli
.\node_modules\.bin\vitest.CMD run test\templates\trellis.test.ts
.\node_modules\.bin\tsc.CMD --noEmit
node scripts/copy-templates.js
npm pack --dry-run --ignore-scripts
npm publish --tag cn --access public --ignore-scripts
```

```bash
git add README.md packages/cli/package.json packages/cli/src/templates/trellis/workflow.md packages/cli/test/templates/trellis.test.ts
git commit -m "chore: sync upstream and publish cn build"
git push origin main
```

## 14. 常见问题

### 已经初始化过项目，对方还要安装 npm 包吗？

通常不需要。

如果 `.trellis/`、`.codex/`、`.agents/` 等生成文件已经提交进仓库，普通开发者只是使用 Codex 或其他 agent 开发时，可以直接拉项目使用。

需要安装 `@sad678/trellis@cn` 的情况：

- 对方要初始化新项目。
- 对方要更新 Trellis 模板。
- 对方要卸载 Trellis。
- 对方要修复或重新生成平台配置。

### 我只想加入自己的工作区，不想重新初始化，怎么做？

执行：

```bash
python ./.trellis/scripts/init_developer.py your-name
```

### 我应该提交 `.trellis/workspace/` 吗？

看团队约定。

推荐：

- `.trellis/spec/` 提交。
- `.trellis/tasks/` 随功能分支提交。
- `.trellis/workspace/` 可选择提交重要记录，或者只把重要经验沉淀到 spec。
- `.trellis/.developer` 不提交。

### SVN 项目怎么办？

本 fork 的 workflow 已写明：

- 如果项目使用 SVN 而不是 Git，步骤 3.4 跳过。
- 直接进入 3.5。
- 归档时再让用户决定是否执行 `svn commit`。

## 15. 参考资料

- Trellis 官方快速开始：https://docs.trytrellis.app/zh/start/install-and-first-task
- Trellis 官方支持平台：https://docs.trytrellis.app/zh/advanced/multi-platform
- Trellis 官方 FAQ：https://docs.trytrellis.app/zh/faq
- Trellis 官方仓库：https://github.com/mindfold-ai/Trellis
- 中文 fork 仓库：https://github.com/CYJ316457/trellis-cn
- 中文 fork npm 包：https://www.npmjs.com/package/@sad678/trellis
