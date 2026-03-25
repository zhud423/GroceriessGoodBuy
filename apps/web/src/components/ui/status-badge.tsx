const inventoryStatusLabelMap = {
  UNKNOWN: "未知",
  SUFFICIENT: "充足",
  LOW: "快没了",
  OUT: "已用完"
} as const

const inventoryStatusClassMap = {
  UNKNOWN: "bg-stone-100 text-stone-700",
  SUFFICIENT: "bg-emerald-100 text-emerald-700",
  LOW: "bg-amber-100 text-amber-700",
  OUT: "bg-rose-100 text-rose-700"
} as const

export function InventoryStatusBadge({
  status
}: {
  status: keyof typeof inventoryStatusLabelMap
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${inventoryStatusClassMap[status]}`}
    >
      {inventoryStatusLabelMap[status]}
    </span>
  )
}
