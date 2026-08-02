import { describe, expect, it } from 'vitest'
import { getBudgetStatus, normalizeBudgetLimit } from './budget'

describe('budget helpers', () => {
  it('normalizes invalid or negative limits to disabled', () => {
    expect(normalizeBudgetLimit(Number.NaN)).toBe(0)
    expect(normalizeBudgetLimit(-10)).toBe(0)
    expect(normalizeBudgetLimit(0)).toBe(0)
  })

  it('rounds valid limits to cents', () => {
    expect(normalizeBudgetLimit(120.456)).toBe(120.46)
  })

  it('detects a safe budget status', () => {
    expect(getBudgetStatus(50, 100)).toMatchObject({
      enabled: true,
      percent: 50,
      remaining: 50,
      isNearLimit: false,
      isExceeded: false,
    })
  })

  it('detects near-limit and exceeded budgets', () => {
    expect(getBudgetStatus(85, 100)).toMatchObject({ isNearLimit: true, isExceeded: false })
    expect(getBudgetStatus(120, 100)).toMatchObject({ isNearLimit: false, isExceeded: true, remaining: -20 })
  })
})
