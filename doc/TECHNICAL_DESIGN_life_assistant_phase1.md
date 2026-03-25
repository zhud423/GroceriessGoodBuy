# 生活管家 Web 一期技术方案（面向未来 App 迁移）

- Date: 2026-03-23
- Status: Draft
- Related PRD: [PRD_life_assistant_phase1.md](/Users/dong/Documents/GroceriessGoodBuy/PRD_life_assistant_phase1.md)

## 1. 技术方案目标

本方案要同时满足两件事：

1. 当前尽快交付一个可用的 Web MVP。
2. 后续迁移到 iOS / Android App 时，不推倒重来。

因此，这不是“只为了 Web 页面跑起来”的方案，而是一个从第一天就按 `多端可复用后端能力` 组织的方案。

## 2. 当前技术约束

基于 PRD，一期的技术重点不是复杂交易，也不是高并发，而是以下四件事：

1. 多张订单截图上传与管理
2. 截图识别为结构化订单草稿
3. 商品去重与人工确认
4. 商品 / 订单 / 库存的稳定存储与查询

这意味着：

1. 数据模型必须稳定。
2. 导入流程必须可中断、可回看、可重试。
3. 识别结果不能直接写正式数据，必须先进入草稿态。
4. Web 前端不能和业务逻辑强耦合，否则 App 迁移成本会很高。

## 2.1 交付形态定义

这里的“交付形态”不是技术框架，而是用户最终如何访问和安装产品。

当前相关选项主要有：

1. 普通 Web：浏览器直接访问
2. PWA：本质仍是 Web，但支持安装到桌面
3. 原生 App：通过 iOS / Android App 安装使用

这三者可以共用同一套后端，不是互斥关系。

## 2.2 当前一期确认交付形态

当前一期确认采用：

`移动优先的响应式 Web`

当前一期明确不做 PWA。

原因：

1. 当前核心链路是截图导入、搜索、编辑，不依赖离线能力。
2. 当前不要求推送、后台任务、分享扩展等强系统能力。
3. 普通 Web 上线和迭代成本最低，最适合当前验证阶段。
4. 先把移动端浏览器体验做稳，比先处理 PWA 平台差异更重要。

结论：

- 一期的基线 requirement 是：移动端浏览器体验足够好。
- 一期不把安装能力作为交付目标。

## 2.3 为什么当前不做 PWA

当前不做 PWA，不是因为 PWA 不能做，而是因为它不是当前产品成立的关键条件。

当前阶段最重要的是：

1. 商品与订单模型正确
2. 导入与校对流程顺畅
3. 移动端截图上传体验稳定
4. 后续能平滑接 App

相较之下，PWA 会带来额外的平台行为差异，但不会决定一期价值是否成立。

## 2.4 长期最优交付形态

如果从长期使用体验而不是一期开发效率看，长期最优交付形态应是：

`Expo App + 保留 Web`

原因：

1. App 更适合后续接入拍照、相册选择、分享扩展、推送等移动端能力。
2. Web 更适合做大屏浏览、管理和回看。
3. 当前一期先做 Web，不代表长期只停留在 Web。

## 3. 技术设计原则

### 3.1 API First，而不是 Web First

虽然一期先做 Web，但所有核心写操作都应通过明确的 HTTP API 完成。

原因：

1. 后续 App 也可以直接复用同一套 API。
2. 更容易把识别、去重、保存这些流程从 UI 中拆出来。
3. 避免把核心业务逻辑绑定到 Web 表单或 Server Action。

结论：

- Next.js 可以继续作为一期的全栈外壳。
- 但核心业务应收敛到 `domain service + API contract`，而不是散落在页面组件里。

### 3.2 共享“规则”和“契约”，不强行共享 UI

当前阶段不建议为了未来 App 提前走“全端统一 UI 组件”路线。

这类方案会明显增加一期复杂度，而且当前产品还处于需求验证阶段。

当前真正该复用的是：

1. 数据模型
2. API contract
3. 校验规则
4. 识别与去重逻辑
5. 设计 token 和文案枚举

不必在一期强求复用的是：

1. Web 组件本身
2. 页面布局代码
3. Web 交互细节

### 3.3 AI 只产出草稿，不直接写入正式库

订单截图识别属于高不确定性输入。

因此一期必须遵守：

1. AI 识别结果先落到导入草稿。
2. 用户完成人工校对后，才允许提交到正式表。
3. 去重低置信度时必须人工确认。

