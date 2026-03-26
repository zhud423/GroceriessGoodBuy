# GroceriessGoodBuy 代码审查报告

> 审查时间：2026-03-25 | 涵盖所有源码文件  
> 总体评价：项目架构清晰，合约层（Zod）和领域层分离做得好。以下按严重程度分 P0/P1/P2 列出问题和修改方案。

---

## 总体代码质量评估

这是一个质量 **中上水平**（约 7/10）的项目，不属于"代码质量低"的范畴。

### ✅ 核心架构亮点
- **分层架构**：`shared → contracts → domain → db → server` 职责清晰，monorepo 依赖方向正确。
- **合约层（Zod）**：请求/逻辑/响应全部有 schema 校验，类型安全贯穿前后端。
- **错误规范化**：统一的 `RouteError` 处理，区分了普通错误与 fieldErrors（字段级校验错误）。
- **安全设计**：HMAC 签名 token、包含防时序攻击比较、signed URL 天然带有 TTL。
- **领域解耦**：像商品名归一化、评分匹配等逻辑全部独立为了可单独测试的纯函数模块。

### ⚠️ 关于本报告中的问题
报告中指出的 P0 和 P1 问题（例如巨型 Service 文件、代码重复）是 **典型的"快速迭代债务"**，而不是因为缺乏基本的架构设计能力。这些问题在大规模重构或随着项目生命周期延长时会成为阻碍，因此需要被妥善管理和偿还。

---

## P0 — 严重问题（应立即修复）

### 1. `imports/service.ts` 巨型文件 — 2450 行

**问题**：单文件 63KB、2450 行，包含了会话创建、图片上传、AI 分析、候选匹配、草稿更新、预备订单同步、提交、确认等 **所有** 导入流程逻辑，严重违反单一职责原则。

**影响**：难以阅读、测试、code review，并发修改容易冲突。

**修改方案**：按职责拆分为 4~5 个模块：

| 新模块 | 职责 |
|---|---|
| `imports/candidate-matching.ts` | `tokenize`, `score`, `loadCandidatePool`, `findCandidateMatches` |
| `imports/draft-resolution.ts` | `deriveDraftReviewStatus`, `resolveNextState`, `applyDraftUpdate` |
| `imports/prepared-order.ts` | `syncPreparedOrder`, `cleanupPreparedOrderDraft`, `isReadyForPreparedOrder` |
| `imports/commit.ts` | `commitImportSession`, `confirmImportSession`, `finalizeCommitted` |
| `imports/service.ts` | 保留入口函数 + 调度（`create`, `upload`, `analyze`, `getDetail`）|

---

### 2. `ensureOwnedProduct` 和 `refreshProductOrderAggregates` 重复实现

**问题**：这两个函数分别在 `imports/service.ts` 和 `orders/service.ts` 中有 **完全相同** 的实现。`upsertProductAlias` 同理。

**修改方案**：抽取到 `src/server/products/helpers.ts` 中统一导出，两处 import 引用。

---

### 3. `refreshProductOrderAggregates` 发起 3 次独立查询

**问题**：每次调用执行 3 个 `findFirst` 查询（最新订单、最早平台订单、最晚平台订单），都在相同的表上执行。在 commit 流程中对每个 `touchedProductId` 循环调用，产生 **O(N×3)** 次数据库查询。

**修改方案**：
- 合并为 1 条 SQL（使用 `$queryRaw` 或 Prisma aggregation）一次拿到 `lastPurchasedAt`、`firstSeenAt`、`lastSeenAt`。
- 对多个 productId 可以用 `GROUP BY` 批量查询而不是循环。

---

### 4. `getConfiguredProvider()` 每次调用都重新读取环境变量

**问题**：`vision.ts` 中 `getConfiguredProvider()` 在 `analyzeOrderImages` 每次调用时都重新解析环境变量，创建新的 Provider 实例。

**修改方案**：使用模块级懒初始化单例：

```typescript
let cachedProvider: VisionProvider | null = null

function getConfiguredProvider() {
  if (!cachedProvider) {
    cachedProvider = buildProvider()  // 原有逻辑
  }
  return cachedProvider
}
```

---

## P1 — 重要改进

### 5. `signed URL` 内存缓存无上限、无淘汰

**问题**：`storage.ts` 用 `Map` 做 signed URL 缓存，没有 `maxSize` 限制。长期运行的进程会导致内存无限增长。

**修改方案**：
- 选项 A：使用 LRU 缓存（如 `lru-cache` 库），设置 maxSize 比如 10000。
- 选项 B：在 `createSignedStorageUrl` 时检查缓存大小，超限清理最旧条目。

---

### 6. `background-tasks.ts` 无超时和重试机制

**问题**：后台任务（AI 分析、提交后处理）没有超时控制。如果 LLM 调用或 storage 操作 hang 住，任务会永远阻塞，且 `registry` 中的 key 不会被清理。

**修改方案**：
- 添加 `AbortController` + `setTimeout` 做超时控制（比如 5 分钟）
- 在 `finally` 中确保 registry 清理
- 考虑添加重试计数器

