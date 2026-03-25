type PriceCalcInput = {
  linePriceAmount: number
  quantity?: number | string | null
  weightGrams?: number | null
}

export function calculatePricePer100g({
  linePriceAmount,
  quantity,
  weightGrams
}: PriceCalcInput) {
  if (weightGrams == null || weightGrams <= 0) {
    return null
  }

  const quantityValue = quantity == null ? 1 : Number(quantity)

  if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
    return null
  }

  const totalWeight = weightGrams * quantityValue

  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return null
  }

  return Math.round((linePriceAmount / totalWeight) * 100)
}
