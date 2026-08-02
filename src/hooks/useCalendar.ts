import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Subscription } from '../types'
import { storageKeys } from '../constants'
import { usePersistedState } from './usePersistedState'
import { hasSupabase, supabase } from '../lib/supabase'
import { toIsoDate } from '../utils/date'
import { getSubscriptionChargesForPeriod, toChargePaymentKey } from '../utils/subscription'

type ChargePaymentRow = {
  subscription_id: string
  charge_date: string
  is_paid: boolean
}

export function useCalendar(scopedSubscriptions: Subscription[], userId: string | null) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
  })
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toIsoDate(new Date()))
  const [chargePayments, setChargePayments] = usePersistedState<Record<string, boolean>>(storageKeys.chargePayments, {})

  useEffect(() => {
    if (!hasSupabase || !supabase || !userId) return

    let cancelled = false
    void supabase
      .from('charge_payments')
      .select('subscription_id,charge_date,is_paid')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        setChargePayments((current) => {
          const next = { ...current }
          ;(data as ChargePaymentRow[]).forEach((row) => {
            next[toChargePaymentKey(String(row.subscription_id), String(row.charge_date))] = Boolean(row.is_paid)
          })
          return next
        })
      })

    return () => { cancelled = true }
  }, [setChargePayments, userId])

  const calendarChargesByDate = useMemo(() => {
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1, 12, 0, 0)
    const endExclusive = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1, 12, 0, 0)
    const map = new Map<string, Subscription[]>()

    getSubscriptionChargesForPeriod(scopedSubscriptions, start, endExclusive)
      .forEach(({ subscription, isoDate }) => {
        const items = map.get(isoDate) ?? []
        items.push(subscription)
        map.set(isoDate, items)
      })

    map.forEach((items, key) => {
      map.set(key, [...items].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })))
    })
    return map
  }, [calendarMonth, scopedSubscriptions])

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1, 12, 0, 0)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const leading = (firstDay.getDay() + 6) % 7

    return Array.from({ length: leading + daysInMonth }, (_, i) => {
      if (i < leading) {
        return { key: `empty-${i}`, iso: '', day: 0, isEmpty: true, isToday: false, isSelected: false, chargesCount: 0, paidCount: 0, pendingCount: 0 }
      }
      const day = i - leading + 1
      const date = new Date(year, month, day, 12, 0, 0)
      const iso = toIsoDate(date)
      const todayIso = toIsoDate(new Date())
      const chargesCount = calendarChargesByDate.get(iso)?.length ?? 0
      const paidCount = calendarChargesByDate.get(iso)?.filter((item) => chargePayments[toChargePaymentKey(item.id, iso)]).length ?? 0

      return {
        key: iso, iso, day, isEmpty: false,
        isToday: iso === todayIso,
        isSelected: iso === selectedCalendarDate,
        chargesCount, paidCount,
        pendingCount: Math.max(0, chargesCount - paidCount),
      }
    })
  }, [calendarChargesByDate, calendarMonth, chargePayments, selectedCalendarDate])

  const selectedDayCharges = useMemo(
    () => calendarChargesByDate.get(selectedCalendarDate) ?? [],
    [calendarChargesByDate, selectedCalendarDate],
  )

  const selectedDayPendingCount = useMemo(
    () => selectedDayCharges.filter((item) => !chargePayments[toChargePaymentKey(item.id, selectedCalendarDate)]).length,
    [chargePayments, selectedCalendarDate, selectedDayCharges],
  )

  const calendarMonthLabel = useMemo(
    () => new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(calendarMonth),
    [calendarMonth],
  )

  const handleToggleChargePaid = useCallback((subscriptionId: string, isoDate: string) => {
    const key = toChargePaymentKey(subscriptionId, isoDate)
    const nextPaid = !chargePayments[key]
    setChargePayments((cur) => ({ ...cur, [key]: nextPaid }))

    if (!hasSupabase || !supabase || !userId) return

    if (nextPaid) {
      void supabase.from('charge_payments').upsert({
        user_id: userId,
        subscription_id: subscriptionId,
        charge_date: isoDate,
        is_paid: true,
      }, { onConflict: 'user_id,subscription_id,charge_date' })
      return
    }

    void supabase
      .from('charge_payments')
      .delete()
      .eq('user_id', userId)
      .eq('subscription_id', subscriptionId)
      .eq('charge_date', isoDate)
  }, [chargePayments, setChargePayments, userId])

  const monthlyPaymentSummary = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
    const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0)
    const charges = getSubscriptionChargesForPeriod(scopedSubscriptions, start, endExclusive)

    return charges.reduce(
      (summary, { subscription, isoDate }) => {
        const isPaid = Boolean(chargePayments[toChargePaymentKey(subscription.id, isoDate)])
        summary.totalAmount += subscription.amount
        summary.totalCount += 1
        if (isPaid) {
          summary.paidAmount += subscription.amount
          summary.paidCount += 1
        } else {
          summary.pendingAmount += subscription.amount
          summary.pendingCount += 1
        }
        return summary
      },
      { totalAmount: 0, paidAmount: 0, pendingAmount: 0, totalCount: 0, paidCount: 0, pendingCount: 0 },
    )
  }, [chargePayments, scopedSubscriptions])

  // ── Today's pending charges (across all months) ──
  const todayPendingCharges = useMemo(() => {
    // We need today's charges even if viewing another month.
    // calendarChargesByDate only has the displayed month, so compute from scopedSubscriptions directly.
    const todayDate = new Date()
    const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 12, 0, 0)
    const endExclusive = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + 1, 12, 0, 0)

    return getSubscriptionChargesForPeriod(scopedSubscriptions, start, endExclusive)
      .filter(({ subscription, isoDate }) => !chargePayments[toChargePaymentKey(subscription.id, isoDate)])
      .map(({ subscription }) => subscription)
  }, [scopedSubscriptions, chargePayments])

  const handleMarkAllTodayPaid = useCallback(() => {
    const todayDate = new Date()
    const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 12, 0, 0)
    const endExclusive = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + 1, 12, 0, 0)
    const todayCharges = getSubscriptionChargesForPeriod(scopedSubscriptions, start, endExclusive)
    setChargePayments((cur) => {
      const next = { ...cur }
      for (const { subscription, isoDate } of todayCharges) {
        next[toChargePaymentKey(subscription.id, isoDate)] = true
      }
      return next
    })

    if (!hasSupabase || !supabase || !userId || todayCharges.length === 0) return
    void supabase.from('charge_payments').upsert(
      todayCharges.map(({ subscription, isoDate }) => ({
        user_id: userId,
        subscription_id: subscription.id,
        charge_date: isoDate,
        is_paid: true,
      })),
      { onConflict: 'user_id,subscription_id,charge_date' },
    )
  }, [scopedSubscriptions, setChargePayments, userId])

  return {
    calendarMonth, setCalendarMonth,
    selectedCalendarDate, setSelectedCalendarDate,
    chargePayments,
    calendarChargesByDate, calendarCells,
    selectedDayCharges, selectedDayPendingCount,
    calendarMonthLabel,
    monthlyPaymentSummary,
    handleToggleChargePaid,
    todayPendingCharges,
    handleMarkAllTodayPaid,
  }
}
