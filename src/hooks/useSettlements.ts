import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { GroupBalance, Settlement, SettlementTransfer } from '../types'

export function useSettlements(groupId: string) {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [balances, setBalances] = useState<GroupBalance[]>([])
  const [settlement, setSettlement] = useState<Settlement | null>(null)
  const [loading, setLoading] = useState(false)
  const [settling, setSettling] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Compute optimised transfers client-side for preview (before settling)
  const computeTransfers = useCallback((bals: GroupBalance[]): SettlementTransfer[] => {
    const debtors = bals
      .filter((b) => b.net_total < -0.009)
      .map((b) => ({ id: b.member_id, name: b.member_name, amt: Math.abs(b.net_total) }))
      .sort((a, b) => b.amt - a.amt)

    const creditors = bals
      .filter((b) => b.net_total > 0.009)
      .map((b) => ({ id: b.member_id, name: b.member_name, amt: b.net_total }))
      .sort((a, b) => b.amt - a.amt)

    const transfers: SettlementTransfer[] = []
    let di = 0
    let ci = 0

    while (di < debtors.length && ci < creditors.length) {
      const pay = Math.min(debtors[di].amt, creditors[ci].amt)
      if (pay > 0.009) {
        transfers.push({
          from_member_id: debtors[di].id,
          from_name: debtors[di].name,
          to_member_id: creditors[ci].id,
          to_name: creditors[ci].name,
          amount: Math.round(pay * 100) / 100,
        })
      }
      debtors[di].amt -= pay
      creditors[ci].amt -= pay
      if (debtors[di].amt < 0.01) di++
      if (creditors[ci].amt < 0.01) ci++
    }

    return transfers
  }, [])

  // Load balances + settlement status for the selected month
  const loadMonth = useCallback(async (year: number, month: number) => {
    if (!supabase || !groupId) return
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Load balances
      const { data: balData, error: balError } = await supabase.rpc('get_group_monthly_balances', {
        p_group_id: groupId,
        p_year: year,
        p_month: month,
      })

      if (balError) {
        setError('Error al cargar balances.')
        setLoading(false)
        return
      }

      const mapped = ((balData ?? []) as GroupBalance[]).map((b) => ({
        ...b,
        paid_total: Number(b.paid_total),
        owed_total: Number(b.owed_total),
        net_total: Number(b.net_total),
      }))
      setBalances(mapped)

      // Check settlement status
      const { data: settData, error: settError } = await supabase.rpc('get_group_settlement', {
        p_group_id: groupId,
        p_year: year,
        p_month: month,
      })

      if (settError || !settData) {
        setSettlement(null)
      } else {
        const s = settData as Settlement
        if (s.settled && s.balance_snapshot) {
          // Use the snapshot balances (frozen at settlement time)
          s.balance_snapshot = (s.balance_snapshot as GroupBalance[]).map((b) => ({
            ...b,
            paid_total: Number(b.paid_total),
            owed_total: Number(b.owed_total),
            net_total: Number(b.net_total),
          }))
          s.transfers = (s.transfers ?? []).map((t) => ({
            ...t,
            amount: Number((t as SettlementTransfer).amount),
          }))
        }
        setSettlement(s)
      }
    } catch {
      setError('Error de conexión.')
    }
    setLoading(false)
  }, [groupId])

  // Navigate months
  const goToMonth = useCallback((year: number, month: number) => {
    setSelectedYear(year)
    setSelectedMonth(month)
    void loadMonth(year, month)
  }, [loadMonth, setSelectedMonth, setSelectedYear])

  const goPrevMonth = useCallback(() => {
    const prev = selectedMonth === 1
      ? { y: selectedYear - 1, m: 12 }
      : { y: selectedYear, m: selectedMonth - 1 }
    goToMonth(prev.y, prev.m)
  }, [selectedYear, selectedMonth, goToMonth])

  const goNextMonth = useCallback(() => {
    const next = selectedMonth === 12
      ? { y: selectedYear + 1, m: 1 }
      : { y: selectedYear, m: selectedMonth + 1 }
    goToMonth(next.y, next.m)
  }, [selectedYear, selectedMonth, goToMonth])

  // Settle the month
  const settleMonth = useCallback(async (notes?: string) => {
    if (!supabase || !groupId) return
    setSettling(true)
    setError('')
    setSuccess('')

    try {
      const { data, error: rpcError } = await supabase.rpc('settle_group_month', {
        p_group_id: groupId,
        p_year: selectedYear,
        p_month: selectedMonth,
        p_notes: notes ?? '',
      })

      const result = data as { ok: boolean; reason?: string } | null
      if (rpcError || !result?.ok) {
        const reason = result?.reason ?? rpcError?.message ?? ''
        if (reason === 'already_settled') {
          setError('Este mes ya está liquidado.')
        } else {
          setError('No se pudo liquidar: ' + reason)
        }
        setSettling(false)
        return
      }

      setSuccess('Mes liquidado correctamente.')
      await loadMonth(selectedYear, selectedMonth)
    } catch {
      setError('Error de conexión al liquidar.')
    }
    setSettling(false)
  }, [groupId, selectedYear, selectedMonth, loadMonth])

  // Generate shareable text
  const generateShareText = useCallback((
    groupName: string,
    bals: GroupBalance[],
    transfers: SettlementTransfer[],
    year: number,
    month: number,
    currency: string,
    formatCurrency: (amount: number, cur: string) => string,
  ): string => {
    const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
      .format(new Date(year, month - 1))

    let text = `💰 Liquidación · ${groupName}\n📅 ${monthLabel}\n\n`
    text += `📊 Balances:\n`
    for (const b of bals) {
      const sign = b.net_total >= 0 ? '+' : ''
      text += `  ${b.member_name}: ${sign}${formatCurrency(b.net_total, currency)}\n`
    }

    if (transfers.length > 0) {
      text += `\n💸 Transferencias:\n`
      for (const t of transfers) {
        text += `  ${t.from_name} → ${t.to_name}: ${formatCurrency(t.amount, currency)}\n`
      }
    }

    text += `\n— Notifyra`
    return text
  }, [])

  return {
    selectedYear,
    selectedMonth,
    balances,
    settlement,
    loading,
    settling,
    error,
    success,
    setError,
    setSuccess,
    computeTransfers,
    loadMonth,
    goToMonth,
    goPrevMonth,
    goNextMonth,
    settleMonth,
    generateShareText,
  }
}
