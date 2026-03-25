# 导入订单主流程重构方案（2026-03-25）

- Date: 2026-03-25
- Status: Draft
- Scope: Product + Technical Design
- Related PRD: [PRD_life_assistant_phase1.md](/Users/dong/Documents/GroceriessGoodBuy/PRD_life_assistant_phase1.md)
- Related Technical Design: [TECHNICAL_DESIGN_life_assistant_phase1.md](/Users/dong/Documents/GroceriessGoodBuy/TECHNICAL_DESIGN_life_assistant_phase1.md)
- Related Retrospective: [IMPORT_FLOW_PERFORMANCE_RETROSPECTIVE_2026-03-24.md](/Users/dong/Documents/GroceriessGoodBuy/IMPORT_FLOW_PERFORMANCE_RETROSPECTIVE_2026-03-24.md)

## 1. 当前产品事实

当前实现里，导入链路在技术上仍以 `import session / item drafts / commit` 为主线，这本身没有错。

问题不在于服务端保留了草稿边界，而在于这些技术概念直接暴露到了产品界面：

1. 用户先进入上传页，再进入“导入草稿”页。
2. 页面上直接出现“草稿”“校对”“保存订单信息”“保存商品项”“保存全部商品项”等字眼和按钮。
3. 首页同时摆出 `导入订单截图`、`手动新增商品`、`手动新增订单` 三个并列主入口。

这会让当前产品的主流程显得分叉且不完整。

对当前产品来说，用户真正想完成的不是“管理草稿”，而是：

`导入订单 -> 系统解析 -> 用户确认 -> 生成订单`

因此，把草稿继续当成 UI 主概念，不是未来优化问题，而是当前产品基线应该收口的地方。

## 2. 本次重构结论

本次重构明确采用以下产品结论：

1. 用户侧主流程统一叫 `导入订单`。
2. `草稿` 仅保留为服务端内部实现边界，不再作为 UI 概念暴露。
3. `截图导入页` 和 `草稿页` 在产品体验上合并为同一条连续页面流程。
4. 上传完成后先展示截图，再等待解析结果刷新到同一页面。
5. 识别完成后，用户做的是 `确认订单`，不再叫 `校对`。
6. 页面只保留一个主动作按钮：`确认订单`。
7. 首页定位回到 dashboard，只保留 `导入订单` 主入口。

## 3. 产品目标与非目标

### 3.1 产品目标

本次重构要解决的，是当前产品主流程表达不完整的问题。

目标是：

1. 让用户在首屏就理解“系统的主入口是导入订单”。
2. 让用户在单一页面里完成上传、等待解析、确认订单。
3. 让状态提示只表达用户关心的进度，而不是技术内部状态。
4. 把确认前的字段编辑收敛到一个统一动作里，而不是多个保存按钮。

### 3.2 非目标

本次重构不要求同步推翻现有服务端模型。

以下内容不作为这轮必须目标：

1. 删除 `import_sessions / import_item_drafts` 表。
2. 立即下掉 `手动新增商品` 和 `手动新增订单` 的全部页面与接口。
3. 一次性重命名所有服务端 DTO、数据库字段和 API 路径。

这些可以后续再做，但不应阻塞当前产品主流程收口。

## 4. 目标用户流程

目标用户流程应收敛为：

1. 用户从 dashboard 点击 `导入订单`。
2. 用户选择一张或多张订单截图。
3. 系统创建导入会话，上传图片，并立即开始后台解析。
4. 页面刷新到同一导入页，先展示截图和“正在解析订单”的状态。
5. 大模型解析完成后，页面自动刷新为“待确认订单”状态。
6. 用户检查并修改平台、下单时间、商品项等识别结果。
7. 用户点击唯一主按钮 `确认订单`。
8. 系统保存变更并生成正式订单。
9. 用户进入订单详情，后台再继续处理图片复制、商品归档等后置任务。

这条流程里，用户不需要理解“草稿已创建”“草稿已保存”“commit”等中间概念。

## 5. 信息架构调整

### 5.1 首页 / Dashboard

首页继续作为总览页和数据看板，不改其 dashboard 定位。

但首页快捷入口需要收口为：

1. 保留 `导入订单` 主 CTA。
2. 去掉 `手动新增商品` 主 CTA。
3. 去掉 `手动新增订单` 主 CTA。

首页仍然可以保留：

1. 最近商品
2. 最近订单
3. 库存预警
4. 数据统计卡片

也就是说：

