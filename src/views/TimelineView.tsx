import { useMemo } from 'react'
import type { Subscription } from '../types'
import { getSubscriptionVisual } from '../constants/subscriptionVisuals'
import { iconOptionByKey, weekDayLabels } from '../constants'
import { formatCurrency, formatDate } from '../utils/format'
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

type SpendingEntry = {
  key: string
  label: string
  amount: number
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
  spendingHistory: SpendingEntry[]
  currency: string
  appLogoCache: Record<string, string>
  handleToggleChargePaid: (subscriptionId: string, isoDate: string) => void
}

export function TimelineView({
  calendarMonth,
  setCalendarMonth,
  calendarMonthLabel,
  selectedCalendarDate,
  setSelectedCalendarDate,
  calendarCells,
  calendarChargesByDate,
  selectedDayCharges,
  selectedDayPendingCount,
  chargePayments,
  spendingHistory,
  currency,
  appLogoCache,
  handleToggleChargePaid,
}: TimelineViewProps) {

  // ── Feature 1: Month summary (total / paid / pending) ──
  const monthSummary = useMemo(() => {
    let total = 0
    let paid = 0
    let totalCharges = 0
    let paidCharges = 0

    calendarChargesByDate.forEach((subs, isoDate) => {
      subs.forEach((sub) => {
        total += sub.amount
        totalCharges += 1
        if (chargePayments[toChargePaymentKey(sub.id, isoDate)]) {
          paid += sub.amount
          paidCharges += 1
        }
      })
    })

    return { total, paid, pending: total - paid, totalCharges, paidCharges, pendingCharges: totalCharges - paidCharges }
  }, [calendarChargesByDate, chargePayments])

  // ── Payment progress ──
  const paymentProgress = useMemo(() => {
    const { totalCharges, paidCharges } = monthSummary
    const pct = totalCharges > 0 ? Math.round((paidCharges / totalCharges) * 100) : 0
    const allDone = totalCharges > 0 && paidCharges === totalCharges
    return { pct, allDone }
  }, [monthSummary])

  // ── Feature 2: History bar max ──
  const historyMax = useMemo(
    () => Math.max(1, ...spendingHistory.map((e) => e.amount)),
    [spendingHistory],
  )

  return (
    <div className="tl">
      {/* ── Header ──────────────────────────────── */}
      <div className="tl-top">
        <h1>Calendario</h1>
        <small>Toca un día para ver sus cobros</small>
      </div>

      {/* ── Month summary KPIs ──────────────────── */}
      <section className="tl-month-summary">
        <div className="tl-month-kpi">
          <span>Previsto</span>
          <strong>{formatCurrency(monthSummary.total, currency)}</strong>
        </div>
        <div className="tl-month-sep" />
        <div className="tl-month-kpi paid">
          <span>Pagado</span>
          <strong>{formatCurrency(monthSummary.paid, currency)}</strong>
        </div>
        <div className="tl-month-sep" />
        <div className="tl-month-kpi pending">
          <span>Pendiente</span>
          <strong>{formatCurrency(monthSummary.pending, currency)}</strong>
        </div>
      </section>

      {/* ── Payment progress bar ────────────────── */}
      {monthSummary.totalCharges > 0 && (
        <section className="tl-progress">
          <div className="tl-progress-top">
            <span>{paymentProgress.allDone ? '¡Todo pagado! ✓' : `${monthSummary.paidCharges} de ${monthSummary.totalCharges} cobros pagados`}</span>
            <strong>{paymentProgress.pct}%</strong>
          </div>
          <div className="tl-progress-track">
            <div
              className={`tl-progress-fill${paymentProgress.allDone ? ' complete' : ''}`}
              style={{ width: `${paymentProgress.pct}%` }}
            />
          </div>
        </section>
      )}

      {/* ── Calendar ────────────────────────────── */}
      <section className="tl-cal">
        <div className="tl-cal-nav">
          <button
            type="button"
            onClick={() => {
              const previous = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1, 12, 0, 0)
              setCalendarMonth(previous)
              setSelectedCalendarDate(toIsoDate(previous))
            }}
            aria-label="Mes anterior"
          >‹</button>
          <strong>{calendarMonthLabel}</strong>
          <button
            type="button"
            onClick={() => {
              const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1, 12, 0, 0)
              setCalendarMonth(next)
              setSelectedCalendarDate(toIsoDate(next))
            }}
            aria-label="Mes siguiente"
          >›</button>
        </div>
        <div className="tl-weekdays">
          {weekDayLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="tl-grid">
          {calendarCells.map((cell) => (
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
                  {cell.chargesCount > 0 && <small>{cell.pendingCount === 0 ? '✓' : cell.pendingCount}</small>}
                </>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── Day detail ──────────────────────────── */}
      <section className="dash-section">
        <div className="dash-section-top">
          <h2>{formatDate(selectedCalendarDate)}</h2>
          <small>{selectedDayPendingCount} pend. · {selectedDayCharges.length} total</small>
        </div>
        {selectedDayCharges.length === 0 ? (
          <p className="dash-empty">No hay cobros para este día.</p>
        ) : (
          <ul className="tl-charges">
            {selectedDayCharges.map((item) => {
              const visual = getSubscriptionVisual(item.name, item.category, item.status)
              const iconOption = item.iconKey ? iconOptionByKey.get(item.iconKey) : undefined
              const logoSrc = item.customLogoUrl || appLogoCache[normalizeAppKey(item.name)] || visual.logoSrc
              const paymentKey = toChargePaymentKey(item.id, selectedCalendarDate)
              const isPaid = Boolean(chargePayments[paymentKey])

              return (
                <li key={`${item.id}-${selectedCalendarDate}`} className={isPaid ? 'paid' : ''}>
                  <div className={`dash-icon ${logoSrc ? 'has-logo' : ''}`} style={{ '--tone': visual.tone } as React.CSSProperties}>
                    {logoSrc ? <img src={logoSrc} alt={item.name} loading="lazy" /> : iconOption ? <iconOption.Icon size={15} strokeWidth={2.3} /> : <span>{item.name.charAt(0)}</span>}
                  </div>
                  <div className="tl-charge-mid">
                    <strong>{item.name}</strong>
                    <span className={isPaid ? 'dash-pill ok' : 'dash-pill today'}>{isPaid ? 'pagado' : 'pendiente'}</span>
                  </div>
                  <div className="tl-charge-end">
                    <strong>{formatCurrency(item.amount, currency)}</strong>
                    <button
                      type="button"
                      className={isPaid ? 'tl-switch on' : 'tl-switch'}
                      aria-label={isPaid ? 'Marcar como no pagado' : 'Marcar como pagado'}
                      onClick={() => handleToggleChargePaid(item.id, selectedCalendarDate)}
                    >
                      <span className="tl-switch-knob" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Spending history with bars ───────────── */}
      <section className="dash-section">
        <div className="dash-section-top">
          <h2>Histórico</h2>
          <small>Gasto por mes</small>
        </div>
        {spendingHistory.length === 0 ? (
          <p className="dash-empty">Sin datos históricos todavía.</p>
        ) : (
          <ul className="tl-history">
            {spendingHistory.map((item) => {
              const pct = Math.max(4, Math.round((item.amount / historyMax) * 100))
              return (
                <li key={item.key}>
                  <span className="tl-history-label">{item.label}</span>
                  <div className="tl-history-track">
                    <div className="tl-history-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <strong className="tl-history-amount">{formatCurrency(item.amount, currency)}</strong>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
