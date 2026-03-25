# 生活管家 Web 一期 API Contract（v0.1）

- Date: 2026-03-23
- Status: Draft
- Related:
  - [PRD_life_assistant_phase1.md](/Users/dong/Documents/GroceriessGoodBuy/PRD_life_assistant_phase1.md)
  - [TECHNICAL_DESIGN_life_assistant_phase1.md](/Users/dong/Documents/GroceriessGoodBuy/TECHNICAL_DESIGN_life_assistant_phase1.md)
  - [schema.prisma](/Users/dong/Documents/GroceriessGoodBuy/prisma/schema.prisma)

## 1. 总体约定

### 1.1 API 风格

一期采用 JSON API。

规则：

1. 所有业务接口路径以 `/api` 开头。
2. 所有写接口都要求登录态。
3. 所有响应统一返回 `ok` 字段。
4. 时间统一使用 ISO 8601 字符串。
5. 金额统一以“分”为单位传输。

### 1.2 成功响应

```ts
type ApiSuccess<T> = {
  ok: true
  data: T
}
```

### 1.3 失败响应

```ts
type ApiError = {
  ok: false
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "VALIDATION_ERROR"
    | "CONFLICT"
    | "IMPORT_NOT_READY"
    | "IMPORT_ALREADY_COMMITTED"
    | "INTERNAL_ERROR"
  message: string
  fieldErrors?: Record<string, string>
}
```

## 2. 基础字典接口

### 2.1 GET /api/categories

返回系统预设分类。

响应：

```ts
type CategoryDto = {
  id: string
  code: string
  name: string
  sortOrder: number
}
```

### 2.2 GET /api/tags

返回系统预设标签。

响应：

```ts
type TagDto = {
  id: string
  code: string
  name: string
  sortOrder: number
}
```

### 2.3 GET /api/platforms

返回支持的平台枚举。

响应：

```ts
type PlatformDto = {
  code: "HEMA" | "XIAOXIANG" | "QIXIAN" | "SAMS"
  label: string
}
```

## 3. 商品接口

### 3.1 GET /api/products

用于商品库列表页。

Query 参数：

```ts
type GetProductsQuery = {
  q?: string
  categoryId?: string
  platform?: "HEMA" | "XIAOXIANG" | "QIXIAN" | "SAMS"
  tagId?: string
  inventoryStatus?: "UNKNOWN" | "SUFFICIENT" | "LOW" | "OUT"
  hasOrders?: "true" | "false"
  sort?: "recent_added" | "recent_purchased"
  page?: string
  pageSize?: string
}
```

响应：

```ts
type ProductListItemDto = {
  id: string
  displayName: string
  category: { id: string; code: string; name: string }
  platforms: Array<{ code: string; label: string }>
  tags: Array<{ id: string; code: string; name: string }>
  inventoryStatus: "UNKNOWN" | "SUFFICIENT" | "LOW" | "OUT"
  primaryImageUrl: string | null
  lastPurchasedAt: string | null
  createdAt: string
}

type GetProductsResponse = {
  items: ProductListItemDto[]
  page: number
  pageSize: number
  total: number
}
```

### 3.2 POST /api/products

手动新建商品。

请求：

```ts
type CreateProductRequest = {
  displayName: string
  categoryId: string
  platformCodes?: Array<"HEMA" | "XIAOXIANG" | "QIXIAN" | "SAMS">
  specText?: string | null
  tagIds?: string[]
  inventoryStatus?: "UNKNOWN" | "SUFFICIENT" | "LOW" | "OUT"
  note?: string | null
}
```

响应：

```ts
type CreateProductResponse = {
  productId: string
}
```

### 3.3 GET /api/products/:id

用于商品详情页。

响应：

```ts
type ProductPlatformLatestPriceDto = {
  platform: { code: string; label: string }
  latestOrderedAt: string
  linePriceAmount: number
  quantity: string
  specText: string | null
  weightGrams: number | null
  pricePer100g: number | null
}

type ProductOrderSummaryDto = {
  orderId: string
  platform: { code: string; label: string }
  orderedAt: string
  linePriceAmount: number
  quantity: string
}

type ProductDetailDto = {
  id: string
  displayName: string
  normalizedName: string
  category: { id: string; code: string; name: string }
  platforms: Array<{ code: string; label: string }>
  tags: Array<{ id: string; code: string; name: string }>
  inventoryStatus: "UNKNOWN" | "SUFFICIENT" | "LOW" | "OUT"
  specText: string | null
  note: string | null
  primaryImageUrl: string | null
  lastPurchasedAt: string | null
  latestPlatformPrices: ProductPlatformLatestPriceDto[]
  recentOrders: ProductOrderSummaryDto[]
}
```