- 首页保留“看板”和“继续导入”的职责。
- 首页不再承担“让用户决定手动建商品还是手动建订单”的职责。

### 5.2 导入页

产品上应视为同一个 `导入订单页`，不再区分：

1. 上传页
2. 草稿页

页面只是根据进度切换不同状态：

1. 待上传
2. 上传中
3. 解析中
4. 待确认
5. 确认中
6. 已完成
7. 失败

### 5.3 路由建议

产品体验合并，不等于必须先把路由结构完全推翻。

推荐采用分两层理解：

1. 产品层：只有一个“导入订单页”概念。
2. 技术层：仍可保留 `/imports/new` 与 `/imports/[id]` 两个 URL，用同一个 Screen 组件承载。

这样做的好处是：

1. 不破坏现有导入会话可恢复能力。
2. 不需要为了“看起来是一个页面”先重构整个路由语义。
3. 可以先完成主要交互收口，再决定是否进一步合并 URL。

因此，推荐做法不是先争论 URL 是否只剩一个，而是先让两条 URL 呈现同一页面体验。

## 6. 用户可见状态与文案

用户侧状态建议统一为以下表达：

| 内部条件 | 用户看到的状态 | 页面表现 |
| --- | --- | --- |
| 无会话或无截图 | 选择截图导入 | 展示上传区与说明 |
| 图片上传中 | 正在导入订单 | 主进度提示为上传中 |
| 图片已上传，分析任务运行中 | 正在解析订单 | 展示截图，隐藏草稿概念 |
| 分析完成，可编辑识别结果 | 待确认订单 | 展示订单信息与商品识别结果 |
| 用户点击确认后正在提交 | 订单导入中 | 按钮 loading，禁止重复提交 |
| 已生成订单 | 导入完成 | 跳转订单详情或显示完成提示 |
| 分析失败或提交失败 | 导入失败 | 展示失败原因与重试入口 |

### 6.1 页面主文案

推荐统一使用：

1. 页面标题：`导入订单`
2. 上传阶段：`上传并开始导入`
3. 分析阶段：`正在解析订单...`
4. 待确认阶段：`请确认订单信息`
5. 提交阶段：`订单导入中`
6. 完成阶段：`订单已导入`

### 6.2 需要移除的文案

以下文案不应再出现在用户界面：

1. 导入草稿
2. 草稿校对
3. 保存订单信息
4. 保存商品项
5. 保存全部商品项
6. 提交草稿
7. commit

### 6.3 字段区块建议命名

推荐将当前页面区块命名为：

1. `订单信息`
2. `商品内容`
3. `原始截图`
4. `导入状态`

不要再使用：

1. `订单级草稿`
2. `商品项草稿`
3. `提交前检查`

其中 `提交前检查` 可以改成更产品化的 `确认摘要`。

## 7. 交互重构要求

### 7.1 只保留一个主动作

在待确认状态，页面只保留一个主动作：

- `确认订单`

用户修改平台、时间、商品项后，不再逐块点击保存。

### 7.2 移除局部保存按钮

需要移除：

1. 保存订单信息
2. 保存商品项
3. 保存全部商品项

### 7.3 推荐的保存策略

因为局部保存按钮会被移除，所以技术上需要补足稳定规则。

推荐采用：

1. 页面编辑时本地状态立即更新。
2. 使用 `debounced auto-save` 自动保存修改。
3. 用户点击 `确认订单` 时，再统一做一次最终保存与提交。

原因是：

1. 如果完全不自动保存，用户刷新或离开页面可能丢失修改。
2. 如果仍要求用户手动保存，只是把按钮藏起来，本质上是把风险转给用户。

所以，对当前产品来说，`无保存按钮 + 自动保存` 才是完整方案。

### 7.4 导入创建页信息展示规则（2026-03-25）

导入创建页采用“最小可操作信息”原则：

1. 上传操作区与结果反馈区合并到同一个主卡片里。
2. 页面不再向用户展示“本次会做什么”的分步骤说明。
3. 流程步骤与实现细节只保留在产品/技术文档中，作为团队内部规则记录。

## 8. Dashboard 调整方案

### 8.1 当前要求

首页作为 dashboard，只保留 `导入订单` 的主入口。

### 8.2 建议处理方式

本轮先做以下调整：

1. 在 dashboard 上移除 `手动新增商品` 卡片。
2. 在 dashboard 上移除 `手动新增订单` 卡片。
3. 保留商品库、订单列表、库存看板等数据视图入口。

