const currencyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function roundCurrencyAmount(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export function formatCurrency(value: number) {
  return `₹${currencyFormatter.format(roundCurrencyAmount(value))}`
}