---

### 7. `test-auth.ts` 密码用明文比较

**问题**：`test-auth.ts` 用 `===` 直接比较密码。虽然标注了 "test" 用途，但存在时序攻击（timing attack）风险。

**修改方案**：使用 `timingSafeEqual` 做密码比较，或至少加注释标明意图只用于内部测试。

---

### 8. `auth.ts` 用户查找逻辑复杂且路径不一致

**问题**：`auth.ts` 的 `requireAppUser` 第二条路径的 `findFirst` **没有唯一约束保护**（`username` 在 schema 中没有 `@unique`），理论上可能匹配到多个用户。

**修改方案**：在 `prisma/schema.prisma` 中给 `User.username` 添加 `@unique` 约束。

---

### 9. Prisma schema 缺少 `deleteAt`（软删除）支持

**问题**：`Order` 和 `Product` 没有软删除机制。`Order` 有 `status: DRAFT | ACTIVE` 但没有 `DELETED`/`CANCELLED` 状态。

**修改方案**：
- 若需恢复数据，添加 `deletedAt DateTime?` 字段。
- 若暂不需要，至少给 `OrderStatus` 添加 `CANCELLED` 枚举值。

---

### 10. 缺少自动化测试

**问题**：整个项目 **没有任何测试文件**。

**修改方案**：优先为 `packages/domain` 的纯函数和 `packages/contracts` 的 Zod schema 添加自动化测试。

---

## P2 — 改进建议

### 11. 类型不安全的 `PlatformCode` 强制转换

**问题**：多处使用 `as PlatformCode` 强转，绕过了类型检查。

**修改方案**：在 `@life-assistant/shared` 中导出类型守卫 `isPlatformCode`。

---

### 12. `seed.ts` 使用串行 upsert 而非批量操作

**问题**：`seed.ts` 用 `for...of` + `upsert` 逐条插入。

**修改方案**：使用 `Promise.all` 或 `createMany` 做批量操作。

---

### 13. 日志和可观测性不足

**问题**：仅在错误路径有 `console.error`。没有结构化日志、没有请求级别的 tracing。

**修改方案**：引入 `pino` 或类似的结构化日志库，并为关键请求加 execution trace。

---

## 修改优先级建议

| 优先级 | 编号 | 工作量 | 收益 |
|---|---|---|---|
| **立即** | #1 巨型文件拆分 | 中 | 高 |
| **立即** | #2 消除重复代码 | 小 | 高 |
| **本周** | #3 查询优化 | 中 | 中 |
| **本周** | #4 Provider 单例 | 小 | 中 |
| **本周** | #5 缓存上限 | 小 | 中 |

---

## 附录：Phase 1 修复执行记录 (Walkthrough)

本节记录了在初次代码审查期间发现的 6 个孤立、非破坏性问题的修复实施总结。

### 1. 抽取共享的产品及业务 Helper (#2 & #3)
将 `imports` 和 `orders` 服务中重复的帮助函数抽取到了统一模块中，减少了约 400 行代码重复。同时优化了 `refreshProductOrderAggregates` 内部的合并聚合查询逻辑。
- **[NEW]** `apps/web/src/server/products/helpers.ts` created.
- **[MODIFIED]** `apps/web/src/server/imports/service.ts` updated to use shared helpers.
- **[MODIFIED]** `apps/web/src/server/orders/service.ts` updated to use shared helpers.

### 2. Vision Provider 单例化 (#4)
AI 模型 provider 实例在模块级进行了缓存。避免了每次 API 调用重复读取环境变量和实例化提供者。
- **[MODIFIED]** `apps/web/src/server/imports/vision.ts`

### 3. Signed URL 缓存内存上限配置 (#5)
为了防止不受限制的内存无限增长，给 Supabase signed URL 内存缓存加了 `5,000` 个条目的最高上限限制。并实现了一个类似 LRU 的淘汰策略，在容量超标时主动清理过期和最旧的缓存记录。
- **[MODIFIED]** `apps/web/src/server/storage.ts`

### 4. 后台任务执行超时保险 (#6)
对所有手动调用或挂载后台的异步任务默认加上 `5分钟` 的执行超时配置。这将保证任何 hung 住的任务（如等不到超时的 AI 接口报错响应）都会通过 `Promise.race` 被强行中止执行并从全局任务池 `registry` 里正确清楚。
- **[MODIFIED]** `apps/web/src/server/background-tasks.ts`

### 5. 高安全性的密码比较 (#7)
修正了测试辅助验证账户模块，换用 `timingSafeEqual` 对获取到的明文密码和内存设置的测服密码相比。阻止时间差攻击(timing attacks)带来的相关潜在理论风险。
- **[MODIFIED]** `apps/web/src/server/test-auth.ts`

### 6. PlatformCode 引入了标准类型守卫判定 (#11)
为平台级 `PlaformCode` 添加了严密的运行时 `isPlatformCode` 判定帮助函数。可免去不严格的类型 `as PlatformCode` 带来隐性异常。
- **[MODIFIED]** `packages/shared/src/platforms.ts`
