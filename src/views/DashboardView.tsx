import { Fragment, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { Group, MonthlyPaymentSummary, Subscription, View } from '../types'
import { getSubscriptionVisual } from '../constants/subscriptionVisuals'
import { iconOptionByKey } from '../constants'
import { formatCurrency, formatDate } from '../utils/format'
import { normalizeAppKey, toChargePaymentKey } from '../utils/subscription'
import type { BudgetStatus } from '../utils/budget'
import { Bell, ChevronDown, BarChart3, CircleAlert, CalendarCheck2, X } from 'lucide-react'
import { ModalSurface } from '../components/ModalSurface'

type UpcomingItem = Subscription & { inDays: number }
type PendingDueCharge = { subscription: Subscription; isoDate: string; inDays: number }
type CategoryItem = { name: string; amount: number; pct: number }
type ProjectionItem = { key: string; label: string; amount: number; height: number }

export type DashboardViewProps = {
  isGroupProfileActive: boolean
  activeProfileLabel: string
  groups: Group[]
  personalMonthTotal: number
  combinedMonthTotal: number
  groupOnlyMonthTotal: number
  groupOnlyYearTotal: number
  todayCharges: UpcomingItem[]
  upcoming30: UpcomingItem[]
  topExpensive: Subscription[]
  categoryBreakdown: CategoryItem[]
  monthlyProjection: ProjectionItem[]
  monthlyPaymentSummary: MonthlyPaymentSummary
  pendingDueCharges: PendingDueCharge[]
  chargePayments: Record<string, boolean>
  personalBudgetStatus: BudgetStatus
  canManageSubscriptions: boolean
  currency: string
  appLogoCache: Record<string, string>
  setActiveView: (v: View) => void
  bellCount: number
  showBellPanel: boolean
  setShowBellPanel: (v: boolean) => void
  todayPendingCharges: Subscription[]
  handleMarkAllTodayPaid: () => void
  handleToggleChargePaid: (subscriptionId: string, isoDate: string) => void
  openSubscriptionForm: (id: string | null) => void
  showAnalysis: boolean
  setShowAnalysis: (v: boolean) => void
}

export function DashboardView({
  isGroupProfileActive,
  activeProfileLabel,
  groups,
  personalMonthTotal,
  combinedMonthTotal,
  groupOnlyMonthTotal,
  groupOnlyYearTotal,
  todayCharges,
  upcoming30,
  topExpensive,
  categoryBreakdown,
  monthlyProjection,
  monthlyPaymentSummary,
  pendingDueCharges,
  chargePayments,
  personalBudgetStatus,
  canManageSubscriptions,
  currency,
  appLogoCache,
  setActiveView,
  bellCount,
  showBellPanel,
  setShowBellPanel,
  todayPendingCharges,
  handleMarkAllTodayPaid,
  handleToggleChargePaid,
  openSubscriptionForm,
  showAnalysis,
  setShowAnalysis,
}: DashboardViewProps) {
  const [analysisAnimating, setAnalysisAnimating] = useState(false)
  const reducedMotion = Boolean(useReducedMotion())
  const heroAmount = isGroupProfileActive ? groupOnlyMonthTotal : personalMonthTotal
  const formattedHeroAmount = formatCurrency(heroAmount, currency)
  const monthlyPaidPct = monthlyPaymentSummary.totalAmount > 0
    ? Math.round((monthlyPaymentSummary.paidAmount / monthlyPaymentSummary.totalAmount) * 100)
    : 0
  const upcomingRows = upcoming30.filter((item) => item.inDays > 0).slice(0, 4)
  const kpiItems = isGroupProfileActive
    ? [
        { label: 'Mes', value: groupOnlyMonthTotal },
        { label: 'Año', value: groupOnlyYearTotal },
      ]
    : groups.length > 0
      ? [
          { label: 'Personal', value: personalMonthTotal },
          { label: 'Total', value: combinedMonthTotal },
          { label: 'Grupos', value: groupOnlyMonthTotal },
        ]
      : []
  const monthStatus = monthlyPaymentSummary.totalCount === 0
    ? 'Sin cobros este mes'
    : monthlyPaidPct === 100
      ? 'Mes completado'
      : `${monthlyPaidPct}% pagado`
  const bellCloseRef = useRef<HTMLButtonElement | null>(null)

  const toggleAnalysis = () => {
    if (showAnalysis) {
      setAnalysisAnimating(true)
      setTimeout(() => { setShowAnalysis(false); setAnalysisAnimating(false) }, 300)
    } else {
      setShowAnalysis(true)
    }
  }

  return (
    <div className="dash">
      <section className="dash-hero2">
        <button
          type="button"
          className="dash-bell"
          onClick={() => setShowBellPanel(!showBellPanel)}
          aria-label="Notificaciones"
          aria-expanded={showBellPanel}
          aria-controls="bell-panel"
        >
          <Bell size={20} />
          {bellCount > 0 && <span className="dash-bell-badge">{bellCount}</span>}
        </button>
        <div className="dash-hero-copy">
          <span className="dash-hero-eyebrow">Gasto previsto</span>
          <motion.strong
            key={`${activeProfileLabel}-${formattedHeroAmount}`}
            className={formattedHeroAmount.length > 10 ? 'dash-amount long' : 'dash-amount'}
            initial={reducedMotion ? false : { opacity: 0.72, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {formattedHeroAmount}
          </motion.strong>
          <div className="dash-hero-meta">
            <span className="dash-amount-sub">Este mes · {activeProfileLabel.toLowerCase()}</span>
            <span className={monthlyPaidPct === 100 && monthlyPaymentSummary.totalCount > 0 ? 'dash-month-status complete' : 'dash-month-status'}>{monthStatus}</span>
          </div>
        </div>
      </section>

      <ModalSurface
        open={showBellPanel}
        onClose={() => setShowBellPanel(false)}
        titleId="bell-panel-title"
        initialFocusRef={bellCloseRef}
        className="bell-modal"
      >
          <div id="bell-panel">
            <div className="dash-bell-panel-header">
              <strong id="bell-panel-title">Pagos pendientes hoy</strong>
              <button ref={bellCloseRef} type="button" aria-label="Cerrar notificaciones" onClick={() => setShowBellPanel(false)}><X size={18} /></button>
            </div>
            {todayPendingCharges.length === 0 ? (
              <p className="dash-empty">No tienes pagos pendientes hoy</p>
            ) : (
              <>
                <ul className="dash-bell-list">
                  {todayPendingCharges.map((sub) => {
                    const visual = getSubscriptionVisual(sub.name, sub.category, sub.status)
                    const logoSrc = sub.customLogoUrl || appLogoCache[normalizeAppKey(sub.name)] || visual.logoSrc
                    return (
                      <li key={sub.id}>
                        <div className={`dash-icon ${logoSrc ? 'has-logo' : ''}`} style={{ '--tone': visual.tone } as React.CSSProperties}>
                          {logoSrc ? <img src={logoSrc} alt="" /> : <span>{sub.name.charAt(0)}</span>}
                        </div>
                        <strong>{sub.name}</strong>
                        <span>{formatCurrency(sub.amount, currency)}</span>
                      </li>
                    )
                  })}
                </ul>
                <button type="button" className="dash-bell-payall" onClick={() => { handleMarkAllTodayPaid(); setShowBellPanel(false) }}>
                  Marcar todo como pagado
                </button>
              </>
            )}
          </div>
      </ModalSurface>

      {kpiItems.length > 0 && (
        <div className="dash-kpis">
          {kpiItems.map((item, index) => (
            <Fragment key={item.label}>
              {index > 0 && <div className="dash-kpis-sep" />}
              <motion.div
                initial={reducedMotion ? false : { opacity: 0.82, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.18, delay: index * 0.025 }}
              >
                <span>{item.label}</span>
                <strong>{formatCurrency(item.value, currency)}</strong>
              </motion.div>
            </Fragment>
          ))}
        </div>
      )}

      {!isGroupProfileActive && personalBudgetStatus.enabled && (
        <section className={`dash-budget ${personalBudgetStatus.isExceeded ? 'over' : personalBudgetStatus.isNearLimit ? 'warn' : ''}`}>
          <div className="dash-section-top">
            <h2>Presupuesto mensual</h2>
            <small>{personalBudgetStatus.percent}% usado</small>
          </div>
          <div className="dash-budget-card">
            <div className="dash-month-track" aria-label={`${personalBudgetStatus.percent}% del presupuesto usado`}>
              <motion.div
                className="dash-budget-fill"
                initial={false}
                animate={{ width: `${Math.min(100, personalBudgetStatus.percent)}%` }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="dash-month-grid">
              <div><span>Gastado</span><strong>{formatCurrency(personalBudgetStatus.spent, currency)}</strong></div>
              <div><span>{personalBudgetStatus.remaining >= 0 ? 'Disponible' : 'Exceso'}</span><strong>{formatCurrency(Math.abs(personalBudgetStatus.remaining), currency)}</strong></div>
              <div><span>Límite</span><strong>{formatCurrency(personalBudgetStatus.limit, currency)}</strong></div>
            </div>
          </div>
        </section>
      )}

      <section className="dash-month-summary">
        <div className="dash-section-top">
          <h2>Resumen mensual</h2>
          <small>{monthlyPaymentSummary.paidCount}/{monthlyPaymentSummary.totalCount} pagados</small>
        </div>
        <div className="dash-month-card">
          <div className="dash-month-track" aria-label={`${monthlyPaidPct}% pagado`}>
            <motion.div
              className="dash-month-fill"
              initial={false}
              animate={{ width: `${monthlyPaidPct}%` }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="dash-month-grid">
            <div><span>Pagado</span><strong>{formatCurrency(monthlyPaymentSummary.paidAmount, currency)}</strong></div>
            <div><span>Queda</span><strong>{formatCurrency(monthlyPaymentSummary.pendingAmount, currency)}</strong></div>
            <div><span>Total</span><strong>{formatCurrency(monthlyPaymentSummary.totalAmount, currency)}</strong></div>
          </div>
        </div>
      </section>

      {todayCharges.length > 0 && (
        <button type="button" className="dash-today" disabled={!canManageSubscriptions} onClick={() => openSubscriptionForm(todayCharges[0].id)}>
          <span className="dash-today-pulse" />
          <span className="dash-today-body">
            <strong>{todayCharges.length === 1 ? '1 cobro hoy' : `${todayCharges.length} cobros hoy`}</strong>
            <span>{todayCharges.map((c) => c.name).join(' · ')}</span>
          </span>
          <strong>{formatCurrency(todayCharges.reduce((s, c) => s + c.amount, 0), currency)}</strong>
        </button>
      )}

      {pendingDueCharges.length > 0 && (
        <section className="dash-section dash-overdue">
          <div className="dash-section-top">
            <h2><CircleAlert size={16} strokeWidth={2.2} /> Pendientes</h2>
            <small>{pendingDueCharges.length} sin pagar</small>
          </div>
          <ul className="dash-rows dash-action-rows">
            {pendingDueCharges.slice(0, 4).map(({ subscription, isoDate, inDays }) => {
              const visual = getSubscriptionVisual(subscription.name, subscription.category, subscription.status)
              const iconOption = subscription.iconKey ? iconOptionByKey.get(subscription.iconKey) : undefined
              const logoSrc = subscription.customLogoUrl || appLogoCache[normalizeAppKey(subscription.name)] || visual.logoSrc
              const label = inDays === 0 ? 'Hoy' : `${Math.abs(inDays)}d tarde`
              return (
                <li key={`${subscription.id}-${isoDate}`}>
                  <button type="button" className="dash-row-main" disabled={!canManageSubscriptions} onClick={() => openSubscriptionForm(subscription.id)} aria-label={`Editar ${subscription.name}`}>
                    <div className={`dash-icon ${logoSrc ? 'has-logo' : ''}`} style={{ '--tone': visual.tone } as React.CSSProperties}>
                      {logoSrc ? <img src={logoSrc} alt="" loading="lazy" /> : iconOption ? <iconOption.Icon size={15} strokeWidth={2.3} /> : <span>{subscription.name.charAt(0)}</span>}
                    </div>
                    <span className="dash-row-mid"><strong>{subscription.name}</strong><small>{formatDate(isoDate)}</small></span>
                  </button>
                  <span className="dash-row-end"><strong>{formatCurrency(subscription.amount, currency)}</strong><span className={`dash-pill ${inDays === 0 ? 'today' : 'late'}`}>{label}</span></span>
                  {canManageSubscriptions && <button type="button" className="dash-pay-btn" onClick={() => handleToggleChargePaid(subscription.id, isoDate)}>Pagar</button>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="dash-section">
        <div className="dash-section-top">
          <h2>Próximos cobros</h2>
          <button type="button" onClick={() => setActiveView('timeline')}>Calendario →</button>
        </div>
        {upcomingRows.length === 0 ? (
          <div className="dash-empty-state">
            <CalendarCheck2 size={20} strokeWidth={1.9} />
            <div><strong>Sin cobros próximos</strong><p>No tienes cargos previstos en los próximos 30 días.</p></div>
            <button type="button" onClick={() => setActiveView('timeline')}>Revisar calendario</button>
          </div>
        ) : (
          <ul className="dash-rows dash-action-rows">
            {upcomingRows.map((item) => {
              const visual = getSubscriptionVisual(item.name, item.category, item.status)
              const iconOption = item.iconKey ? iconOptionByKey.get(item.iconKey) : undefined
              const logoSrc = item.customLogoUrl || appLogoCache[normalizeAppKey(item.name)] || visual.logoSrc
              const urgency = item.inDays === 0 ? 'today' : item.inDays <= 3 ? 'soon' : 'ok'
              const isPaid = Boolean(chargePayments[toChargePaymentKey(item.id, item.nextChargeDate)])
              return (
                <li key={item.id}>
                  <button type="button" className="dash-row-main" disabled={!canManageSubscriptions} onClick={() => openSubscriptionForm(item.id)} aria-label={`Editar ${item.name}`}>
                    <div className={`dash-icon ${logoSrc ? 'has-logo' : ''}`} style={{ '--tone': visual.tone } as React.CSSProperties}>
                      {logoSrc ? <img src={logoSrc} alt="" loading="lazy" /> : iconOption ? <iconOption.Icon size={15} strokeWidth={2.3} /> : <span>{item.name.charAt(0)}</span>}
                    </div>
                    <span className="dash-row-mid"><strong>{item.name}</strong><small>{formatDate(item.nextChargeDate)}</small></span>
                  </button>
                  <div className="dash-row-end"><strong>{formatCurrency(item.amount, currency)}</strong><span className={`dash-pill ${isPaid ? 'ok' : urgency}`}>{isPaid ? 'Pagado' : item.inDays === 1 ? 'Mañana' : `${item.inDays}d`}</span></div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <button type="button" className="dash-analysis-toggle" onClick={toggleAnalysis}>
        <BarChart3 size={15} strokeWidth={2.2} />
        <span>{showAnalysis ? 'Ocultar análisis' : 'Ver análisis'}</span>
        <ChevronDown size={14} className={`dash-analysis-chevron${showAnalysis ? ' open' : ''}`} />
      </button>

      {(showAnalysis || analysisAnimating) && (
        <div className={`dash-analysis${showAnalysis && !analysisAnimating ? ' open' : ''}${analysisAnimating ? ' closing' : ''}`}>
          <section className="dash-section">
            <div className="dash-section-top"><h2>Proyección</h2><small>6 meses</small></div>
            <div className="dash-proj">
              {monthlyProjection.map((item, i) => (
                <div className={`dash-proj-row${i === 0 ? ' current' : ''}`} key={item.key}>
                  <span className="dash-proj-label">{item.label}</span>
                  <div className="dash-proj-track"><div className="dash-proj-fill" style={{ width: `${Math.max(item.height, 4)}%` }} /></div>
                  <span className="dash-proj-amount">{formatCurrency(item.amount, currency)}</span>
                </div>
              ))}
            </div>
          </section>

          {categoryBreakdown.length > 0 && (
            <section className="dash-section">
              <h2>Categorías</h2>
              <div className="dash-cats">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="dash-cat">
                    <div className="dash-cat-top"><span>{cat.name}</span><span>{formatCurrency(cat.amount, currency)}</span></div>
                    <div className="dash-cat-track"><div className="dash-cat-fill" style={{ width: `${cat.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {topExpensive.length > 0 && (
            <section className="dash-section">
              <div className="dash-section-top"><h2>Top gastos</h2><button type="button" onClick={() => setActiveView('subscriptions')}>Ver todas →</button></div>
              <ul className="dash-rows">
                {topExpensive.map((item, i) => {
                  const visual = getSubscriptionVisual(item.name, item.category, item.status)
                  const iconOption = item.iconKey ? iconOptionByKey.get(item.iconKey) : undefined
                  const logoSrc = item.customLogoUrl || appLogoCache[normalizeAppKey(item.name)] || visual.logoSrc
                  return (
                    <li key={item.id}>
                      <span className="dash-rank">{i + 1}</span>
                      <div className={`dash-icon ${logoSrc ? 'has-logo' : ''}`} style={{ '--tone': visual.tone } as React.CSSProperties}>
                        {logoSrc ? <img src={logoSrc} alt="" loading="lazy" /> : iconOption ? <iconOption.Icon size={15} strokeWidth={2.3} /> : <span>{item.name.charAt(0)}</span>}
                      </div>
                      <div className="dash-row-mid"><strong>{item.name}</strong><small>{item.category || 'General'}</small></div>
                      <strong className="dash-row-price">{formatCurrency(item.amount, currency)}</strong>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
