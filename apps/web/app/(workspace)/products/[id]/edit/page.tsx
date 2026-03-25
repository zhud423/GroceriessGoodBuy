import { ProductEditorScreen } from "@/src/components/products/product-editor-screen"

type ProductEditPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function ProductEditPage({ params }: ProductEditPageProps) {
  const { id } = await params

  return <ProductEditorScreen mode="edit" productId={id} />
}
