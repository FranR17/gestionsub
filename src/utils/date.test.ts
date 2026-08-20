import { describe, expect, it } from 'vitest'
import {
  addMonthsClamped,
  advanceToCurrentOrFutureDate,
  diffInDays,
  nextCycleDate,
  previousCycleDate,
  toIsoDate,
} from './date'

describe('date utilities', () => {
  it('formats local dates as ISO dates', () => {
    expect(toIsoDate(new Date(2026, 7, 5, 12))).toBe('2026-08-05')
  })

  it('calculates calendar-day differences across month boundaries', () => {
    expect(diffInDays(new Date(2026, 7, 31), new Date(2026, 8, 2))).toBe(2)
    expect(diffInDays(new Date(2026, 8, 2), new Date(2026, 7, 31))).toBe(-2)
  })

  it('clamps month additions to the last valid day', () => {
    expect(toIsoDate(addMonthsClamped(new Date(2026, 0, 31), 1))).toBe('2026-02-28')
    expect(toIsoDate(addMonthsClamped(new Date(2024, 0, 31), 1))).toBe('2024-02-29')
    expect(toIsoDate(addMonthsClamped(new Date(2026, 2, 31), -1))).toBe('2026-02-28')
  })

  it('moves forward according to every supported frequency', () => {
    expect(nextCycleDate('2026-08-18', 'semanal')).toBe('2026-08-25')
    expect(nextCycleDate('2026-01-31', 'mensual')).toBe('2026-02-28')
    expect(nextCycleDate('2026-08-31', 'trimestral')).toBe('2026-11-30')
    expect(nextCycleDate('2024-02-29', 'anual')).toBe('2025-02-28')
  })

  it('moves backward according to the subscription frequency', () => {
    expect(previousCycleDate('2026-08-18', 'semanal')).toBe('2026-08-11')
    expect(previousCycleDate('2026-03-31', 'mensual')).toBe('2026-02-28')
    expect(previousCycleDate('2026-08-31', 'trimestral')).toBe('2026-05-31')
    expect(previousCycleDate('2025-02-28', 'anual')).toBe('2024-02-28')
  })

  it('advances past charges to the first current or future cycle', () => {
    expect(
      advanceToCurrentOrFutureDate('2026-05-10', 'mensual', new Date(2026, 7, 18, 12)),
    ).toBe('2026-09-10')
  })
})
