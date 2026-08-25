import { useEffect, useRef, useState } from 'react'
import { Lock, ArrowRight, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import type { GroupBalance, Settlement, SettlementTransfer } from '../types'
import { useSettlements } from '../hooks/useSettlements'
import { ModalSurface } from '../components/ModalSurface'

export type SettlementViewProps = {
  groupId: string
  groupName: string
  currency: string
  canSettle: boolean
  isLocalGroup: boolean
  localBalances: GroupBalance[]
  localTransfers: SettlementTransfer[]
  localSettlement: Settlement | null
  handleSettleLocalGroupMonth: (year: number, month: number) => void
  formatCurrency: (amount: number, cur: string) => string
}

export function SettlementView({
  groupId,
  groupName,
  currency,
  canSettle,
  isLocalGroup,
  localBalances,
  localTransfers,
  localSettlement,
  handleSettleLocalGroupMonth,
  formatCurrency,
}: SettlementViewProps) {
  const s = useSettlements(groupId)
  const [confirmSettle, setConfirmSettle] = useState(false)
  const [copied, setCopied] = useState(false)
  const settleCancelRef = useRef<HTMLButtonElement | null>(null)

  // Load on mount + when group changes
  useEffect(() => {
    if (isLocalGroup) return
    void s.loadMonth(s.selectedYear, s.selectedMonth)
    // Avoid reloading the current settlement when month navigation mutates hook state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, isLocalGroup])

  const currentLocalDate = new Date()
  const displayYear = isLocalGroup ? currentLocalDate.getFullYear() : s.selectedYear
  const displayMonth = isLocalGroup ? currentLocalDate.getMonth() + 1 : s.selectedMonth

  const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
    .format(new Date(displayYear, displayMonth - 1))

  const isCurrentMonth =
    displayYear === new Date().getFullYear() &&
    displayMonth === new Date().getMonth() + 1

  const isFuture =
    displayYear > new Date().getFullYear() ||
    (displayYear === new Date().getFullYear() && displayMonth > new Date().getMonth() + 1)

  const isSettled = isLocalGroup ? localSettlement?.settled === true : s.settlement?.settled === true

  // Use snapshot if settled, otherwise live balances
  const displayBalances: GroupBalance[] = isLocalGroup
    ? isSettled ? (localSettlement?.balance_snapshot ?? []) : localBalances
    : isSettled
    ? (s.settlement?.balance_snapshot ?? [])
    : s.balances

  const transfers: SettlementTransfer[] = isLocalGroup
    ? isSettled ? (localSettlement?.transfers ?? []) : localTransfers
    : isSettled
    ? (s.settlement?.transfers ?? [])
    : s.computeTransfers(s.balances)

  const hasActivity = displayBalances.some((b) => b.paid_total > 0 || b.owed_total > 0)

  const handleCopy = () => {
    const text = s.generateShareText(groupName, displayBalances, transfers, displayYear, displayMonth, currency, formatCurrency)
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSettle = async () => {
    if (isLocalGroup) {
      handleSettleLocalGroupMonth(displayYear, displayMonth)
      setConfirmSettle(false)
      return
    }
    const settled = await s.settleMonth()
    if (settled) setConfirmSettle(false)
  }

  return (
    <div className="sett">
      {/* ── Header ─────────────────────────────── */}
      <div className="sett-header">
        <h1>Liquidaciones</h1>
        <small>{groupName}</small>
      </div>

      {/* ── Month navigator ───────────────────── */}
      <div className="sett-month-nav">
        <button type="button" disabled={isLocalGroup} onClick={s.goPrevMonth} aria-label="Mes anterior">
          <ChevronLeft size={18} />
        </button>
        <strong className="sett-month-label">{monthLabel}</strong>
        <button type="button" disabled={isLocalGroup} onClick={s.goNextMonth} aria-label="Mes siguiente">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── Status badge ──────────────────────── */}
      <div className={`sett-status ${isLocalGroup ? 'local' : isSettled ? 'settled' : isCurrentMonth ? 'active' : 'pending'}`}>
        {isLocalGroup && isSettled ? (
          <>
            <Lock size={13} />
            <span>Liquidado en prueba · {new Date(localSettlement!.settled_at!).toLocaleDateString('es-ES')}</span>
          </>
        ) : isLocalGroup ? (
          <span>Grupo de prueba · mes abierto</span>
        ) : isSettled ? (
          <>
            <Lock size={13} />
            <span>Liquidado · {new Date(s.settlement!.settled_at!).toLocaleDateString('es-ES')}</span>
          </>
        ) : isFuture ? (
          <span>Mes futuro</span>
        ) : isCurrentMonth ? (
          <span>Mes en curso</span>
        ) : (
          <span>Pendiente de liquidar</span>
        )}
      </div>

      {!isLocalGroup && s.loading ? (
        <p className="dash-empty" style={{ padding: '2rem 0' }}>Cargando…</p>
      ) : !hasActivity && !isSettled ? (
        <p className="dash-empty" style={{ padding: '2rem 0' }}>Sin gastos este mes.</p>
      ) : (
        <>
          {/* ── Balances ──────────────────────────── */}
          <section className="sett-section">
            <h2>Balances</h2>
            <div className="sett-balances">
              {displayBalances.map((b) => (
                <div key={b.member_id} className="sett-bal-row">
                  <div className="sett-bal-avatar">{b.member_name.charAt(0).toUpperCase()}</div>
                  <div className="sett-bal-info">
                    <strong>{b.member_name}</strong>
                    <small>Pagó {formatCurrency(b.paid_total, currency)} · Debe {formatCurrency(b.owed_total, currency)}</small>
                  </div>
                  <span className={`sett-bal-net ${b.net_total > 0.009 ? 'pos' : b.net_total < -0.009 ? 'neg' : 'zero'}`}>
                    {b.net_total > 0 ? '+' : ''}{formatCurrency(b.net_total, currency)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Transfers ─────────────────────────── */}
          {transfers.length > 0 && (
            <section className="sett-section">
              <h2>Transferencias</h2>
              <p className="sett-hint">Pagos optimizados para saldar las deudas:</p>
              <div className="sett-transfers">
                {transfers.map((t, i) => (
                  <div key={i} className="sett-transfer-row">
                    <div className="sett-transfer-from">
                      <div className="sett-bal-avatar small">{t.from_name.charAt(0).toUpperCase()}</div>
                      <span>{t.from_name}</span>
                    </div>
                    <div className="sett-transfer-arrow">
                      <ArrowRight size={14} />
                      <strong>{formatCurrency(t.amount, currency)}</strong>
                    </div>
                    <div className="sett-transfer-to">
                      <div className="sett-bal-avatar small">{t.to_name.charAt(0).toUpperCase()}</div>
                      <span>{t.to_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Actions ───────────────────────────── */}
          <section className="sett-actions">
            {s.error && <p className="form-err" role="alert">{s.error}</p>}
            {s.success && <p className="form-ok" role="status">{s.success}</p>}

            <button type="button" className="sett-btn-copy" onClick={handleCopy}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              <span aria-live="polite">{copied ? 'Copiado' : 'Copiar resumen'}</span>
            </button>

            {(isLocalGroup || canSettle) && !isSettled && !isFuture && hasActivity && (
              <>
                  <button type="button" className="sett-btn-settle" onClick={() => setConfirmSettle(true)}>
                    <Lock size={15} />
                    <span>{isLocalGroup ? 'Cerrar mes de prueba' : `Liquidar ${monthLabel}`}</span>
                  </button>
              </>
            )}
          </section>

          {/* ── History note for settled months ──── */}
          {isSettled && (isLocalGroup ? localSettlement?.notes : s.settlement?.notes) && (
            <section className="sett-section">
              <h2>Notas</h2>
              <p className="sett-notes">{isLocalGroup ? localSettlement?.notes : s.settlement?.notes}</p>
            </section>
          )}
        </>
      )}
      <ModalSurface
        open={confirmSettle}
        onClose={() => setConfirmSettle(false)}
        titleId="settle-month-title"
        descriptionId="settle-month-description"
        initialFocusRef={settleCancelRef}
        closeDisabled={s.settling}
        role="alertdialog"
        className="confirm-modal"
      >
        <h2 id="settle-month-title">Confirmar liquidación</h2>
        <p id="settle-month-description">{isLocalGroup ? '¿Cerrar este mes de prueba? Guardaremos una foto fija de balances y transferencias en este dispositivo.' : '¿Cerrar este mes? Los balances quedarán congelados y no se podrán modificar.'}</p>
        {s.error && <p className="form-err" role="alert">{s.error}</p>}
        <div className="confirm-modal-actions">
          <button ref={settleCancelRef} type="button" className="secondary" onClick={() => setConfirmSettle(false)}>Cancelar</button>
          <button type="button" className="primary" disabled={s.settling} onClick={() => void handleSettle()}>
            {s.settling ? 'Liquidando…' : isLocalGroup ? 'Confirmar cierre' : 'Confirmar liquidación'}
          </button>
        </div>
      </ModalSurface>
    </div>
  )
}
