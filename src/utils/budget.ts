export type BudgetStatus = {
  enabled: boolean
  limit: number
  spent: number
  remaining: number
  percent: number
  isNearLimit: boolean
  isExceeded: boolean
}

export const normalizeBudgetLimit = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 100) / 100
}

export const getBudgetStatus = (spent: number, limit: number): BudgetStatus => {
  const safeLimit = normalizeBudgetLimit(limit)
  const safeSpent = Math.max(0, Number.isFinite(spent) ? spent : 0)
  const enabled = safeLimit > 0
  const percent = enabled ? Math.round((safeSpent / safeLimit) * 100) : 0

  return {
    enabled,
    limit: safeLimit,
    spent: safeSpent,
    remaining: safeLimit - safeSpent,
    percent,
    isNearLimit: enabled && percent >= 80 && percent < 100,
    isExceeded: enabled && safeSpent > safeLimit,
  }
}
