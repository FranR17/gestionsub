import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import { nextCycleDate } from './date'
import {
  calculatePeriodTotal,
  equalSplit,
  getSubscriptionChargesForPeriod,
  normalizeReminder,
  toChargePaymentKey,
} from './subscription'

const baseSubscription: Subscription = {
  id: 'sub-1',
  name: 'Netflix',
  amount: 10,
  frequency: 'mensual',
  nextChargeDate: '2026-01-01',
  paymentEndDate: null,
  createdAt: '2025-12-01T12:00:00.000Z',
  category: 'Entretenimiento',
  reminderDays: 3,
  reminderTime: '09:00',
  status: 'activa',
  anulado: 0,
}

const period = (start: string, end: string) => ({
  start: new Date(`${start}T12:00:00`),
  end: new Date(`${end}T12:00:00`),
})

describe('subscription calculations', () => {
  it('splits cents without losing the total', () => {
    const split = equalSplit(10, 3)

    expect(split).toEqual([3.34, 3.33, 3.33])
    expect(split.reduce((total, item) => total + item, 0)).toBeCloseTo(10)
  })

  it('normalizes reminder values to the supported range', () => {
    expect(normalizeReminder(0)).toBe(0)
    expect(normalizeReminder(14)).toBe(14)
    expect(normalizeReminder(31)).toBe(3)
    expect(normalizeReminder(-1)).toBe(3)
  })

  it('generates monthly charges inside the selected period', () => {
    const { start, end } = period('2026-01-01', '2026-04-01')
    const charges = getSubscriptionChargesForPeriod([baseSubscription], start, end)

    expect(charges.map((charge) => charge.isoDate)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ])
  })

  it('honors paymentEndDate inclusively', () => {
    const { start, end } = period('2026-01-01', '2026-04-01')
    const charges = getSubscriptionChargesForPeriod([
      { ...baseSubscription, paymentEndDate: '2026-02-01' },
    ], start, end)

    expect(charges.map((charge) => charge.isoDate)).toEqual(['2026-01-01', '2026-02-01'])
  })

  it('does not count charges before subscription creation', () => {
    const { start, end } = period('2026-01-01', '2026-04-01')
    const charges = getSubscriptionChargesForPeriod([
      { ...baseSubscription, createdAt: '2026-01-15T12:00:00.000Z' },
    ], start, end)

    expect(charges.map((charge) => charge.isoDate)).toEqual(['2026-02-01', '2026-03-01'])
  })

  it('excludes inactive subscriptions unless requested', () => {
    const { start, end } = period('2026-01-01', '2026-02-01')
    const cancelled: Subscription = { ...baseSubscription, status: 'cancelada' }

    expect(getSubscriptionChargesForPeriod([cancelled], start, end)).toHaveLength(0)
    expect(getSubscriptionChargesForPeriod([cancelled], start, end, { includeInactive: true })).toHaveLength(1)
  })

  it('calculates period totals from generated charges', () => {
    const { start, end } = period('2026-01-01', '2026-04-01')

    expect(calculatePeriodTotal([baseSubscription], start, end)).toBe(30)
  })

  it('keeps month-end cycles clamped to valid dates', () => {
    expect(nextCycleDate('2026-01-31', 'mensual')).toBe('2026-02-28')
    expect(nextCycleDate('2026-02-28', 'mensual')).toBe('2026-03-28')
  })

  it('builds stable charge payment keys', () => {
    expect(toChargePaymentKey('sub-1', '2026-01-01')).toBe('sub-1__2026-01-01')
  })

})
