<p align="center">
<picture>
<source srcset="assets/trellis.png" media="(prefers-color-scheme: dark)">
<source srcset="assets/trellis.png" media="(prefers-color-scheme: light)">
<img src="assets/trellis.png" alt="Trellis Logo" width="500" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;">
</picture>
</p>

<p align="center">
<strong>Trellis 中文工作流分支</strong><br/>
<sub>基于 mindfold-ai/Trellis 的中文化 fork，默认初始化半中文 workflow，并保留原 Trellis 的命令、目录结构与机器契约。</sub>
</p>

<p align="center">
<a href="https://www.npmjs.com/package/@sad678/trellis"><img src="https://img.shields.io/npm/v/@sad678/trellis/cn.svg?style=flat-square&color=2563eb" alt="npm cn version" /></a>
<a href="https://www.npmjs.com/package/@sad678/trellis"><img src="https://img.shields.io/npm/dw/@sad678/trellis?style=flat-square&color=cb3837&label=downloads" alt="npm downloads" /></a>
<a href="https://github.com/CYJ316457/trellis-cn"><img src="https://img.shields.io/badge/fork-CYJ316457%2Ftrellis--cn-0f766e?style=flat-square" alt="fork repository" /></a>
<a href="https://github.com/mindfold-ai/Trellis/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-16a34a.svg?style=flat-square" alt="license" /></a>
</p>

<p align="center">
<img src="assets/trellis-demo-zh.gif" alt="Trellis 工作流演示" width="100%">
</p>

## 这个 fork 改了什么

这个仓库主要做中文化与工作流提示增强，核心代码仍沿用官方 Trellis：

- npm 包名改为 `@sad678/trellis`。
- 当前中文发布版本为 `0.5.18-cn.4`，`cn` dist-tag 指向该版本。
- `trellis init` 初始化出的 `.trellis/workflow.md` 已中文化说明性文字、流程描述和用户可见提示。
- 保留机器契约不变：`[workflow-state:no_task]` 等标签名、`[/workflow-state:...]` 结束标签、`task.py create`、`implement.jsonl`、`check.jsonl`、`planning`、`in_progress`、`completed` 等命令名、路径和值都不改。
- 新增步骤打印规则：执行步骤前打印 `📌步骤 X.Y 开始执行`，完成后打印 `✅步骤 X.Y 执行完成`，跳过时打印 `⏭️步骤 X.Y 跳过，跳过原因：<原因>`。
- 新增规范读写提示：读取规范前打印 `🦆正在读规范<文件名>.md`，写入规范前打印 `🦆正在写规范<文件名>.md`。
- 新增 SVN 规则：如果项目使用 SVN 而不是 Git，步骤 3.4 跳过，直接走 3.5，归档时再让用户决定是否执行 `svn commit`。
- 新增 `force` skill / command：可以要求后续修改强制按 Trellis 全流程顺序执行，不跳步、不乱序。
- 新增归档总结：归档后生成 task 内 `summary.md`，并追加到 `.trellis/workspace/<developer>/WeeklyReportMM-DD.md`。
- 新增周报/月报 skill 与 command：`weekly-report` 汇总最近 7 天，`monthly-report` 汇总当月 1 号到当前时间，最后统一输出修改文件总览。

## 前置要求

- **Node.js** >= 18
- **Python** >= 3.9

## 安装

安装中文 fork：

```bash
npm install -g @sad678/trellis@cn
```

也可以固定到当前版本：

```bash
npm install -g @sad678/trellis@0.5.18-cn.4
```

安装后命令仍然是官方同名命令：

```bash
trellis --help
tl --help
```

注意：目前没有改成 `trellis-cn` 命令。`@sad678/trellis` 和官方 `@mindfoldhq/trellis` 都注册 `trellis` / `tl`，全局同时安装时谁最后安装，命令就指向谁。

## 初始化和更新

在你的项目根目录执行：

```bash
trellis init
```

如果要带开发者名：

```bash
trellis init -u your-name
```

如果项目已经初始化过 Trellis，要把这个中文 fork 的 workflow 同步进去：

```bash
trellis update
```

常见平台参数仍然沿用官方用法，例如：

```bash
trellis init --codex -u your-name
trellis init --cursor --opencode --codex -u your-name
```

## 和官方版同时使用

全局安装时不建议同时装官方版和这个 fork，因为命令名冲突：