这是当前产品的基线要求，不是未来优化项。

### 3.4 所有关键规则要有纯服务层实现

以下逻辑不能写在页面组件里：

1. 名称标准化
2. 商品候选匹配
3. 每 100g 价格计算
4. 导入草稿保存
5. 正式提交事务

这些都应该是服务层函数，Web 和未来 App 共享调用同一套后端规则。

## 4. 推荐技术栈

## 4.1 总体选择

推荐采用：

1. `Next.js App Router` 作为 Web 应用与 API 外壳
2. `Supabase Postgres` 作为主数据库
3. `Prisma` 作为 ORM 与迁移工具
4. `Supabase Storage` 作为截图与图片存储
5. `模型供应商适配层` 作为订单截图识别能力封装，默认接 `火山方舟 / 豆包视觉模型`
6. `TanStack Query` 作为 Web 端服务端状态管理
7. `Expo` 作为未来移动端承接方案

### 4.2 选择理由

#### Next.js App Router

适合当前一期，因为：

1. Web 页面和 API 可以在一个工程内快速交付。
2. Route Handlers 能提供明确的 HTTP 接口。
3. 后续即使加 App，Route Handlers 暴露出的 API 仍可继续复用。

#### Supabase Postgres

适合作为长期主库，因为：

1. 商品、订单、导入草稿、标签、平台关系都属于典型关系型数据。
2. 后续做统计、筛选、聚合查询更合适。
3. 能承接后期的搜索、报表和更复杂的去重规则。

说明：

1. 这里不是“PostgreSQL 和 Supabase 二选一”。
2. Supabase 提供的是托管平台，而它的数据库本体就是 Postgres。
3. 当前建议是使用 Supabase 托管 Postgres，但在服务端通过 Prisma 访问数据库。

#### Prisma

适合当前阶段，因为：

1. 数据模型会频繁调整，迁移工具重要。
2. 类型生成和 schema 管理清晰。
3. 对小团队和个人项目更省心。
4. 对“导入草稿 -> 人工确认 -> 事务提交正式订单”这类多表写入流程，比直接把复杂逻辑散落在客户端或简单数据库调用里更稳。

#### Supabase Storage

适合一期，因为：

1. 订单截图和商品图都需要可靠对象存储。
2. 不必自己维护文件服务。
3. 后续 App 也能直接复用同一套文件访问方式。

#### 模型供应商适配层（默认火山方舟 / 豆包）

当前识别能力建议通过统一的 provider adapter 封装，而不是写死某一家。

当前默认供应商建议是 `火山方舟 / 豆包视觉理解`，原因：

1. 国内接入、计费和网络环境更符合当前项目现实。
2. 火山方舟官方文档已提供视觉理解、图片理解、Responses API、Function Calling 等能力入口。
3. 常规在线推理按 Token 付费，官方明确将其定位为“个人开发者或小型业务”的高性价比方案。

当前备选供应商建议是 `阿里云百炼 / 通义千问 VL`，原因：

1. 官方提供 OpenAI 兼容视觉接口。
2. 官方持续维护 VL 与 OCR 系列模型，适合作为兼容备选。

当前不建议将 `DeepSeek` 作为一期主识别供应商。

说明：

1. DeepSeek 官方 API 文档当前明确提供 `deepseek-chat` 与 `deepseek-reasoner` 的价格和 JSON Output 文档。
2. 但我没有在其官方 API 文档中查到同等成熟的托管式图片输入 API 文档。
3. 基于这一点，我推断 DeepSeek 当前更适合承担文本推理、名称标准化、去重辅助等角色，而不是订单截图主识别。

#### TanStack Query

适合现在和后续，因为：

1. Web 与 React Native 都适用。
2. 列表、详情、草稿轮询、保存后刷新都适合这类数据层。
3. 能减少前端自己维护异步状态机的复杂度。

#### Expo

作为后续移动端承接方案更稳妥，因为：

1. 未来 App 仍是 React / TypeScript 技术栈。
2. 后续可以复用 API、数据契约、业务规则和一部分状态管理方式。
3. 对单人或小团队维护成本更低。

## 5. 不建议的方案

### 5.1 不建议一期大量使用 Server Actions 承载核心业务

可以用在轻量 Web-only 表单动作上，但不应承载核心业务保存逻辑。

原因：

1. 未来 App 无法直接复用。
2. 业务规则会被 Web 框架耦死。
3. 调试与权限边界容易变乱。

### 5.2 不建议一开始就做“Web/App 统一 UI 框架”

