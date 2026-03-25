import { ProductsScreen } from "@/src/components/products/products-screen"

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string
    categoryId?: string
    platform?: string
    inventoryStatus?: string
  }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams

  return (
    <ProductsScreen
      initialSearch={params.q}
      initialCategoryId={params.categoryId}
      initialPlatform={params.platform}
      initialInventoryStatus={params.inventoryStatus}
    />
  )
}