```bash
trellis
tl
```

推荐用 `npx` / `npm exec` 临时指定包：

```bash
npx @sad678/trellis@cn init
npx @mindfoldhq/trellis init
```

更明确的写法：

```bash
npm exec --package @sad678/trellis@cn -- trellis init
npm exec --package @mindfoldhq/trellis -- trellis init
```

如果要全局切到这个中文 fork：

```bash
npm uninstall -g @mindfoldhq/trellis
npm install -g @sad678/trellis@cn
```

## 卸载

从项目里移除 Trellis 生成的文件：

```bash
trellis uninstall
```

先预览将删除什么：

```bash
trellis uninstall --dry-run
```

全局卸载中文 fork：

```bash
npm uninstall -g @sad678/trellis
```

## 如何使用

Trellis 的日常工作流保持不变：

1. 用自然语言告诉 AI 你要做什么。
2. AI 按 workflow 进入规划、需求澄清、调研、实现、检查和收尾。
3. task 相关文件会写入 `.trellis/tasks/`。
4. 项目规范保存在 `.trellis/spec/`，按任务注入给 AI。
5. 工作完成后使用 `/trellis:finish-work` 或对应平台命令收尾归档。

这个 fork 只是让 workflow 更适合中文协作，并要求 AI 在关键步骤打印更明确的执行状态。

### 新增命令和技能

- `force`：后续修改必须按 Trellis 流程顺序执行，适合你想强制 agent 不跳流程时使用。
- `weekly-report`：读取 `.trellis/workspace/<developer>/WeeklyReportMM-DD.md`，默认汇总最近 7 天，输出 `WeeklyReportMM-DD~MM-DD.md`。
- `monthly-report`：读取 `.trellis/workspace/<developer>/WeeklyReportMM-DD.md`，默认汇总当月 1 号到当前时间，输出 `MonthlyReportYYYY-MM-01~YYYY-MM-DD.md`。
- 周报和月报最后一节都会汇总所有修改文件，便于复盘和交付。

## 本次对话沉淀的重要提示

- npm 发布使用的是 `@sad678/trellis`，不是官方 `@mindfoldhq/trellis`。
- `0.5.18-cn.0` 是第一版半中文 workflow，`0.5.18-cn.1` 优化了 workflow 注释，`0.5.18-cn.2` 新增步骤打印、规范读写提示和 SVN 跳过 3.4 规则，`0.5.18-cn.4` 新增 force、归档总结、周报和月报能力。
- 安装中文版本请用 `npm install -g @sad678/trellis@cn`，不要只看 `latest`；当前 `latest` 仍可能不是中文版本。
- 初始化新项目仍然使用 `trellis init`；已有项目使用 `trellis update` 更新 workflow。
- 如果同时需要官方版和中文版，优先用 `npm exec --package ... -- trellis ...` 指定包，避免全局命令冲突。
- 发布 npm 时不要把 token 写入仓库；可以用临时 `.npmrc` 或 npm 登录态，发布后清理。
- GitHub 推送使用 SSH remote：`git@github.com:CYJ316457/trellis-cn.git`。
- 当前仓库里 `assets/trellis-demo-zh.gif` 大约 58 MB，GitHub 会提示超过推荐大小 50 MB，但推送仍可成功；后续可以考虑 Git LFS。

## 资源

| 需求 | 链接 |
| --- | --- |
| 中文 fork 仓库 | [CYJ316457/trellis-cn](https://github.com/CYJ316457/trellis-cn) |
| 中文 fork npm 包 | [@sad678/trellis](https://www.npmjs.com/package/@sad678/trellis) |
| 官方仓库 | [mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis) |
| 官方中文文档 | [docs.trytrellis.app/zh](https://docs.trytrellis.app/zh) |
| 官方快速开始 | [安装和第一个任务](https://docs.trytrellis.app/zh/start/install-and-first-task) |
| 官方支持平台 | [支持平台](https://docs.trytrellis.app/zh/advanced/multi-platform) |

## 许可证

本 fork 继承官方 Trellis 的 AGPL-3.0-only 许可证。

<p align="center">
<a href="https://github.com/CYJ316457/trellis-cn">中文 fork</a> ·
<a href="https://github.com/mindfold-ai/Trellis">官方仓库</a> ·
<a href="https://github.com/mindfold-ai/Trellis/blob/main/LICENSE">AGPL-3.0 License</a>
</p>
