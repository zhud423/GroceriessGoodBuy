# Groceriess Good Buy 部署说明（Vercel）

本项目当前没有自动部署流水线，需先完成一次手动部署。

## 1. 部署目标

- Web/API：Vercel
- Database/Storage/Auth：Supabase

## 2. 前置条件

1. GitHub 仓库已推送：`main` 分支
2. Supabase 项目可用，且已拿到以下信息：
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
3. 你有火山方舟 key（可选，不影响基础 CRUD）

## 3. 在 Vercel 创建项目

1. 打开 [https://vercel.com/new](https://vercel.com/new)
2. 选择仓库：`zhud423/GroceriessGoodBuy`
3. `Root Directory` 选择：`apps/web`
4. Framework 保持：`Next.js`
5. Build Command 保持默认：`pnpm build`
   - 本仓库已在 `apps/web/package.json` 中加入 `prebuild`，会自动执行 `pnpm -w db:generate`
6. 点击 Deploy

## 4. 设置环境变量（Production + Preview）

在 Vercel 项目 `Settings -> Environment Variables` 添加：

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `APP_SESSION_SECRET`
- `TEST_LOGIN_ACCOUNTS`
- `NEXT_PUBLIC_APP_URL`（生产域名，如 `https://xxx.vercel.app` 或自定义域名）
- `SUPABASE_STORAGE_BUCKET_IMPORTS`（默认 `imports`）
- `SUPABASE_STORAGE_BUCKET_ORDERS`（默认 `orders`）
- `SUPABASE_STORAGE_BUCKET_PRODUCTS`（默认 `products`）
- `LLM_PROVIDER`（可选，默认 `ark`）
- `ARK_API_KEY`（可选）
- `ARK_BASE_URL`（可选）
- `ARK_VISION_MODEL`（可选）

> 一期若仅测手动流程，可先不填 ARK/QWEN 相关变量。

## 5. 初始化线上数据库（只做一次）

本地执行（使用线上 Supabase 的连接串）：

```bash
corepack pnpm db:push
corepack pnpm db:seed
```

## 6. 触发重新部署

1. 在 Vercel 点击 `Redeploy`
2. 等待构建完成，访问分配的域名

## 7. 最小验收

1. 登录页可打开
2. 可用测试账号登录
3. 商品库列表可加载
4. 购物记录列表可加载
5. 导入订单页可打开（未配 ARK 时允许回退人工补录）

## 8. 常见问题

1. `Missing required environment variable`
   - 检查 Vercel 环境变量是否同时配置在 `Production` 和 `Preview`
2. Prisma client 相关报错
   - 当前已在 `apps/web` 构建前自动执行 `pnpm -w db:generate`
3. API 500（数据库连接）
   - 检查 `DATABASE_URL` / `DIRECT_URL` 是否指向同一 Supabase 项目
