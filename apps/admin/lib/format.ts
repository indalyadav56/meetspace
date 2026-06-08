/** Formatting helpers for numbers, currency, and compact stats. */

export function formatCurrency(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact && Math.abs(value) >= 1000) {
    return `$${formatCompact(value)}`
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

export function formatPercent(value: number, digits = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`
}
