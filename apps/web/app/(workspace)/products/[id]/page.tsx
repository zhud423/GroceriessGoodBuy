import { ProductDetailScreen } from "@/src/components/products/product-detail-screen"

export default async function ProductDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <ProductDetailScreen productId={id} />
}
