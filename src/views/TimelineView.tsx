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
  calendarMonthLabel,
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

  return (
    <div className="tl">
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
                      className={isPaid ? 'tl-paid-btn on' : 'tl-paid-btn'}
                      aria-label={isPaid ? 'Marcar como no pagado' : 'Marcar como pagado'}
                      onClick={() => handleToggleChargePaid(item.id, selectedCalendarDate)}
                    >
                      {isPaid
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                      }
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