例如现在就强行要求所有页面组件同时兼容 Web 与 App，不适合一期。

原因：

1. 当前产品还在验证期。
2. 一期主要复杂度在识别、校对、去重，而不在 UI 复用。
3. 现在更应该统一的是数据层，不是展示层。

### 5.3 不建议现在引入消息队列或微服务拆分

当前规模下会明显增加维护成本。

一期建议先做“单体应用 + 清晰模块边界”。

## 6. 建议的项目结构

即使当前只有 Web，也建议从第一天按“未来可扩”的方式组织代码。

```text
/
  apps/
    web/
      src/app/                 # 页面与 Route Handlers
      src/features/            # Web 端页面组合逻辑
  packages/
    contracts/                # API 请求/响应 DTO 与 zod schema
    domain/                   # 业务规则与 use cases
    db/                       # Prisma schema、client、repository
    importer/                 # 识别 provider、提示词、解析、标准化、候选匹配
    shared/                   # 分类、标签、平台枚举、常量
    design-tokens/            # 颜色、间距、字体 token
```

未来迁移到 App 时，新增：

```text
apps/
  mobile/                     # Expo app
```

App 直接复用：

1. `packages/contracts`
2. `packages/domain`
3. `packages/shared`
4. `packages/design-tokens`

## 7. 核心模块拆分

### 7.1 Web 表现层

负责：

1. 页面展示
2. 表单输入
3. 上传交互
4. 调用 API
5. 草稿确认和错误提示

不负责：

1. 去重打分逻辑
2. 名称标准化
3. 价格计算
4. 正式保存事务

### 7.2 API 层

负责：

1. 鉴权
2. 参数校验
3. 调用领域服务
4. 返回 DTO

建议所有接口返回统一结构：

```ts
type ApiSuccess<T> = { ok: true; data: T }
type ApiError = { ok: false; code: string; message: string; fieldErrors?: Record<string, string> }
```

### 7.3 领域服务层

负责：

1. 商品去重候选计算
2. 导入草稿状态流转
3. 提交订单事务
4. 平台最近成交价聚合
5. 每 100g 价格计算

### 7.4 数据访问层

负责：

1. Prisma schema
2. repository 封装
3. 事务边界
4. 查询聚合

### 7.5 导入识别模块

负责：

1. 组织多图识别输入
2. 调用模型供应商适配器
3. 解析结构化 JSON
4. 名称标准化
5. 候选商品检索与打分

建议接口：

```ts
type VisionProvider = {
  analyzeOrderImages(input: AnalyzeOrderImagesInput): Promise<AnalyzeOrderImagesResult>
}
```

一期建议实现：

1. `ArkVisionProvider` 作为默认实现
2. `QwenVisionProvider` 作为备选实现
3. `DeepSeekTextProvider` 仅用于后续文本辅助，不参与主识别链路

## 8. 数据模型设计

## 8.1 实体总览

建议一期至少有以下表：

1. `users`
2. `categories`
3. `tags`
4. `products`
5. `product_aliases`
6. `product_platforms`
7. `orders`
8. `order_images`
9. `order_items`
10. `import_sessions`
11. `import_images`
12. `import_item_drafts`

### 8.2 users

一期虽是小范围使用，但建议仍保留 `user_id`。

原因：

1. 后续加 App 时鉴权自然。
2. 即使只有 1 个用户，也不必将来补一次“多用户迁移”。

建议字段：

- `id`
- `username`（可重复）
- `phone`（可空，预留后续手机号登录）
- `display_name`
- `created_at`

### 8.3 categories

系统预设分类表。

建议字段：

- `id`
- `code`
- `name`
- `sort_order`
- `is_active`

### 8.4 tags

系统预设标签表。

建议字段：

- `id`
- `code`
- `name`
- `sort_order`
- `is_active`

### 8.5 products

商品主档表。

建议字段：

- `id`
- `user_id`
- `display_name`
- `normalized_name`
- `category_id`
- `spec_text`
- `inventory_status`
- `note`
- `primary_image_url`
- `created_at`
- `updated_at`
- `last_purchased_at`

说明：

1. `display_name` 是用户最终看到的名称。
2. `normalized_name` 用于去重与搜索。
3. `primary_image_url` 允许为空。

### 8.6 product_aliases

用于沉淀历史识别文本，提升后续跨平台匹配命中率。

建议字段：

- `id`
- `product_id`
- `platform`
- `raw_name`
- `normalized_name`
- `created_at`

