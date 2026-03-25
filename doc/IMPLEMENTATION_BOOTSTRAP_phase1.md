# 生活管家 Web 一期工程初始化与开发启动清单

- Date: 2026-03-23
- Status: Draft
- Related:
  - [TECHNICAL_DESIGN_life_assistant_phase1.md](/Users/dong/Documents/GroceriessGoodBuy/TECHNICAL_DESIGN_life_assistant_phase1.md)
  - [API_CONTRACTS_life_assistant_phase1.md](/Users/dong/Documents/GroceriessGoodBuy/API_CONTRACTS_life_assistant_phase1.md)
  - [schema.prisma](/Users/dong/Documents/GroceriessGoodBuy/prisma/schema.prisma)

## 1. 目标

本清单用于把当前方案直接转成可开发工程。

目标不是重复讨论技术选型，而是明确：

1. 初始仓库结构怎么搭
2. 环境变量需要哪些
3. 第一批种子数据是什么
4. 开发按什么顺序开始最稳

## 2. 初始工程形态

建议从一开始就使用 `pnpm workspace`。

原因：

1. 当前虽然只有 Web，但后续要迁移 App。
2. `packages/contracts`、`packages/shared` 这类共享层不应该等到后面再拆。
3. 这是当前很主流的组织方式，不算过度设计。

建议目录：

```text
/
  apps/
    web/
  packages/
    contracts/
    db/
    domain/
    importer/
    shared/
  prisma/
    schema.prisma
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .env.example
```

## 3. 工程初始化建议

### 3.1 Node 与包管理器

建议：

1. Node.js `22.x`
2. `pnpm` `10.x`

原因：

1. 都是当前主流版本线。
2. 对 monorepo 和 Next.js 15 组合更顺手。

### 3.2 Web 工程

`apps/web` 建议采用：

1. `Next.js 15`
2. `React 19`
3. `TypeScript`
4. `Tailwind CSS 4`

### 3.3 包职责

#### packages/shared

放：

1. 平台枚举与标签文案映射
2. 分类 code 常量
3. 通用格式化函数

#### packages/contracts

放：

1. API request/response DTO
2. zod schema
3. 前后端共用的校验规则

#### packages/db

放：

1. Prisma client
2. repository 封装
3. seed 脚本

#### packages/domain

放：

1. 商品去重逻辑
2. 每 100g 价格计算
3. 导入会话状态流转
4. 提交订单事务

#### packages/importer

放：

1. 供应商适配器与 prompts
2. 模型响应解析
3. 名称标准化
4. 候选商品匹配

## 4. 环境变量

建议一期至少准备以下环境变量：

```bash
DATABASE_URL=
DIRECT_URL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

SUPABASE_STORAGE_BUCKET_IMPORTS=imports
SUPABASE_STORAGE_BUCKET_ORDERS=orders
SUPABASE_STORAGE_BUCKET_PRODUCTS=products

LLM_PROVIDER=ark

ARK_API_KEY=
ARK_BASE_URL=
ARK_VISION_MODEL=

QWEN_API_KEY=
QWEN_BASE_URL=
QWEN_VISION_MODEL=

NEXT_PUBLIC_APP_URL=http://localhost:3000
TEST_LOGIN_ACCOUNTS='[{"username":"admin","password":"change-me","displayName":"管理员测试"},{"username":"buyer","password":"change-me","displayName":"采购测试"}]'
APP_SESSION_SECRET=change-me
```

说明：

1. `DATABASE_URL` 用于运行时数据库连接。
2. `DIRECT_URL` 给 Prisma Migrate 使用。
3. `SUPABASE_SECRET_KEY` 仅服务端可见，不能下发到客户端。
4. Storage bucket 名称即使当前写死，也建议显式配置。
5. `TEST_LOGIN_ACCOUNTS` 用于当前测试阶段的轻量账号密码登录，并支持多个测试账号。
6. `APP_SESSION_SECRET` 用于签发服务端自有登录态，不能泄露。
7. `LLM_PROVIDER` 用于选择当前识别供应商，默认建议 `ark`。
8. `QWEN_*` 变量用于保留国内备选模型接入位，不必一期同时启用。

## 5. 种子数据

