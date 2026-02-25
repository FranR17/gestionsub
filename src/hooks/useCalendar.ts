import { useCallback, useMemo, useState } from 'react'
import type { Subscription } from '../types'
import { storageKeys } from '../constants'
import { usePersistedState } from './usePersistedState'
import {
  nextCycleDate,
  previousCycleDate,
  toIsoDate,
  toLocalNoonDate,
} from '../utils/date'
import { toChargePaymentKey } from '../utils/subscription'

export function useCalendar(scopedSubscriptions: Subscription[]) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
  })
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toIsoDate(new Date()))
  const [chargePayments, setChargePayments] = usePersistedState<Record<string, boolean>>(storageKeys.chargePayments, {})

  const calendarChargesByDate = useMemo(() => {
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1, 12, 0, 0)
    const endExclusive = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1, 12, 0, 0)
    const map = new Map<string, Subscription[]>()

    scopedSubscriptions
      .filter((item) => item.status === 'activa')
      .forEach((sub) => {
        let chargeDate = toLocalNoonDate(sub.nextChargeDate)
        const createdAt = new Date(sub.createdAt)
        const createdDate = Number.isNaN(createdAt.getTime()) ? start : new Date(createdAt)
        let guard = 0

        while (chargeDate >= endExclusive && guard < 360) {
          chargeDate = toLocalNoonDate(previousCycleDate(toIsoDate(chargeDate), sub.frequency))
          guard += 1
        }
        while (chargeDate < start && guard < 720) {
          chargeDate = toLocalNoonDate(nextCycleDate(toIsoDate(chargeDate), sub.frequency))
          guard += 1
        }
        while (chargeDate < endExclusive && guard < 1080) {
          if (chargeDate >= start && chargeDate >= createdDate) {
            const key = toIsoDate(chargeDate)
            const items = map.get(key) ?? []
            items.push(sub)
            map.set(key, items)
          }
          chargeDate = toLocalNoonDate(nextCycleDate(toIsoDate(chargeDate), sub.frequency))
          guard += 1
        }
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
    setChargePayments((cur) => ({ ...cur, [key]: !cur[key] }))
  }, [setChargePayments])

  return {
    calendarMonth, setCalendarMonth,
    selectedCalendarDate, setSelectedCalendarDate,
    chargePayments,
    calendarChargesByDate, calendarCells,
    selectedDayCharges, selectedDayPendingCount,
    calendarMonthLabel,
    handleToggleChargePaid,
  }
}
