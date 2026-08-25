import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import {
  getActiveCurrentCycleSubscriptions,
  getCategoryBreakdown,
  getMonthlyProjection,
  getNonDeletedSubscriptions,
  getPeriodTotalForCurrentMonth,
  getSpendingHistory,
  getUniqueSubscriptionsById,
  getUpcomingSubscriptions,
} from './subscriptionAnalytics'

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

describe('subscription analytics helpers', () => {
  it('filters soft-deleted subscriptions', () => {
    expect(getNonDeletedSubscriptions([baseSubscription, { ...baseSubscription, id: 'sub-2', anulado: 1 }])).toEqual([baseSubscription])
  })

  it('deduplicates subscriptions by id', () => {
    expect(getUniqueSubscriptionsById([baseSubscription, { ...baseSubscription, amount: 20 }])).toEqual([baseSubscription])
  })

  it('advances active subscriptions to the current cycle', () => {
    const active = getActiveCurrentCycleSubscriptions([baseSubscription], new Date('2026-03-15T12:00:00'))

    expect(active[0]?.nextChargeDate).toBe('2026-04-01')
  })

  it('calculates current month totals', () => {
    expect(getPeriodTotalForCurrentMonth([baseSubscription], new Date('2026-01-15T12:00:00'))).toBe(10)
  })

  it('finds upcoming subscriptions with day offsets', () => {
    const upcoming = getUpcomingSubscriptions([baseSubscription], 7, new Date('2025-12-29T12:00:00'))

    expect(upcoming).toMatchObject([{ id: 'sub-1', inDays: 3 }])
  })

  it('builds category breakdown percentages', () => {
    expect(getCategoryBreakdown([baseSubscription], new Date('2026-01-15T12:00:00'))).toEqual([
      { name: 'Entretenimiento', amount: 10, pct: 100 },
    ])
  })

  it('keeps current-month projection even when the charge date has already passed', () => {
    const projection = getMonthlyProjection([baseSubscription], new Date('2026-01-15T12:00:00'))

    expect(projection[0]).toMatchObject({ label: 'ene', amount: 10 })
  })

  it('builds spending history newest first', () => {
    const history = getSpendingHistory([baseSubscription], new Date('2026-01-15T12:00:00'))

    expect(history.map((item) => item.amount)).toEqual([10, 0])
  })
})
