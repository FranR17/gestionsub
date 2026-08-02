import { useState } from 'react'
import type { Group, GroupBalance, GroupInvite, GroupMember, MonthlyPaymentSummary, Subscription, View } from '../types'
import { hasSupabase } from '../lib/supabase'
import { getSubscriptionVisual } from '../constants/subscriptionVisuals'
import { iconOptionByKey } from '../constants'
import { formatCurrency, formatDate } from '../utils/format'
import { normalizeAppKey } from '../utils/subscription'
import type { BudgetStatus } from '../utils/budget'
import { Bell, ChevronDown, BarChart3 } from 'lucide-react'

type UpcomingItem = Subscription & { inDays: number }
type CategoryItem = { name: string; amount: number; pct: number }
type ProjectionItem = { key: string; label: string; amount: number; height: number }

export type DashboardViewProps = {
  isGroupProfileActive: boolean
  activeProfileContext: string
  activeProfileLabel: string
  showProfileMenu: boolean
  setShowProfileMenu: (v: boolean | ((prev: boolean) => boolean)) => void
  groups: Group[]
  selectedGroupMembers: GroupMember[]
  incomingInvites: GroupInvite[]
  inviteGroups: Group[]
  groupsError: string
  groupsSuccess: string
  newGroupName: string
  setNewGroupName: (v: string) => void
  inviteEmailInput: string
  setInviteEmailInput: (v: string) => void
  lastInviteLink: string
  setLastInviteLink: (v: string) => void
  personalMonthTotal: number
  combinedMonthTotal: number
  groupOnlyMonthTotal: number
  groupOnlyYearTotal: number
  todayCharges: UpcomingItem[]
  upcoming30: UpcomingItem[]
  topExpensive: Subscription[]
  categoryBreakdown: CategoryItem[]
  groupReceivables: GroupBalance[]
  groupDebts: GroupBalance[]
  monthlyProjection: ProjectionItem[]
  monthlyPaymentSummary: MonthlyPaymentSummary
  personalBudgetStatus: BudgetStatus
  currency: string
  appLogoCache: Record<string, string>
  handleChangeProfileContext: (value: string) => void
  setActiveView: (v: View) => void
  handleCreateGroup: () => Promise<void>
  handleInviteMember: () => Promise<void>
  handleAcceptInvite: (inviteId: string) => Promise<void>
  handleDeclineInvite: (inviteId: string) => Promise<void>
  setGroupsSuccess: (v: string) => void
  bellCount: number
  showBellPanel: boolean
  setShowBellPanel: (v: boolean) => void
  todayPendingCharges: Subscription[]
  handleMarkAllTodayPaid: () => void
  showAnalysis: boolean
  setShowAnalysis: (v: boolean) => void
}