### 8.7 product_platforms

表示某商品出现过哪些平台。

建议字段：

- `product_id`
- `platform`
- `first_seen_at`
- `last_seen_at`

### 8.8 orders

订单主表，对应 PRD 中的购物记录。

建议字段：

- `id`
- `user_id`
- `platform`
- `ordered_at`
- `note`
- `created_at`
- `updated_at`
- `import_session_id`

### 8.9 order_images

订单原始截图表。

建议字段：

- `id`
- `order_id`
- `storage_path`
- `page_index`
- `created_at`

### 8.10 order_items

订单中的商品项表。

建议字段：

- `id`
- `order_id`
- `product_id`
- `raw_name`
- `line_price_amount`
- `currency`
- `quantity`
- `spec_text`
- `weight_grams`
- `price_per_100g`
- `is_new_product_at_import`
- `created_at`

说明：

1. `line_price_amount` 建议统一以最小货币单位存储，例如分。
2. `price_per_100g` 也建议存最小货币单位，避免浮点误差。

### 8.11 import_sessions

导入会话表，是“截图识别草稿”的订单级容器。

建议字段：

- `id`
- `user_id`
- `status`
- `platform_guess`
- `ordered_at_guess`
- `note`
- `raw_model_response`
- `error_message`
- `created_at`
- `updated_at`
- `committed_order_id`

建议状态：

1. `draft`
2. `processing`
3. `review_required`
4. `ready_to_commit`
5. `committed`
6. `failed`

### 8.12 import_images

导入阶段的原始图片表。

建议字段：

- `id`
- `import_session_id`
- `storage_path`
- `page_index`
- `created_at`

### 8.13 import_item_drafts

识别出的商品项草稿表。

建议字段：

- `id`
- `import_session_id`
- `page_index`
- `raw_name`
- `normalized_name`
- `guessed_category_id`
- `price_amount`
- `quantity`
- `spec_text`
- `weight_grams`
- `price_per_100g`
- `candidate_product_ids`
- `selected_product_id`
- `create_new_product`
- `manual_display_name`
- `manual_category_id`
- `manual_note`
- `review_status`
- `created_at`
- `updated_at`

建议状态：

1. `pending_review`
2. `matched_existing`
3. `create_new`
4. `resolved`

## 9. 关键业务算法

### 9.1 名称标准化

建议在服务层做统一标准化，至少包括：

1. 去除首尾空格与重复空格
2. 全角半角统一
3. 常见平台营销词移除
4. 统一大小写
5. 规格表达格式标准化

输出：

1. `display_name` 保留相对可读版本
2. `normalized_name` 作为匹配键

### 9.2 候选商品匹配

建议采用“规则优先”的方案，而不是一期直接做 embedding 检索。

优先级：

1. `normalized_name` 精确命中 `product_aliases`
2. `normalized_name + spec` 精确命中 `products`
3. `normalized_name` 相似匹配
4. 类别一致时加权
5. 平台历史别名命中时加权

匹配输出：

1. 候选商品列表
2. 匹配得分
3. 推荐动作：`auto_select` / `needs_review` / `create_new`

### 9.3 每 100g 价格计算

建议统一服务函数：

```ts
type PriceCalcInput = {
  linePriceAmount: number
  quantity?: number | null
  weightGrams?: number | null
}
```

规则：

1. 若 `linePriceAmount` 或 `weightGrams` 缺失，则返回 `null`
2. 若 `quantity` 缺失，默认按 1 处理
3. `totalWeight = weightGrams * quantity`
4. `pricePer100g = round(linePriceAmount / totalWeight * 100)`

### 9.4 平台最近成交价聚合

商品详情页展示的数据不直接存冗余字段，优先从 `order_items + orders` 聚合得到。

聚合规则：

1. 按 `product_id + platform` 分组
2. 取 `ordered_at` 最近的一条订单商品项
3. 返回该平台最近成交价
4. 若该商品项存在 `price_per_100g`，同步返回

## 10. 订单截图识别流程

## 10.1 流程总览

建议采用“上传 -> 识别 -> 校对 -> 提交”的四段式流程。

```text
上传截图
  -> 创建 import_session
  -> 保存 import_images
  -> 调用识别服务
  -> 生成 import_item_drafts
  -> 用户校对
  -> 提交事务
  -> 生成 orders / order_items / products
```

## 10.2 识别输入

输入内容：