### 8.3 暂不做的事情

本轮不强制：

1. 删除 `/products/new`
2. 删除 `/orders/new`
3. 删除商品页、订单页中的新建入口

这些属于更大范围的“是否保留手动录入能力”决策，不应混入本次主流程收口。

也就是说：

- 本轮先改首页入口优先级。
- 后续再决定手动录入能力是否整体下沉或彻底退出。

## 9. 技术改造方案

### 9.1 前端结构

推荐将当前两个 Screen 合并为一个共享页面组件：

1. 当前上传页：[import-create-screen.tsx](/Users/dong/Documents/GroceriessGoodBuy/apps/web/src/components/imports/import-create-screen.tsx)
2. 当前确认页：[import-session-screen.tsx](/Users/dong/Documents/GroceriessGoodBuy/apps/web/src/components/imports/import-session-screen.tsx)

建议重构为：

1. 新建统一组件 `ImportOrderScreen`
2. `imports/new` 和 `imports/[id]` 都渲染这个组件
3. 组件内部根据是否已有 `importSessionId`、是否已上传、是否在分析、是否可确认来切换界面状态

这样可以实现真正的页面体验合并，而不是仅仅改几句文案。

### 9.2 前端状态映射

当前已存在的内部状态：

1. `status`
2. `isAnalyzing`
3. `isPreparingCommit`

前端应建立一层用户状态映射，而不是直接把内部状态透传给文案。

建议新增一个纯前端的派生状态：

1. `EMPTY`
2. `UPLOADING`
3. `ANALYZING`
4. `READY_FOR_CONFIRMATION`
5. `CONFIRMING`
6. `COMPLETED`
7. `FAILED`

然后 UI 只基于这个用户状态渲染。

### 9.3 前端交互改造点

需要做的改动包括：

1. 删除页面中所有 `草稿`、`校对` 字样。
2. 删除订单信息与商品项的单独保存按钮。
3. 将“重新分析”降为次级动作。
4. 将“确认订单”设为唯一主按钮。
5. 上传完成后即展示截图，不等待解析完成。
6. 解析完成后直接刷新为待确认结果。

### 9.4 首页改造点

需要修改的主要文件：

1. [dashboard-screen.tsx](/Users/dong/Documents/GroceriessGoodBuy/apps/web/src/components/dashboard/dashboard-screen.tsx)
2. [workspace-shell.tsx](/Users/dong/Documents/GroceriessGoodBuy/apps/web/src/components/layout/workspace-shell.tsx)

具体包括：

1. 首页只保留 `导入订单` 的主 CTA。
2. 页面标题和描述改成 dashboard 语义，不再强调“草稿校对”。
3. `/imports/new` 和 `/imports/[id]` 的页面 copy 统一改成 `导入订单`。

## 10. API 与服务端修改建议

### 10.1 保留内部草稿模型，但不再外露

当前服务端基于：

1. `import_sessions`
2. `import_item_drafts`
3. `prepared order`

这一层内部模型仍然有价值，因为：

1. 后台分析需要可恢复状态。
2. 刷新页面后仍要能继续确认。
3. 失败重试不能依赖纯前端本地状态。

因此，推荐结论是：

- 内部保留草稿模型。
- 产品界面隐藏草稿概念。

### 10.2 确认动作建议收敛为单一 API

当前前端依赖多个接口组合完成确认：

1. 更新订单级字段
2. 更新单个商品项
3. 更新批量商品项
4. commit

这与“页面只保留一个确认按钮”的目标不一致。

推荐新增一个面向页面主动作的接口，例如：

- `POST /api/import-sessions/:id/confirm`

请求体建议包含：

1. 订单级字段
2. 全量商品项确认结果
3. 可选的确认参数，例如是否自动标记库存

服务端在这个接口内完成：

1. 校验
2. 保存导入会话变更
3. 发布正式订单
4. 返回订单 ID

这样可以把“确认订单”真正收敛成单一动作。

### 10.3 旧接口的处理建议

旧接口不需要立刻删除。

建议策略：

1. 保留现有 `PATCH` 与 `commit` 接口，先作为内部兼容层。
2. 新 UI 优先接入 `confirm` 接口。
3. 等确认新交互稳定后，再考虑是否收缩旧接口使用范围。

### 10.4 DTO 命名是否立即重命名

短期内，不建议为了产品文案同步重命名所有 DTO 与服务端类型。

原因是：

