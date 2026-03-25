import { OrderEditScreen } from "@/src/components/orders/order-edit-screen"

type OrderEditPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function OrderEditPage({ params }: OrderEditPageProps) {
  const { id } = await params

  return <OrderEditScreen orderId={id} />
}