1. 同一订单的多张截图
2. 平台候选信息（如果用户先选择平台，可作为提示）
3. 结构化输出 schema

建议输出 JSON 结构：

```json
{
  "platform": "hema",
  "orderedAt": "2026-03-23T10:30:00+08:00",
  "items": [
    {
      "rawName": "盒马云南高原生菜 300g",
      "priceAmount": 1290,
      "quantity": 1,
      "specText": "300g",
      "weightGrams": 300,
      "guessedCategoryCode": "vegetable_fruit"
    }
  ]
}
```

### 10.3 识别服务输出后处理

模型结果不能直接写正式表，必须经过：

1. JSON schema 校验
2. 平台枚举校验
3. 时间格式校验
4. 价格与数量格式清洗
5. 商品名标准化
6. 候选商品匹配
7. 草稿表保存

### 10.4 人工校对阶段

用户需要在提交前确认：

1. 平台
2. 购物时间
3. 每个商品项的名称
4. 每个商品项的去重结果
5. 新建商品的分类
6. 价格或数量缺失时必须补录
7. 重量缺失时可允许继续保存，但该商品项不计算每 100g 价格

### 10.5 提交事务阶段

用户点击“保存订单”后，后端在一个事务里完成：

1. 创建 `orders`
2. 创建 `order_images`
3. 对每个草稿：
   - 若选已有商品，则直接关联
   - 若选新建商品，则创建 `products`
   - 写入 `product_aliases`
   - 更新 `product_platforms`
   - 写入 `order_items`
4. 更新 `products.last_purchased_at`
5. 更新 `import_session.status = committed`

## 11. API 设计

为后续 App 迁移考虑，一期建议使用清晰的 JSON API，而不是页面私有调用。

### 11.1 导入相关

1. `POST /api/import-sessions`
   - 创建导入会话
2. `POST /api/import-sessions/:id/images`
   - 上传并登记截图
3. `POST /api/import-sessions/:id/analyze`
   - 触发识别
4. `GET /api/import-sessions/:id`
   - 获取导入草稿
5. `PATCH /api/import-sessions/:id`
   - 更新订单级草稿字段
6. `PATCH /api/import-item-drafts/:id`
   - 更新单个商品项草稿
7. `POST /api/import-sessions/:id/commit`
   - 提交订单

### 11.2 商品相关

1. `GET /api/products`
2. `POST /api/products`
3. `GET /api/products/:id`
4. `PATCH /api/products/:id`

### 11.3 订单相关

1. `GET /api/orders`
2. `POST /api/orders`
3. `GET /api/orders/:id`
4. `PATCH /api/orders/:id`

### 11.4 元数据相关

1. `GET /api/categories`
2. `GET /api/tags`
3. `GET /api/platforms`

## 12. 前端实现建议

## 12.1 页面层

Web 页面只做两类事情：

1. 组合展示
2. 调用 API

不要让页面自己持有复杂业务规则。

### 12.2 数据获取

建议：

1. 列表和详情统一走 TanStack Query
2. 保存类操作统一走 mutation
3. 导入会话在识别过程中允许轮询

### 12.3 表单校验

建议使用和后端共享的 schema：

1. 后端用 schema 做入参校验
2. 前端用同一 schema 做表单校验

这样未来 App 也能共用同一套规则。

## 13. 鉴权与权限模型

一期建议直接按“单用户私有应用”设计，而不是无鉴权开放站点。

建议方案：

1. 一期测试阶段采用轻量账号密码登录，不引入邮箱 OTP
2. 服务端负责签发和校验应用内 session token
3. 一期仍按单主账号私有应用建模
4. 所有核心数据都绑定 `user_id`
5. 后续若开放给真实用户，默认优先考虑手机号验证

当前不建议为了快而完全不做权限隔离。

这是因为一旦后续接 App，再回头补鉴权和数据隔离，代价会明显更高。

## 14. 文件存储方案

### 14.1 存储内容

需要存储：

1. 导入阶段原始截图
2. 订单归档截图
3. 商品首图（如果成功提取）

### 14.2 存储路径建议

```text
imports/{userId}/{importSessionId}/{pageIndex}.jpg
orders/{userId}/{orderId}/{pageIndex}.jpg
products/{userId}/{productId}/primary.jpg
```

### 14.3 商品图策略

当前一期建议采用以下策略：

1. 优先从截图中提取商品图
2. 如果无法可靠提取，不阻塞保存
3. 商品页优先展示商品图；无商品图时回退为订单截图缩略图或占位图

