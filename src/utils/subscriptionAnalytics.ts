import type { Subscription } from '../types'
import { advanceToCurrentOrFutureDate, diffInDays, monthKey, toLocalNoonDate } from './date'
import {
  calculatePeriodTotal,
  getSubscriptionChargesForPeriod,
  isChargeWithinPaymentEndDate,
} from './subscription'

export type UpcomingSubscription = Subscription & { inDays: number }
export type CategoryBreakdownItem = { name: string; amount: number; pct: number }
export type MonthlyProjectionItem = { key: string; label: string; amount: number; height: number }
export type SpendingHistoryItem = { key: string; label: string; amount: number }

export const getNonDeletedSubscriptions = (subscriptions: Subscription[]) =>
  subscriptions.filter((subscription) => subscription.anulado !== 1)

export const getCurrentCycleSubscriptions = (subscriptions: Subscription[], now = new Date()) =>
  subscriptions.map((item) => {
    if (item.status !== 'activa') return item
    return { ...item, nextChargeDate: advanceToCurrentOrFutureDate(item.nextChargeDate, item.frequency, now) }
  })

export const getActiveCurrentCycleSubscriptions = (subscriptions: Subscription[], now = new Date()) =>
  getCurrentCycleSubscriptions(subscriptions, now)
    .filter((item) => item.status === 'activa' && isChargeWithinPaymentEndDate(item, toLocalNoonDate(item.nextChargeDate)))

export const getUniqueSubscriptionsById = (subscriptions: Subscription[]) => {
  const seen = new Set<string>()
  return subscriptions.filter((subscription) => {
    if (seen.has(subscription.id)) return false
    seen.add(subscription.id)
    return true
  })
}

export const getActiveSubscriptions = (subscriptions: Subscription[]) =>
  subscriptions.filter((subscription) => subscription.status === 'activa')

export const getPeriodTotalForCurrentMonth = (subscriptions: Subscription[], now = new Date()) =>
  calculatePeriodTotal(
    subscriptions,
    new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0),
    new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0),
  )

export const getPeriodTotalForCurrentYear = (subscriptions: Subscription[], now = new Date()) =>
  calculatePeriodTotal(
    subscriptions,
    new Date(now.getFullYear(), 0, 1, 12, 0, 0),
    new Date(now.getFullYear() + 1, 0, 1, 12, 0, 0),
  )

export const getUpcomingSubscriptions = (
  activeSubscriptions: Subscription[],
  maxDays: number,
  today = new Date(),
): UpcomingSubscription[] =>
  activeSubscriptions
    .map((item) => ({ ...item, inDays: diffInDays(today, new Date(`${item.nextChargeDate}T12:00:00`)) }))
    .filter((item) => item.inDays >= 0 && item.inDays <= maxDays)
    .sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate))

export const getCategoryBreakdown = (
  activeSubscriptions: Subscription[],
  now = new Date(),
): CategoryBreakdownItem[] => {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0)
  const totals: Record<string, number> = {}

  activeSubscriptions.forEach((subscription) => {
    const category = subscription.category?.trim() || 'General'
    const amount = calculatePeriodTotal([subscription], monthStart, monthEnd)
    if (amount > 0) totals[category] = (totals[category] ?? 0) + amount
  })

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const max = entries[0]?.[1] ?? 1
  return entries.map(([name, amount]) => ({ name, amount, pct: Math.round((amount / max) * 100) }))
}

export const getMonthlyProjection = (
  activeSubscriptions: Subscription[],
  now = new Date(),
): MonthlyProjectionItem[] => {
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
  const monthSlots = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1, 12, 0, 0)
    return { key: monthKey(date), label: new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date), amount: 0 }
  })
  const endMonthExclusive = new Date(now.getFullYear(), now.getMonth() + 6, 1, 12, 0, 0)

  activeSubscriptions.forEach((subscription) => {
    getSubscriptionChargesForPeriod([subscription], startMonth, endMonthExclusive).forEach(({ chargeDate, subscription: chargedSubscription }) => {
      const idx = (chargeDate.getFullYear() - startMonth.getFullYear()) * 12 + (chargeDate.getMonth() - startMonth.getMonth())
      if (idx >= 0 && idx < monthSlots.length) monthSlots[idx].amount += chargedSubscription.amount
    })
  })

  const maxAmount = Math.max(1, ...monthSlots.map((item) => item.amount))
  return monthSlots.map((item) => ({ ...item, height: item.amount === 0 ? 8 : Math.max(12, (item.amount / maxAmount) * 100) }))
}

export const getSpendingHistory = (
  effectiveSubscriptions: Subscription[],
  now = new Date(),
): SpendingHistoryItem[] => {
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
  const historyEndExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0)

  const oldestMonthStart = effectiveSubscriptions.reduce((oldest, subscription) => {
    const created = new Date(subscription.createdAt)
    if (Number.isNaN(created.getTime())) return oldest
    const createdMonthStart = new Date(created.getFullYear(), created.getMonth(), 1, 12, 0, 0)
    return createdMonthStart < oldest ? createdMonthStart : oldest
  }, currentMonthStart)

  const monthCount =
    (currentMonthStart.getFullYear() - oldestMonthStart.getFullYear()) * 12 +
    (currentMonthStart.getMonth() - oldestMonthStart.getMonth()) + 1

  const monthSlots = Array.from({ length: monthCount }, (_, i) => {
    const date = new Date(oldestMonthStart.getFullYear(), oldestMonthStart.getMonth() + i, 1, 12, 0, 0)
    return { key: monthKey(date), label: new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(date), amount: 0 }
  })

  getSubscriptionChargesForPeriod(effectiveSubscriptions, oldestMonthStart, historyEndExclusive, { includeInactive: true }).forEach(({ chargeDate, subscription }) => {
    const idx = (chargeDate.getFullYear() - oldestMonthStart.getFullYear()) * 12 + (chargeDate.getMonth() - oldestMonthStart.getMonth())
    if (idx >= 0 && idx < monthSlots.length) monthSlots[idx].amount += subscription.amount
  })

  return [...monthSlots].reverse()
}