### 3.4 PATCH /api/products/:id

更新商品。

请求：

```ts
type UpdateProductRequest = {
  displayName?: string
  categoryId?: string
  specText?: string | null
  tagIds?: string[]
  inventoryStatus?: "UNKNOWN" | "SUFFICIENT" | "LOW" | "OUT"
  note?: string | null
}
```

响应：

```ts
type UpdateProductResponse = {
  productId: string
}
```

## 4. 订单接口

### 4.1 GET /api/orders

用于订单列表页。

Query 参数：

```ts
type GetOrdersQuery = {
  platform?: "HEMA" | "XIAOXIANG" | "QIXIAN" | "SAMS"
  page?: string
  pageSize?: string
}
```

响应：

```ts
type OrderListItemDto = {
  id: string
  platform: { code: string; label: string }
  orderedAt: string
  itemCount: number
  coverImageUrl: string | null
  createdAt: string
}

type GetOrdersResponse = {
  items: OrderListItemDto[]
  page: number
  pageSize: number
  total: number
}
```

### 4.2 POST /api/orders

手动新增订单。

请求：

```ts
type ManualOrderItemInput =
  | {
      mode: "existing_product"
      productId: string
      rawName: string
      linePriceAmount: number
      quantity: string
      specText?: string | null
      weightGrams?: number | null
    }
  | {
      mode: "new_product"
      rawName: string
      linePriceAmount: number
      quantity: string
      specText?: string | null
      weightGrams?: number | null
      newProduct: {
        displayName: string
        categoryId: string
        tagIds?: string[]
        inventoryStatus?: "UNKNOWN" | "SUFFICIENT" | "LOW" | "OUT"
        note?: string | null
      }
    }

type CreateOrderRequest = {
  platform: "HEMA" | "XIAOXIANG" | "QIXIAN" | "SAMS"
  orderedAt: string
  note?: string | null
  items: ManualOrderItemInput[]
}
```

响应：

```ts
type CreateOrderResponse = {
  orderId: string
}
```

### 4.3 GET /api/orders/:id

用于订单详情页。

响应：

```ts
type OrderImageDto = {
  id: string
  pageIndex: number
  imageUrl: string
}

type OrderItemDto = {
  id: string
  product: {
    id: string
    displayName: string
  }
  rawName: string
  linePriceAmount: number
  quantity: string
  specText: string | null
  weightGrams: number | null
  pricePer100g: number | null
  isNewProductAtImport: boolean
}

type OrderDetailDto = {
  id: string
  platform: { code: string; label: string }
  orderedAt: string
  note: string | null
  images: OrderImageDto[]
  items: OrderItemDto[]
}
```

### 4.4 PATCH /api/orders/:id

一期只支持更新订单级字段，不支持直接改订单商品项。

请求：

```ts
type UpdateOrderRequest = {
  orderedAt?: string
  note?: string | null
}
```

响应：

```ts
type UpdateOrderResponse = {
  orderId: string
}
```

## 5. 导入会话接口

### 5.1 POST /api/import-sessions

创建一个空导入会话。

请求：

```ts
type CreateImportSessionRequest = {
  initialPlatform?: "HEMA" | "XIAOXIANG" | "QIXIAN" | "SAMS"
}
```

响应：

```ts
type CreateImportSessionResponse = {
  importSessionId: string
  status: "DRAFT"
}
```

### 5.2 POST /api/import-sessions/:id/images

上传截图到导入会话。

当前一期采用 `multipart/form-data`。

字段：

1. `files[]`: 图片文件
2. `pageIndexes[]`: 与图片顺序对应的页码

响应：

```ts
type UploadImportImagesResponse = {
  importSessionId: string
  uploaded: Array<{
    imageId: string
    pageIndex: number
    imageUrl: string
  }>
}
```

### 5.3 POST /api/import-sessions/:id/analyze

触发一次识别。

请求：

```ts
type AnalyzeImportSessionRequest = {
  forceReanalyze?: boolean
}
```

响应：

