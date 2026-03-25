import { OrdersScreen } from "@/src/components/orders/orders-screen"

type OrdersPageProps = {
  searchParams: Promise<{
    platform?: string
  }>
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams

  return <OrdersScreen initialPlatform={params.platform} />
}
