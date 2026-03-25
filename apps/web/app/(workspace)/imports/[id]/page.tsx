import { ImportOrderScreen } from "@/src/components/imports/import-order-screen"

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function ImportSessionPage({ params }: PageProps) {
  const { id } = await params

  return <ImportOrderScreen initialImportSessionId={id} />
}
