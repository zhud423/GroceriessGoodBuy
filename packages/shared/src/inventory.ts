export const INVENTORY_STATUS_VALUES = [
  "UNKNOWN",
  "SUFFICIENT",
  "LOW",
  "OUT"
] as const

export type InventoryStatusValue = (typeof INVENTORY_STATUS_VALUES)[number]