export function DashboardView({
  isGroupProfileActive,
  activeProfileContext,
  activeProfileLabel,
  showProfileMenu,
  setShowProfileMenu,
  groups,
  selectedGroupMembers,
  incomingInvites,
  inviteGroups,
  groupsError,
  groupsSuccess,
  newGroupName,
  setNewGroupName,
  inviteEmailInput,
  setInviteEmailInput,
  lastInviteLink,
  setLastInviteLink,
  personalMonthTotal,
  combinedMonthTotal,
  groupOnlyMonthTotal,
  groupOnlyYearTotal,
  todayCharges,
  upcoming30,
  topExpensive,
  categoryBreakdown,
  groupReceivables,
  groupDebts,
  monthlyProjection,
  monthlyPaymentSummary,
  personalBudgetStatus,
  currency,
  appLogoCache,
  handleChangeProfileContext,
  setActiveView,
  handleCreateGroup,
  handleInviteMember,
  handleAcceptInvite,
  handleDeclineInvite,
  setGroupsSuccess,
  bellCount,
  showBellPanel,
  setShowBellPanel,
  todayPendingCharges,
  handleMarkAllTodayPaid,
  showAnalysis,
  setShowAnalysis,
}: DashboardViewProps) {
  const heroAmount = isGroupProfileActive ? groupOnlyMonthTotal : personalMonthTotal
  const [analysisAnimating, setAnalysisAnimating] = useState(false)
  const monthlyPaidPct = monthlyPaymentSummary.totalAmount > 0
    ? Math.round((monthlyPaymentSummary.paidAmount / monthlyPaymentSummary.totalAmount) * 100)
    : 0

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
      {/* ── Hero ─────────────────────────────────── */}
      <section className="dash-hero2">
        <button type="button" className="dash-bell" onClick={() => setShowBellPanel(!showBellPanel)} aria-label="Notificaciones">
          <Bell size={20} />
          {bellCount > 0 && <span className="dash-bell-badge">{bellCount}</span>}
        </button>
        <strong className="dash-amount">{formatCurrency(heroAmount, currency)}</strong>
        <span className="dash-amount-sub">este mes · {activeProfileLabel.toLowerCase()}</span>

        {groups.length > 0 && (
          <div className="dash-tabs">
            <button
              type="button"
              className={!isGroupProfileActive ? 'active' : ''}
              onClick={() => handleChangeProfileContext('personal')}
            >Personal</button>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className={activeProfileContext === `group:${g.id}` ? 'active' : ''}
                onClick={() => handleChangeProfileContext(`group:${g.id}`)}
              >{g.name}</button>
            ))}
            <button
              type="button"
              className="dash-tabs-more"
              onClick={() => setShowProfileMenu((c) => !c)}
              aria-label="Gestionar grupos"
            >⋯</button>
          </div>
        )}
      </section>

      {/* ── Bell modal (pending today) ────────── */}
      {showBellPanel && (
        <>
          <div className="bell-modal-overlay" onClick={() => setShowBellPanel(false)} />
          <section className="bell-modal">
          <div className="dash-bell-panel-header">
            <strong>Pagos pendientes hoy</strong>
            <button type="button" onClick={() => setShowBellPanel(false)}>✕</button>
          </div>
          {todayPendingCharges.length === 0 ? (
            <p className="dash-empty">No tienes pagos pendientes hoy ✓</p>
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
          </section>
        </>
      )}

      {/* ── Panel de gestión de grupo (overlay) ── */}
      {showProfileMenu && (
        <section className="dash-manage">
          {hasSupabase && (
            <>
              {groupsError && <p className="dash-msg dash-msg--err">{groupsError}</p>}
              {groupsSuccess && <p className="dash-msg dash-msg--ok">{groupsSuccess}</p>}

              <p className="dash-manage-label">Crear grupo</p>
              <div className="dash-manage-inline">
                <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nombre del grupo" />
                <button type="button" onClick={() => void handleCreateGroup()}>Crear</button>
              </div>

              {isGroupProfileActive && selectedGroupMembers.length > 0 && (
                <>
                  <p className="dash-manage-label">Miembros · {activeProfileLabel}</p>
                  <div className="dash-pills">
                    {selectedGroupMembers.map((m) => <span key={m.id}>{m.displayName}</span>)}
                  </div>
                  <div className="dash-manage-inline">
                    <input
                      type="email"
                      value={inviteEmailInput}
                      onChange={(e) => { setInviteEmailInput(e.target.value); setLastInviteLink('') }}
                      placeholder="Email (opcional)"
                    />
                    <button type="button" onClick={() => void handleInviteMember()}>Invitar</button>
                  </div>
                  {lastInviteLink && (
                    <div className="dash-invite-box">
                      <small>Comparte este enlace (7 días)</small>
                      <div className="dash-invite-row">
                        <code>{lastInviteLink}</code>
                        <button type="button" onClick={() => { void navigator.clipboard.writeText(lastInviteLink); setGroupsSuccess('¡Copiado!') }}>Copiar</button>
                      </div>
                      <button type="button" className="link" onClick={() => setLastInviteLink('')}>Cerrar</button>
                    </div>
                  )}
                </>
              )}

              {incomingInvites.length > 0 && (
                <>
                  <p className="dash-manage-label">Invitaciones</p>
                  {incomingInvites.map((inv) => {
                    const name = inviteGroups.find((g) => g.id === inv.groupId)?.name ?? groups.find((g) => g.id === inv.groupId)?.name ?? 'Grupo'
                    return (
                      <div key={inv.id} className="dash-invite-item">
                        <strong>{name}</strong>
                        <div>
                          <button type="button" className="accept" onClick={() => void handleAcceptInvite(inv.id)}>Aceptar</button>
                          <button type="button" className="decline" onClick={() => void handleDeclineInvite(inv.id)}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </>
          )}
          <button type="button" className="dash-manage-close" onClick={() => setShowProfileMenu(false)}>Cerrar</button>
        </section>
      )}

      {/* ── KPIs inline ──────────────────────────── */}
      {isGroupProfileActive ? (
        <div className="dash-kpis">
          <div><span>Mes</span><strong>{formatCurrency(groupOnlyMonthTotal, currency)}</strong></div>
          <div className="dash-kpis-sep" />
          <div><span>Año</span><strong>{formatCurrency(groupOnlyYearTotal, currency)}</strong></div>
        </div>
      ) : groups.length > 0 ? (
        <div className="dash-kpis">
          <div><span>Personal</span><strong>{formatCurrency(personalMonthTotal, currency)}</strong></div>
          <div className="dash-kpis-sep" />
          <div><span>Total</span><strong>{formatCurrency(combinedMonthTotal, currency)}</strong></div>
          <div className="dash-kpis-sep" />
          <div><span>Grupos</span><strong>{formatCurrency(groupOnlyMonthTotal, currency)}</strong></div>
        </div>
      ) : null}

      {!isGroupProfileActive && personalBudgetStatus.enabled && (
        <section className={`dash-budget ${personalBudgetStatus.isExceeded ? 'over' : personalBudgetStatus.isNearLimit ? 'warn' : ''}`}>
          <div className="dash-section-top">
            <h2>Presupuesto mensual</h2>
            <small>{personalBudgetStatus.percent}% usado</small>
          </div>
          <div className="dash-budget-card">
            <div className="dash-month-track" aria-label={`${personalBudgetStatus.percent}% del presupuesto usado`}>
              <div className="dash-budget-fill" style={{ width: `${Math.min(100, personalBudgetStatus.percent)}%` }} />
            </div>
            <div className="dash-month-grid">
              <div>
                <span>Gastado</span>
                <strong>{formatCurrency(personalBudgetStatus.spent, currency)}</strong>
              </div>
              <div>
                <span>{personalBudgetStatus.remaining >= 0 ? 'Disponible' : 'Exceso'}</span>
                <strong>{formatCurrency(Math.abs(personalBudgetStatus.remaining), currency)}</strong>
              </div>
              <div>
                <span>Límite</span>
                <strong>{formatCurrency(personalBudgetStatus.limit, currency)}</strong>
              </div>
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
            <div className="dash-month-fill" style={{ width: `${monthlyPaidPct}%` }} />
          </div>
          <div className="dash-month-grid">
            <div>
              <span>Pagado</span>
              <strong>{formatCurrency(monthlyPaymentSummary.paidAmount, currency)}</strong>
            </div>
            <div>
              <span>Queda</span>
              <strong>{formatCurrency(monthlyPaymentSummary.pendingAmount, currency)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatCurrency(monthlyPaymentSummary.totalAmount, currency)}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ── Alerta hoy ───────────────────────────── */}
      {todayCharges.length > 0 && (
        <div className="dash-today">
          <div className="dash-today-pulse" />
          <div className="dash-today-body">
            <strong>{todayCharges.length === 1 ? '1 cobro hoy' : `${todayCharges.length} cobros hoy`}</strong>
            <span>{todayCharges.map((c) => c.name).join(' · ')}</span>
          </div>
          <strong>{formatCurrency(todayCharges.reduce((s, c) => s + c.amount, 0), currency)}</strong>
        </div>
      )}

      {/* ── Próximos cobros ──────────────────────── */}
      <section className="dash-section">
        <div className="dash-section-top">
          <h2>Próximos cobros</h2>
          <button type="button" onClick={() => setActiveView('timeline')}>Calendario →</button>
        </div>
        {upcoming30.length === 0 ? (
          <p className="dash-empty">Sin cobros en los próximos 30 días.</p>
        ) : (
          <ul className="dash-rows">
            {upcoming30.slice(0, 4).map((item) => {
              const visual = getSubscriptionVisual(item.name, item.category, item.status)
              const iconOption = item.iconKey ? iconOptionByKey.get(item.iconKey) : undefined
              const logoSrc = item.customLogoUrl || appLogoCache[normalizeAppKey(item.name)] || visual.logoSrc
              const urgency = item.inDays === 0 ? 'today' : item.inDays <= 3 ? 'soon' : 'ok'
              return (
                <li key={item.id}>
                  <div className={`dash-icon ${logoSrc ? 'has-logo' : ''}`} style={{ '--tone': visual.tone } as React.CSSProperties}>
                    {logoSrc ? <img src={logoSrc} alt="" loading="lazy" /> : iconOption ? <iconOption.Icon size={15} strokeWidth={2.3} /> : <span>{item.name.charAt(0)}</span>}
                  </div>
                  <div className="dash-row-mid">
                    <strong>{item.name}</strong>
                    <small>{formatDate(item.nextChargeDate)}</small>
                  </div>
                  <div className="dash-row-end">
                    <strong>{formatCurrency(item.amount, currency)}</strong>
                    <span className={`dash-pill ${urgency}`}>
                      {item.inDays === 0 ? 'Hoy' : item.inDays === 1 ? 'Mañana' : `${item.inDays}d`}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Toggle análisis ──────────────────────── */}
      <button type="button" className="dash-analysis-toggle" onClick={toggleAnalysis}>
        <BarChart3 size={15} strokeWidth={2.2} />
        <span>{showAnalysis ? 'Ocultar análisis' : 'Ver análisis'}</span>
        <ChevronDown size={14} className={`dash-analysis-chevron${showAnalysis ? ' open' : ''}`} />
      </button>

      {/* ── Análisis (colapsable) ─────────────────── */}
      {(showAnalysis || analysisAnimating) && (
        <div className={`dash-analysis${showAnalysis && !analysisAnimating ? ' open' : ''}${analysisAnimating ? ' closing' : ''}`}>

          {/* ── Proyección ───────────────────────────── */}
          <section className="dash-section">
            <div className="dash-section-top">
              <h2>Proyección</h2>
              <small>6 meses</small>
            </div>
            <div className="dash-proj">
              {monthlyProjection.map((item, i) => (
                <div className={`dash-proj-row${i === 0 ? ' current' : ''}`} key={item.key}>
                  <span className="dash-proj-label">{item.label}</span>
                  <div className="dash-proj-track">
                    <div className="dash-proj-fill" style={{ width: `${Math.max(item.height, 4)}%` }} />
                  </div>
                  <span className="dash-proj-amount">{formatCurrency(item.amount, currency)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Categorías ───────────────────────────── */}
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

          {/* ── Top gastos ───────────────────────────── */}
          {topExpensive.length > 0 && (
            <section className="dash-section">
              <div className="dash-section-top">
                <h2>Top gastos</h2>
                <button type="button" onClick={() => setActiveView('subscriptions')}>Ver todas →</button>
              </div>
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
                      <div className="dash-row-mid">
                        <strong>{item.name}</strong>
                        <small>{item.category || 'General'}</small>
                      </div>
                      <strong className="dash-row-price">{formatCurrency(item.amount, currency)}</strong>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

        </div>
      )}

      {/* ── Balance de grupo (siempre visible) ──── */}
      {isGroupProfileActive && (
        <section className="dash-section">
          <div className="dash-section-top">
            <h2>Balance · {activeProfileLabel}</h2>
            <button type="button" onClick={() => setActiveView('settlements')}>Liquidar →</button>
          </div>
          {groupReceivables.length > 0 || groupDebts.length > 0 ? (
            <div className="dash-balance">
              {groupReceivables.map((m) => (
                <div key={m.member_id} className="dash-balance-row">
                  <span>{m.member_name}</span>
                  <span className="ok">+{formatCurrency(m.net_total, currency)}</span>
                </div>
              ))}
              {groupDebts.map((m) => (
                <div key={m.member_id} className="dash-balance-row">
                  <span>{m.member_name}</span>
                  <span className="debt">−{formatCurrency(Math.abs(m.net_total), currency)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dash-empty">Sin movimientos este mes</p>
          )}
        </section>
      )}
    </div>
  )
}
