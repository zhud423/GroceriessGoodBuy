# Code Review Fixes — Implementation Plan

Implement 6 safe, isolated fixes from the code review. These are non-breaking, backend-only changes.

## Proposed Changes

### Shared Product Helpers (#2 + #3)

Extract 3 duplicated functions from `imports/service.ts` and `orders/service.ts` into a shared module, and optimize `refreshProductOrderAggregates` to use fewer queries.

#### [NEW] [helpers.ts](file:///Users/dong/Documents/GroceriessGoodBuy/apps/web/src/server/products/helpers.ts)

Extract `ensureOwnedProduct`, `upsertProductAlias`, and `refreshProductOrderAggregates` here. Optimize `refreshProductOrderAggregates` to use 2 queries instead of 3 (combine `earliestPlatformItem` and `latestPlatformItem` into a single aggregate query).

#### [MODIFY] [service.ts](file:///Users/dong/Documents/GroceriessGoodBuy/apps/web/src/server/imports/service.ts)

Remove local `ensureOwnedProduct`, `upsertProductAlias`, `refreshProductOrderAggregates` definitions. Import from `../products/helpers`.

#### [MODIFY] [service.ts](file:///Users/dong/Documents/GroceriessGoodBuy/apps/web/src/server/orders/service.ts)

Remove local `ensureOwnedProduct`, `upsertProductAlias`, `refreshProductOrderAggregates` definitions. Import from `../products/helpers`.

---

### Vision Provider Singleton (#4)

#### [MODIFY] [vision.ts](file:///Users/dong/Documents/GroceriessGoodBuy/apps/web/src/server/imports/vision.ts)

Cache the provider instance at module level. `getConfiguredProvider()` returns the cached instance on subsequent calls.

---

### Signed URL Cache Limit (#5)

#### [MODIFY] [storage.ts](file:///Users/dong/Documents/GroceriessGoodBuy/apps/web/src/server/storage.ts)

Add a `MAX_SIGNED_URL_CACHE_SIZE` constant (e.g. 5000). Before inserting a new cache entry, if the map exceeds the limit, delete the oldest entries. This is a simple eviction strategy without adding a dependency.

---

### Background Task Timeout (#6)

#### [MODIFY] [background-tasks.ts](file:///Users/dong/Documents/GroceriessGoodBuy/apps/web/src/server/background-tasks.ts)

Wrap each task runner with an `AbortController` + `setTimeout` (default 5 minutes). On timeout, reject the promise and clean up the registry entry.

---

### Timing-Safe Password Comparison (#7)

#### [MODIFY] [test-auth.ts](file:///Users/dong/Documents/GroceriessGoodBuy/apps/web/src/server/test-auth.ts)

Replace `account.password === password` with `timingSafeEqual` comparison (already imported in this file).

---

### PlatformCode Type Guard (#11)

#### [MODIFY] [platforms.ts](file:///Users/dong/Documents/GroceriessGoodBuy/packages/shared/src/platforms.ts)

Add and export `isPlatformCode(value: string): value is PlatformCode`.

---

## Verification Plan

### Automated

- `pnpm build` — TypeScript compilation across the entire monorepo to catch type errors and missing imports.

### Manual (user-assisted)

- Ask user to `pnpm dev` and test a basic import flow to confirm no runtime regressions.