一期启动时就应写 seed 脚本，而不是手工往库里插数据。

### 5.1 分类 seed

建议直接写入以下分类：

1. `vegetable_fruit` / 蔬菜水果
2. `meat_egg` / 肉禽蛋
3. `seafood` / 海鲜水产
4. `dairy_bakery` / 乳品烘焙
5. `ready_to_eat` / 熟食速食
6. `grocery_seasoning` / 粮油调味
7. `drinks` / 酒水饮料
8. `snacks` / 休闲零食
9. `kitchen_supplies` / 厨房用品
10. `cleaning_care` / 洗护清洁
11. `home_essentials` / 家居日用
12. `other` / 其他

### 5.2 标签 seed

建议直接写入：

1. `recommended` / 推荐
2. `repurchase` / 回购
3. `average` / 一般
4. `avoid` / 避雷
5. `good_value` / 性价比高
6. `bad_value` / 性价比低

## 6. 第一阶段开发顺序

### 6.1 先做后端骨架

第一批必须先完成：

1. Next.js 基础工程
2. Prisma 初始化
3. Supabase 连接
4. categories/tags/platforms 接口
5. 商品与订单基础 CRUD

原因：

1. 这些是导入功能的依赖底座。
2. 如果先做识别流程，会在没有稳定数据层时不断返工。

### 6.2 再做商品库与订单页

顺序建议：

1. 商品列表页
2. 商品详情页
3. 订单列表页
4. 订单详情页
5. 手动新增商品
6. 手动新增订单

### 6.3 最后接截图导入

顺序建议：

1. import session 创建
2. 多图上传
3. 豆包视觉识别
4. 草稿页
5. 提交订单

## 7. API 首批开发顺序

建议按以下顺序落接口：

1. `GET /api/categories`
2. `GET /api/tags`
3. `GET /api/platforms`
4. `GET /api/products`
5. `POST /api/products`
6. `GET /api/products/:id`
7. `PATCH /api/products/:id`
8. `GET /api/orders`
9. `POST /api/orders`
10. `GET /api/orders/:id`
11. `PATCH /api/orders/:id`
12. `POST /api/import-sessions`
13. `POST /api/import-sessions/:id/images`
14. `POST /api/import-sessions/:id/analyze`
15. `GET /api/import-sessions/:id`
16. `PATCH /api/import-sessions/:id`
17. `PATCH /api/import-item-drafts/:id`
18. `POST /api/import-sessions/:id/commit`

## 8. 页面首批开发顺序

建议：

1. 登录与基础 Layout
2. 首页占位
3. 商品库列表
4. 商品详情
5. 订单列表
6. 订单详情
7. 导入页

## 9. 测试重点

一期至少要覆盖以下高风险点：

1. 商品去重候选计算
2. 每 100g 价格计算
3. 导入草稿提交事务
4. 一个导入会话不能重复提交
5. 手动补录缺失必填字段的校验

## 10. 开发前的最后确认

在真正开始编码前，建议把以下结论视为已冻结：

1. 一期是普通移动优先 Web，不做 PWA。
2. 技术栈是 `Next.js 15 + Tailwind CSS 4 + Heroicons 2 + Supabase + Prisma 6 + TanStack Query`。
3. 商品跨平台合并为一个主档。
4. 订单详情页截图导入是唯一识别入口。
5. 识别结果先入草稿，再由用户校对提交。
6. 一期测试鉴权采用轻量 `账号密码 + 服务端签发 session token`。
7. 一期模型供应商默认使用 `火山方舟 / 豆包`，保留 `通义千问 VL` 备选接入位。

## 11. 是否需要新线程进入开发

不强制，但建议需要。

原因：

1. 当前线程已经承载了大量产品定义和方案讨论。
2. 新线程更适合切换到“直接写代码”的执行模式。
3. 新线程可以把上下文收敛为：
   - PRD 已确认
   - 技术方案已确认
   - Prisma schema 已确认
   - API contract 已确认

建议新线程的开场指令可以直接写成：

`基于当前仓库内已经确认的 PRD、技术方案、Prisma schema 和 API contract，开始初始化项目并先实现第一阶段：Next.js 工程、Prisma、Supabase 连接、基础字典接口。`
