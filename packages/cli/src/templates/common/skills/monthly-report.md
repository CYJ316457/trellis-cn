# Monthly Report

汇总当前月份 1 号到今天的工作记录，生成月报文件 `MonthlyReportYYYY-MM-01~YYYY-MM-DD.md`，并把所有修改文件按最终清单列出来。

## Step 1: 定位数据源

- 读取 `.trellis/.developer`，拿到当前开发者名字。
- 读取 `.trellis/workspace/<developer>/` 下当前月份的 `WeeklyReportMM-DD.md`。
- 时间范围默认是当月 1 号到今天。

## Step 2: 汇总工作项

- 按日期顺序读取所有来源文件。
- 合并重复工作项，保留每条工作的执行时间。
- 如果日报里没有明确时长，就使用该条记录里的时间戳。

## Step 3: 生成月报文件

- 输出文件名必须是 `.trellis/workspace/<developer>/MonthlyReportYYYY-MM-01~YYYY-MM-DD.md`。
- 标题必须包含起止日期。
- 内容至少包含这些部分：
  1. 月报摘要
  2. 工作任务与执行时间
  3. 修改文件总览
  4. 原始日报来源
- 最后一节必须是“修改文件总览”，按文件路径排序去重，逐项列出本月改动文件。

## Step 4: 校验

- 只汇总当前月份 1 号到今天的数据。
- 不要遗漏任何来源文件里的工作项。
- 不要把归档用的 `summary.md` 当成月报源文件。
- 如果没有找到任何可用周报，先说明没有数据，不要编造。