这比为了“一定拿到商品图”而引入复杂图像裁切系统更符合一期目标。

## 15. 部署方案

### 15.1 推荐部署

建议：

1. Web 与 API：Vercel
2. Postgres / Storage / Auth：Supabase

原因：

1. 初期部署简单
2. Web 和后端能力分工清晰
3. 后续 App 仍然可以访问同一套后端

### 15.2 本地开发

本地建议通过 `.env` 连接：

1. 本地或远程 Postgres
2. Supabase Storage
3. 火山方舟 API
4. 可选的阿里云百炼 API

## 16. 面向未来 App 的迁移路径

### 16.1 当前阶段就要守住的边界

如果未来要做 App，现在必须守住以下边界：

1. 不把核心业务写死在页面组件里
2. 不把关键写操作只做成 Server Actions
3. 不把 DTO 和表单字段散落在各页面
4. 不让 Web 自己实现一套、后端再实现一套去重规则

### 16.2 未来迁移步骤

建议迁移顺序：

1. 保持现有后端和数据库不变
2. 新建 `apps/mobile`，使用 Expo
3. 复用 `packages/contracts`
4. 复用 `packages/shared`
5. 复用后端 API
6. 先实现核心流程：登录、商品库、订单列表、导入记录查看
7. 再考虑移动端上传与拍照能力

### 16.3 哪些东西未来可以直接复用

1. PostgreSQL schema
2. Prisma schema
3. API Route contract
4. 导入识别逻辑
5. 名称标准化逻辑
6. 每 100g 价格计算逻辑
7. 分类、标签、平台枚举

### 16.4 哪些东西未来大概率不能直接复用

1. Web 页面组件
2. Web 表格布局
3. Web 专属上传交互

## 17. 分阶段实施建议

### 17.1 第一阶段：数据与后台骨架

1. 建库与 Prisma schema
2. categories / tags / platforms seed
3. 商品、订单、导入会话 API
4. 基础鉴权

### 17.2 第二阶段：商品库与订单管理

1. 商品列表 / 详情 / 编辑
2. 订单列表 / 详情 / 手动新增
3. 待补货视图

### 17.3 第三阶段：截图导入 MVP

1. 多图上传
2. import_session 流程
3. 豆包视觉识别
4. 草稿校对
5. 提交正式订单

### 17.4 第四阶段：价格比较与细节完善

1. 各平台最近成交价聚合
2. 每 100g 价格计算
3. 导入失败提示与重试

## 18. 主要风险与应对

### 18.1 风险：模型输出不稳定

应对：

1. 要求结构化 JSON 输出
2. 后端做 schema 校验
3. 任何异常都进入人工校对，不直接入正式库

### 18.2 风险：跨平台商品去重命中率低

应对：

1. 引入 `product_aliases`
2. 用户确认后的结果沉淀为后续匹配样本
3. 先走规则匹配，后续再考虑 embedding

### 18.3 风险：现在为了 App 过度设计

应对：

1. 只提前设计共享数据层和契约层
2. 不提前做统一 UI 层
3. 仍以 Web MVP 上线速度为第一优先级

## 19. 外部参考

以下信息用于约束当前技术选型，不代表必须逐字照搬实现：

1. Next.js 官方文档说明，Route Handlers 提供基于 Web Request/Response API 的自定义请求处理，适合作为一期 JSON API 外壳。
2. Prisma 官方文档说明，PostgreSQL 是 Prisma Migrate 的直接支持目标，适合本项目的关系型模型演进。
3. 火山方舟官方文档提供视觉理解、图片理解、Responses API 和常规在线推理文档，说明其具备作为当前截图识别主供应商的能力与计费路径。
4. 阿里云百炼官方文档提供通义千问 VL 的 OpenAI 兼容视觉接口，适合作为国内备选供应商。
5. DeepSeek 官方文档当前清晰提供 JSON Output 与文本模型价格文档；基于未见同等成熟的图片输入官方 API 文档，我将其定位为文本辅助备选而非一期主识别。
6. Supabase 官方文档说明，Storage 支持文件存储、直接 URL 访问和基于 RLS 的访问控制，适合作为截图存储层。
7. TanStack Query 官方文档显示其同时支持 React 与 React Native，适合作为 Web 现在、App 未来的一致数据获取层。
8. Expo 官方资料说明其是 React Native 的完整框架，且面向 React/TypeScript 开发者迁移成本较低，适合作为后续 App 承接方案。
