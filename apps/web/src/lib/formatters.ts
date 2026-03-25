const datetimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
})

const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2
})

export function formatDatetime(value: string | null) {
  if (!value) {
    return "暂无"
  }

  return datetimeFormatter.format(new Date(value))
}

export function formatCurrencyFromCent(value: number | null) {
  if (value == null) {
    return "暂无"
  }

  return currencyFormatter.format(value / 100)
}
