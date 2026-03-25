import { OrderDetailScreen } from "@/src/components/orders/order-detail-screen"

export default async function OrderDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <OrderDetailScreen orderId={id} />
}