1. 这类改动范围大，但用户无感。
2. 当前真正影响产品的是 UI 和页面动作，而不是内部类型名。

因此建议：

1. 第一阶段保留 `ImportSessionDetailDto / ImportItemDraftDto` 等内部命名。
2. 由前端把它们映射为“导入订单页面状态”。
3. 后续若 API 需要对外开放，再系统整理命名。

这属于可延后项，不是当前产品基线必须项。

## 11. 状态流转建议

产品层状态建议如下：

```text
待上传
  -> 上传中
  -> 解析中
  -> 待确认
  -> 确认中
  -> 已完成

任一阶段异常
  -> 失败
```

内部仍可继续保留：

1. `DRAFT`
2. `PROCESSING`
3. `REVIEW_REQUIRED`
4. `READY_TO_COMMIT`
5. `COMMITTED`
6. `FAILED`

但这些状态不应直接作为用户看到的页面主状态。

## 12. 建议实施顺序

### Phase 1：产品层收口

1. 首页只保留 `导入订单` 主入口。
2. 全站清理 `草稿 / 校对 / 提交草稿` 文案。
3. `WorkspaceShell` 中导入页标题统一改为 `导入订单`。

### Phase 2：页面合并

1. 合并 `ImportCreateScreen` 与 `ImportSessionScreen` 为同一个 `ImportOrderScreen`。
2. 统一上传态、解析态、确认态、完成态的布局和状态提示。
3. 上传完成后先展示截图，再等待解析结果刷新。

### Phase 3：动作收口

1. 删除订单信息和商品项的单独保存按钮。
2. 接入自动保存。
3. 页面只保留 `确认订单` 一个主动作。

### Phase 4：服务端接口收口

1. 新增 `confirm` 聚合接口。
2. 让前端不再串联多个 `PATCH + commit` 动作。
3. 旧接口进入兼容层。

## 13. 验收标准

完成后，应满足以下验收条件：

1. 首页不再出现 `手动新增商品` 和 `手动新增订单` 主入口。
2. 导入主流程中，用户看不到 `草稿`、`校对`、`commit` 相关字眼。
3. 上传截图后，页面立即展示截图，不跳到另一个语义完全不同的页面。
4. 大模型解析完成后，页面自动刷新并展示可确认的订单内容。
5. 用户确认前只需要操作一个主按钮：`确认订单`。
6. 页面上不再出现订单级和商品级的单独保存按钮。
7. 生成订单后能正常进入订单详情。

## 14. 受影响文件

首批受影响文件预计包括：

1. [apps/web/src/components/dashboard/dashboard-screen.tsx](/Users/dong/Documents/GroceriessGoodBuy/apps/web/src/components/dashboard/dashboard-screen.tsx)
2. [apps/web/src/components/layout/workspace-shell.tsx](/Users/dong/Documents/GroceriessGoodBuy/apps/web/src/components/layout/workspace-shell.tsx)
3. [apps/web/src/components/imports/import-create-screen.tsx](/Users/dong/Documents/GroceriessGoodBuy/apps/web/src/components/imports/import-create-screen.tsx)
4. [apps/web/src/components/imports/import-session-screen.tsx](/Users/dong/Documents/GroceriessGoodBuy/apps/web/src/components/imports/import-session-screen.tsx)
5. [apps/web/app/(workspace)/imports/new/page.tsx](/Users/dong/Documents/GroceriessGoodBuy/apps/web/app/(workspace)/imports/new/page.tsx)
6. [apps/web/app/(workspace)/imports/[id]/page.tsx](/Users/dong/Documents/GroceriessGoodBuy/apps/web/app/(workspace)/imports/[id]/page.tsx)
7. [apps/web/src/server/imports/service.ts](/Users/dong/Documents/GroceriessGoodBuy/apps/web/src/server/imports/service.ts)
8. [packages/contracts/src/imports.ts](/Users/dong/Documents/GroceriessGoodBuy/packages/contracts/src/imports.ts)

## 15. 对现有文档的影响

这份方案会直接影响以下文档中的部分表述：

1. PRD 中关于首页快捷入口同时包含 `手动新增商品`、`手动新增订单` 的部分。
2. PRD 与技术方案中将用户行为表述为 `校对草稿` 的部分。
3. 技术设计中“上传 -> 识别 -> 校对 -> 提交”的用户可见命名。

后续如果该方案确认执行，需要同步更新这些文档，避免文档体系继续沿用旧的产品表述。
