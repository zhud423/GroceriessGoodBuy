# Groceriess Good Buy

基于仓库内已确认的 PRD、技术方案、Prisma schema 和 API contract 搭建的一期工程底座。

## 当前已实现

- `pnpm workspace` monorepo 结构
- `apps/web` 的 Next.js 15 App Router 工程
- `packages/shared`、`packages/contracts`、`packages/db` 三个基础包
- Prisma Client 与分类/标签 seed 脚本
- Supabase browser/server/admin client 封装
- Supabase 当前官方 env 命名：`publishable key` / `secret key`
- `GET /api/categories`
- `GET /api/tags`
- `GET /api/platforms`

## 目录

```text
.
├── apps/
│   └── web/
├── packages/
│   ├── contracts/
│   ├── db/
│   └── shared/
├── prisma/
│   └── schema.prisma
└── .env.example
```

## 启动

1. 安装依赖：`corepack pnpm install`
2. 复制环境变量：`cp .env.example .env`
3. 填写 Supabase、Postgres，以及需要的话填火山方舟多模态配置
4. 生成 Prisma Client：`corepack pnpm db:generate`
5. 推送 schema：`corepack pnpm db:push`
6. 写入字典种子：`corepack pnpm db:seed`
7. 启动 Web：`corepack pnpm dev`

## 接入火山方舟多模态

截图导入已经接好了火山方舟 OpenAI-compatible 调用方式；如果没配 key，会自动回退到人工校对，不会阻塞导入流程。

### 1. 获取 API Key

1. 打开火山方舟控制台：[https://console.volcengine.com/ark](https://console.volcengine.com/ark)
2. 进入「权限管理 > API Key」
3. 创建一个仅服务端使用的 API Key，并妥善保存

参考官方文档：

- 管理 API Key：[https://www.volcengine.com/docs/82379/1361424](https://www.volcengine.com/docs/82379/1361424)

### 2. 获取可调用的视觉模型 ID

1. 进入「在线推理」
2. 创建或选择一个支持图片理解的推理接入点
3. 复制它的 `Endpoint ID`

当前项目直接把 `ARK_VISION_MODEL` 当作调用时的 `model` 字段，因此这里优先推荐填写 `Endpoint ID`。如果你已经在方舟侧拿到可直接调用的视觉 `Model ID`，也可以直接填进去。

参考官方文档：

- 常规在线推理：[https://www.volcengine.com/docs/82379/1099522](https://www.volcengine.com/docs/82379/1099522)
- 模型列表：[https://www.volcengine.com/docs/82379/1593704](https://www.volcengine.com/docs/82379/1593704)

### 3. 填写 `.env`

```bash
LLM_PROVIDER=ark
ARK_API_KEY=你的火山方舟_API_Key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_VISION_MODEL=你的_Endpoint_ID_或视觉_Model_ID
```

说明：

- `ARK_API_KEY` 只放服务端环境变量，不能下发到浏览器。
- `ARK_BASE_URL` 已按火山方舟官方北京站点默认值预填。
- `ARK_VISION_MODEL` 推荐先填在线推理页面拿到的 `Endpoint ID`，这样后续换模型时不用改代码。

### 4. 验证

1. 启动项目：`corepack pnpm dev`
2. 登录测试账号
3. 进入「截图导入」
4. 上传一张订单截图并触发分析

如果 `.env` 没配齐，系统会继续创建导入草稿，但分析结果会回退为人工补录占位项。

## 当前测试登录

- 当前默认使用 `.env` 中 `TEST_LOGIN_ACCOUNTS` 配置的测试账号密码登录
- 未来真实用户阶段默认优先设计手机号验证

## 后续阶段

- 商品与订单基础 CRUD
- 真实用户鉴权与手机号验证
- 截图导入草稿流转

## 远端部署

- 当前远端部署说明见：
  - `doc/DEPLOYMENT_VERCEL_PHASE1_20260327.md`
