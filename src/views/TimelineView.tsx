import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Subscription } from '../types'
import { getSubscriptionVisual } from '../constants/subscriptionVisuals'
import { iconOptionByKey, weekDayLabels } from '../constants'
import { formatCurrency } from '../utils/format'
import { toChargePaymentKey, normalizeAppKey } from '../utils/subscription'
import { toIsoDate } from '../utils/date'

type CalendarCell = {
  key: string
  iso: string
  day: number
  isEmpty: boolean
  isToday: boolean
  isSelected: boolean
  chargesCount: number
  paidCount: number
  pendingCount: number
}

export type TimelineViewProps = {
  calendarMonth: Date
  setCalendarMonth: (v: Date) => void
  calendarMonthLabel: string
  selectedCalendarDate: string
  setSelectedCalendarDate: (v: string) => void
  calendarCells: CalendarCell[]
  calendarChargesByDate: Map<string, Subscription[]>
  selectedDayCharges: Subscription[]
  selectedDayPendingCount: number
  chargePayments: Record<string, boolean>
  currency: string
  appLogoCache: Record<string, string>
  handleToggleChargePaid: (subscriptionId: string, isoDate: string) => void
}

export function TimelineView({
  calendarMonth,
  setCalendarMonth,
  selectedCalendarDate,
  setSelectedCalendarDate,
  calendarCells,
  calendarChargesByDate,
  selectedDayCharges,
  selectedDayPendingCount,
  chargePayments,
  currency,
  appLogoCache,
  handleToggleChargePaid,
}: TimelineViewProps) {
  const [monthDirection, setMonthDirection] = useState<-1 | 1>(1)
  const reducedMotion = Boolean(useReducedMotion())
  const selectedDate = new Date(`${selectedCalendarDate}T12:00:00`)
  const selectedWeekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(selectedDate)
  const selectedMonth = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(selectedDate)
  const selectedDateLabel = `${selectedWeekday.charAt(0).toUpperCase()}${selectedWeekday.slice(1)} ${selectedDate.getDate()} ${selectedMonth}`
  const calendarMonthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(calendarMonth)
  const calendarMonthTitle = `${calendarMonthName.charAt(0).toUpperCase()}${calendarMonthName.slice(1)} ${calendarMonth.getFullYear()}`

  const changeMonth = (direction: -1 | 1) => {
    setMonthDirection(direction)
    const target = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + direction, 1, 12, 0, 0)
    setCalendarMonth(target)
    setSelectedCalendarDate(toIsoDate(target))
  }

  return (
    <div className="tl">
      {/* ── Calendar ────────────────────────────── */}
      <section className="tl-cal">
        <div className="tl-cal-nav">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Mes anterior"
          >‹</button>
          <strong>{calendarMonthTitle}</strong>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Mes siguiente"
          >›</button>
        </div>
        <div className="tl-weekdays">
          {weekDayLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={`${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}`}
            className="tl-grid"
            initial={reducedMotion ? false : { opacity: 0.94, x: monthDirection * 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0.94, x: monthDirection * -4, pointerEvents: 'none' }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {calendarCells.map((cell) => {
            const daySubs = !cell.isEmpty ? (calendarChargesByDate.get(cell.iso) ?? []) : []
            return (
              <button
                key={cell.key}
                type="button"
                role="gridcell"
                className={
                  cell.isEmpty ? 'tl-day empty'
                  : cell.isSelected ? `tl-day selected${cell.chargesCount > 0 && cell.paidCount === cell.chargesCount ? ' all-paid' : ''}`
                  : cell.isToday ? `tl-day today${cell.chargesCount > 0 && cell.paidCount === cell.chargesCount ? ' all-paid' : ''}`
                  : `tl-day${cell.chargesCount > 0 && cell.paidCount === cell.chargesCount ? ' all-paid' : ''}`
                }
                disabled={cell.isEmpty}
                onClick={() => { if (!cell.isEmpty) setSelectedCalendarDate(cell.iso) }}
              >
                {!cell.isEmpty && (
                  <>
                    <span>{cell.day}</span>
                    {daySubs.length > 0 && (
                      <div className="tl-day-logos">
                        {daySubs.slice(0, 3).map((sub) => {
                          const visual = getSubscriptionVisual(sub.name, sub.category, sub.status)
                          const logoSrc = sub.customLogoUrl || appLogoCache[normalizeAppKey(sub.name)] || visual.logoSrc
                          return (
                            <div key={sub.id} className="tl-day-logo" style={{ '--tone': visual.tone } as React.CSSProperties}>
                              {logoSrc
                                ? <img src={logoSrc} alt="" />
                                : <span>{sub.name.charAt(0)}</span>
                              }
                            </div>
                          )
                        })}
                        {daySubs.length > 3 && <span className="tl-day-more">+{daySubs.length - 3}</span>}
                      </div>
                    )}
                  </>
                )}
              </button>
            )
            })}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* ── Day detail ──────────────────────────── */}
      <section className="dash-section tl-detail-section">
        <div className="dash-section-top tl-detail-top">
          <h2>{selectedDateLabel}</h2>
          <small>{selectedDayPendingCount === 0 ? 'Todo pagado' : `${selectedDayPendingCount} pendiente${selectedDayPendingCount === 1 ? '' : 's'}`} · {selectedDayCharges.length} cobro{selectedDayCharges.length === 1 ? '' : 's'}</small>
        </div>
        <motion.div
          key={selectedCalendarDate}
          className="tl-day-detail"
          initial={reducedMotion ? false : { opacity: 0.92, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          {selectedDayCharges.length === 0 ? (
            <div className="collection-empty compact">
              <strong>Día libre de cobros</strong>
              <span>No hay cargos programados para esta fecha.</span>
            </div>
          ) : (
            <ul className="tl-charges">
            {selectedDayCharges.map((item) => {
              const visual = getSubscriptionVisual(item.name, item.category, item.status)
              const iconOption = item.iconKey ? iconOptionByKey.get(item.iconKey) : undefined
              const logoSrc = item.customLogoUrl || appLogoCache[normalizeAppKey(item.name)] || visual.logoSrc
              const paymentKey = toChargePaymentKey(item.id, selectedCalendarDate)
              const isPaid = Boolean(chargePayments[paymentKey])

              return (
                <motion.li
                  key={`${item.id}-${selectedCalendarDate}`}
                  className={isPaid ? 'paid' : 'pending'}
                  layout
                  animate={{ opacity: 1 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.18 }}
                >
                  <div className="tl-charge-main">
                    <div className={`dash-icon ${logoSrc ? 'has-logo' : ''}`} style={{ '--tone': visual.tone } as React.CSSProperties}>
                      {logoSrc ? <img src={logoSrc} alt={item.name} loading="lazy" /> : iconOption ? <iconOption.Icon size={15} strokeWidth={2.3} /> : <span>{item.name.charAt(0)}</span>}
                    </div>
                    <strong>{item.name}</strong>
                    <span className={isPaid ? 'tl-charge-status paid' : 'tl-charge-status pending'}>
                      {isPaid ? 'Pagado' : 'Pendiente'}
                    </span>
                  </div>
                  <div className="tl-charge-actions">
                    <button
                      type="button"
                      className={isPaid ? 'tl-paid-btn on' : 'tl-paid-btn'}
                      aria-label={isPaid ? 'Marcar como no pagado' : 'Marcar como pagado'}
                      onClick={() => handleToggleChargePaid(item.id, selectedCalendarDate)}
                    >
                      {isPaid
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                      }
                    </button>
                    <strong>{formatCurrency(item.amount, currency)}</strong>
                  </div>
                </motion.li>
              )
            })}
            </ul>
          )}
        </motion.div>
      </section>
    </div>
  )
}
