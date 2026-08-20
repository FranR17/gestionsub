import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import { nextCycleDate } from './date'
import {
  calculatePeriodTotal,
  equalSplit,
  getSubscriptionChargesForPeriod,
  normalizeAppKey,
  normalizeReminder,
  pickBestAppMatch,
  toChargePaymentKey,
} from './subscription'

const subscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 'sub-1',
  name: 'Servicio',
  amount: 10,
  frequency: 'mensual',
  nextChargeDate: '2026-08-15',
  paymentEndDate: null,
  createdAt: '2025-12-01T12:00:00.000Z',
  category: 'General',
  reminderDays: 3,
  reminderTime: '09:00',
  status: 'activa',
  anulado: 0,
  ...overrides,
})

const period = (start: string, end: string) => ({
  start: new Date(`${start}T12:00:00`),
  end: new Date(`${end}T12:00:00`),
})

describe('subscription utilities', () => {
  it('normalizes reminder values to the supported range', () => {
    expect(normalizeReminder(2.6)).toBe(3)
    expect(normalizeReminder(0)).toBe(0)
    expect(normalizeReminder(14)).toBe(14)
    expect(normalizeReminder(30)).toBe(30)
    expect(normalizeReminder(31)).toBe(3)
    expect(normalizeReminder(-1)).toBe(3)
  })

  it('splits amounts exactly in cents', () => {
    const shares = equalSplit(10, 3)
    expect(shares).toEqual([3.34, 3.33, 3.33])
    expect(shares.reduce((total, share) => total + share, 0)).toBeCloseTo(10)
    expect(equalSplit(10, 0)).toEqual([])
  })

  it('builds stable payment keys', () => {
    expect(toChargePaymentKey('sub-1', '2026-08-18')).toBe('sub-1__2026-08-18')
  })

  it('normalizes app names and prefers exact App Store matches', () => {
    const results = [
      { id: 1, name: 'Netflix Stories', iconUrl: 'first.png', category: 'Games' },
      { id: 2, name: 'Netflix', iconUrl: 'exact.png', category: 'Entertainment' },
    ]

    expect(normalizeAppKey('  NetFlix ')).toBe('netflix')
    expect(pickBestAppMatch(' netflix ', results)?.id).toBe(2)
    expect(pickBestAppMatch('unknown', results)?.id).toBe(1)
    expect(pickBestAppMatch('unknown', [])).toBeNull()
  })

  it('calculates one monthly charge inside a period', () => {
    const total = calculatePeriodTotal(
      [subscription()],
      new Date(2026, 7, 1, 12),
      new Date(2026, 8, 1, 12),
    )

    expect(total).toBe(10)
  })

  it('counts recurring weekly charges and excludes the end boundary', () => {
    const total = calculatePeriodTotal(
      [subscription({ amount: 2, frequency: 'semanal', nextChargeDate: '2026-08-03' })],
      new Date(2026, 7, 1, 12),
      new Date(2026, 8, 1, 12),
    )

    expect(total).toBe(10)
  })

  it('adds totals from multiple subscription frequencies', () => {
    const total = calculatePeriodTotal(
      [
        subscription({ id: 'monthly', amount: 12 }),
        subscription({ id: 'annual', amount: 100, frequency: 'anual', nextChargeDate: '2026-08-20' }),
      ],
      new Date(2026, 7, 1, 12),
      new Date(2026, 8, 1, 12),
    )

    expect(total).toBe(112)
  })

  it('generates monthly charges inside the selected period', () => {
    const { start, end } = period('2026-01-01', '2026-04-01')
    const charges = getSubscriptionChargesForPeriod([
      subscription({ nextChargeDate: '2026-01-01', name: 'Netflix', category: 'Entretenimiento' }),
    ], start, end)

    expect(charges.map((charge) => charge.isoDate)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ])
  })

  it('honors paymentEndDate inclusively', () => {
    const { start, end } = period('2026-01-01', '2026-04-01')
    const charges = getSubscriptionChargesForPeriod([
      subscription({ nextChargeDate: '2026-01-01', paymentEndDate: '2026-02-01' }),
    ], start, end)

    expect(charges.map((charge) => charge.isoDate)).toEqual(['2026-01-01', '2026-02-01'])
  })

  it('does not count charges before subscription creation', () => {
    const { start, end } = period('2026-01-01', '2026-04-01')
    const charges = getSubscriptionChargesForPeriod([
      subscription({ nextChargeDate: '2026-01-01', createdAt: '2026-01-15T12:00:00.000Z' }),
    ], start, end)

    expect(charges.map((charge) => charge.isoDate)).toEqual(['2026-02-01', '2026-03-01'])
  })

  it('excludes inactive subscriptions unless requested', () => {
    const { start, end } = period('2026-01-01', '2026-02-01')
    const cancelled = subscription({ nextChargeDate: '2026-01-01', status: 'cancelada' })

    expect(getSubscriptionChargesForPeriod([cancelled], start, end)).toHaveLength(0)
    expect(getSubscriptionChargesForPeriod([cancelled], start, end, { includeInactive: true })).toHaveLength(1)
  })

  it('keeps month-end cycles clamped to valid dates', () => {
    expect(nextCycleDate('2026-01-31', 'mensual')).toBe('2026-02-28')
    expect(nextCycleDate('2026-02-28', 'mensual')).toBe('2026-03-28')
  })
})