```ts
type AnalyzeImportSessionResponse = {
  importSessionId: string
  status: "PROCESSING" | "REVIEW_REQUIRED"
}
```

### 5.4 GET /api/import-sessions/:id

获取导入草稿详情。

响应：

```ts
type ImportDraftCandidateProductDto = {
  id: string
  displayName: string
  category: { id: string; code: string; name: string }
  specText: string | null
  primaryImageUrl: string | null
}

type ImportItemDraftDto = {
  id: string
  pageIndex: number | null
  rawName: string
  normalizedName: string | null
  guessedCategory: { id: string; code: string; name: string } | null
  priceAmount: number | null
  quantity: string | null
  specText: string | null
  weightGrams: number | null
  pricePer100g: number | null
  candidateProducts: ImportDraftCandidateProductDto[]
  selectedProductId: string | null
  createNewProduct: boolean
  manualDisplayName: string | null
  manualCategoryId: string | null
  manualNote: string | null
  reviewStatus: "PENDING_REVIEW" | "MATCHED_EXISTING" | "CREATE_NEW" | "RESOLVED"
}

type ImportSessionDetailDto = {
  id: string
  status: "DRAFT" | "PROCESSING" | "REVIEW_REQUIRED" | "READY_TO_COMMIT" | "COMMITTED" | "FAILED"
  platformGuess: { code: string; label: string } | null
  selectedPlatform: { code: string; label: string } | null
  orderedAtGuess: string | null
  selectedOrderedAt: string | null
  note: string | null
  images: Array<{
    id: string
    pageIndex: number
    imageUrl: string
  }>
  itemDrafts: ImportItemDraftDto[]
  committedOrderId: string | null
}
```

### 5.5 PATCH /api/import-sessions/:id

更新订单级草稿字段。

请求：

```ts
type UpdateImportSessionRequest = {
  selectedPlatform?: "HEMA" | "XIAOXIANG" | "QIXIAN" | "SAMS"
  selectedOrderedAt?: string
  note?: string | null
}
```

响应：

```ts
type UpdateImportSessionResponse = {
  importSessionId: string
}
```

### 5.6 PATCH /api/import-item-drafts/:id

更新单个商品项草稿。

请求：

```ts
type UpdateImportItemDraftRequest = {
  priceAmount?: number
  quantity?: string
  specText?: string | null
  weightGrams?: number | null
  selectedProductId?: string | null
  createNewProduct?: boolean
  manualDisplayName?: string | null
  manualCategoryId?: string | null
  manualNote?: string | null
}
```

规则：

1. `selectedProductId` 与 `createNewProduct=true` 不能同时成立。
2. 若 `createNewProduct=true`，则提交前必须补齐 `manualDisplayName` 和 `manualCategoryId`。

响应：

```ts
type UpdateImportItemDraftResponse = {
  importItemDraftId: string
  reviewStatus: "PENDING_REVIEW" | "MATCHED_EXISTING" | "CREATE_NEW" | "RESOLVED"
  pricePer100g: number | null
}
```

### 5.7 POST /api/import-sessions/:id/commit

将草稿正式提交为订单。

请求：

```ts
type CommitImportSessionRequest = {
  markImportedProductsInStock?: boolean
}
```

响应：

```ts
type CommitImportSessionResponse = {
  orderId: string
  importSessionId: string
  createdProductIds: string[]
  linkedProductIds: string[]
}
```

## 6. 校验与错误码建议

### 6.1 常见校验错误

`VALIDATION_ERROR` 下建议使用以下字段名：

1. `selectedPlatform`
2. `selectedOrderedAt`
3. `itemDrafts.{id}.priceAmount`
4. `itemDrafts.{id}.quantity`
5. `itemDrafts.{id}.selectedProductId`
6. `itemDrafts.{id}.manualDisplayName`
7. `itemDrafts.{id}.manualCategoryId`

### 6.2 导入提交流程错误

1. `IMPORT_NOT_READY`
   - 草稿中仍有未解决商品项
2. `IMPORT_ALREADY_COMMITTED`
   - 当前导入会话已提交过
3. `CONFLICT`
   - 提交时商品或订单状态发生冲突

## 7. 一期明确不开放的接口能力

以下能力不在当前 API contract 内：

1. 商品价格历史曲线
2. 愿望清单
3. 商品合并去重后台工具
4. 购物车页或商品详情页识别
