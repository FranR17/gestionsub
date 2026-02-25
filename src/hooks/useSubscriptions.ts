import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { hasSupabase, supabase } from '../lib/supabase'
import type {
  AppStoreResult,
  ChargeOrder,
  Frequency,
  GroupMember,
  Reminder,
  Status,
  Subscription,
  SubscriptionFilter,
  SupabaseSubscriptionRow,
  View,
} from '../types'
import { seedSubscriptions, storageKeys } from '../constants'
import { getSubscriptionVisual } from '../constants/subscriptionVisuals'
import {
  advanceToCurrentOrFutureDate,
  diffInDays,
  monthKey,
  nextCycleDate,
  previousCycleDate,
  toIsoDate,
  toLocalNoonDate,
} from '../utils/date'
import { formatCurrency, formatDate } from '../utils/format'
import {
  calculatePeriodTotal,
  equalSplit,
  fetchAppStoreResults,
  fromSupabaseRow,
  normalizeAppKey,
  normalizeReminder,
  pickBestAppMatch,
} from '../utils/subscription'
import { usePersistedState } from './usePersistedState'
import { readStorage } from '../utils/storage'

type UseSubscriptionsOptions = {
  userId: string | null
  isGroupProfileActive: boolean
  effectiveSelectedGroupId: string
  groupScopedSubscriptions: Subscription[]
  selectedGroupMembers: GroupMember[]
  groupExpensePayerMemberId: string
  groupExpenseParticipantIds: string[]
  setGroupExpensePayerMemberId: (v: string) => void
  setGroupExpenseParticipantIds: (v: string[]) => void
  appLogoCache: Record<string, string>
  setAppLogoCache: React.Dispatch<React.SetStateAction<Record<string, string>>>
  currency: string
  notificationsEnabled: boolean
  defaultReminder: Reminder
  isAuthenticated: boolean
  setIsSyncing: (v: boolean) => void
  activeView: View
  setActiveView: (v: View) => void
  loadGroupScopedSubscriptions: (groupId: string) => Promise<void>
  loadGroupMonthBalances: (groupId: string) => Promise<void>
  setGroupsError: (v: string) => void
}

export function useSubscriptions(options: UseSubscriptionsOptions) {
  const {
    userId,
    isGroupProfileActive,
    effectiveSelectedGroupId,
    groupScopedSubscriptions,
    selectedGroupMembers,
    groupExpensePayerMemberId,
    groupExpenseParticipantIds,
    setGroupExpensePayerMemberId,
    setGroupExpenseParticipantIds,
    appLogoCache,
    setAppLogoCache,
    currency,
    notificationsEnabled,
    isAuthenticated,
    setIsSyncing,
    activeView,
    setActiveView,
    loadGroupScopedSubscriptions,
    loadGroupMonthBalances,
    setGroupsError,
  } = options

  const [subscriptions, setSubscriptions] = usePersistedState<Subscription[]>(
    storageKeys.subscriptions,
    seedSubscriptions,
    (items) => items.map((item, index) => ({
      ...item,
      id: String(item.id ?? `local-${index + 1}`),
      createdAt: String(item.createdAt ?? new Date().toISOString()),
      reminderDays: normalizeReminder(Number(item.reminderDays ?? 3)),
      anulado: (item.anulado === 1 ? 1 : 0) as 0 | 1,
    })),
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('General')
  const [formCustomLogoUrl, setFormCustomLogoUrl] = useState('')
  const [formAmount, setFormAmount] = useState(0)
  const [formIconKey, setFormIconKey] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [formEntryStep, setFormEntryStep] = useState<'choose' | 'details'>('choose')
  const [isManualEntry, setIsManualEntry] = useState(false)
  const [appSearchTerm, setAppSearchTerm] = useState('')
  const [appStoreResults, setAppStoreResults] = useState<AppStoreResult[]>([])
  const [appSearchLoading, setAppSearchLoading] = useState(false)
  const [appSearchError, setAppSearchError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionFilter>('activa')
  const [chargeOrder, setChargeOrder] = useState<ChargeOrder>('asc')
  const [frequencyFilter, setFrequencyFilter] = useState<Frequency | 'all'>('all')
  const [excludedCategories, setExcludedCategories] = useState<string[]>([])
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // ── Loaders ────────────────────────────────
  const loadSubscriptions = useCallback(async (uid: string) => {
    if (!supabase) return

    const { data, error } = await supabase
      .from('subscriptions')
      .select('id,user_id,name,amount,frequency,next_charge_date,created_at,category,reminder_days,status,icon_key,custom_logo_url,anulado')
      .eq('user_id', uid)
      .eq('anulado', 0)
      .order('next_charge_date', { ascending: true })

    if (error) return

    setSubscriptions(
      (data as SupabaseSubscriptionRow[]).map((row) => fromSupabaseRow(row)),
    )
  }, [])

  // ── Scoped / computed ──────────────────────
  const nonAnulado = useMemo(() => subscriptions.filter((s) => s.anulado !== 1), [subscriptions])
  const scopedSubscriptions = isGroupProfileActive ? groupScopedSubscriptions : nonAnulado

  const activeSubscriptions = useMemo(
    () =>
      scopedSubscriptions
        .map((item) => {
          if (item.status !== 'activa') return item
          return { ...item, nextChargeDate: advanceToCurrentOrFutureDate(item.nextChargeDate, item.frequency, new Date()) }
        })
        .filter((item) => item.status === 'activa'),
    [scopedSubscriptions],
  )

  const effectiveSubscriptions = useMemo(
    () =>
      scopedSubscriptions.map((item) => {
        if (item.status !== 'activa') return item
        return { ...item, nextChargeDate: advanceToCurrentOrFutureDate(item.nextChargeDate, item.frequency, new Date()) }
      }),
    [scopedSubscriptions],
  )

  // ── KPI totals ─────────────────────────────
  const personalActiveItems = useMemo(() => subscriptions.filter((s) => s.status === 'activa'), [subscriptions])
  const groupActiveItems = useMemo(() => groupScopedSubscriptions.filter((s) => s.status === 'activa'), [groupScopedSubscriptions])
  const combinedActiveItems = useMemo(() => {
    const seen = new Set<string>()
    return [...personalActiveItems, ...groupActiveItems].filter((s) => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })
  }, [personalActiveItems, groupActiveItems])

  const personalMonthTotal = useMemo(() => {
    const now = new Date()
    return calculatePeriodTotal(personalActiveItems, new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0), new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0))
  }, [personalActiveItems])

  const groupOnlyMonthTotal = useMemo(() => {
    const now = new Date()
    return calculatePeriodTotal(groupActiveItems, new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0), new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0))
  }, [groupActiveItems])

  const combinedMonthTotal = useMemo(() => {
    const now = new Date()
    return calculatePeriodTotal(combinedActiveItems, new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0), new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0))
  }, [combinedActiveItems])

  const groupOnlyYearTotal = useMemo(() => {
    const now = new Date()
    return calculatePeriodTotal(groupActiveItems, new Date(now.getFullYear(), 0, 1, 12, 0, 0), new Date(now.getFullYear() + 1, 0, 1, 12, 0, 0))
  }, [groupActiveItems])

  const personalYearTotal = useMemo(() => {
    const now = new Date()
    return calculatePeriodTotal(personalActiveItems, new Date(now.getFullYear(), 0, 1, 12, 0, 0), new Date(now.getFullYear() + 1, 0, 1, 12, 0, 0))
  }, [personalActiveItems])

  // ── Upcoming / Charges ─────────────────────
  const upcomingCharges = useMemo(() => {
    const today = new Date()
    return activeSubscriptions
      .map((item) => ({ ...item, inDays: diffInDays(today, new Date(`${item.nextChargeDate}T12:00:00`)) }))
      .filter((item) => item.inDays >= 0 && item.inDays <= 7)
      .sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate))
  }, [activeSubscriptions])

  const todayCharges = useMemo(() => upcomingCharges.filter((item) => item.inDays === 0), [upcomingCharges])

  const upcoming30 = useMemo(() => {
    const today = new Date()
    return activeSubscriptions
      .map((item) => ({ ...item, inDays: diffInDays(today, new Date(`${item.nextChargeDate}T12:00:00`)) }))
      .filter((item) => item.inDays >= 0 && item.inDays <= 30)
      .sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate))
  }, [activeSubscriptions])

  // ── Category breakdown ─────────────────────
  const categoryBreakdown = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0)
    const totals: Record<string, number> = {}
    activeSubscriptions.forEach((sub) => {
      const cat = sub.category?.trim() || 'General'
      const amount = calculatePeriodTotal([sub], monthStart, monthEnd)
      if (amount > 0) totals[cat] = (totals[cat] ?? 0) + amount
    })
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const max = entries[0]?.[1] ?? 1
    return entries.map(([name, amount]) => ({ name, amount, pct: Math.round((amount / max) * 100) }))
  }, [activeSubscriptions])

  const topExpensive = useMemo(() => [...activeSubscriptions].sort((a, b) => b.amount - a.amount).slice(0, 3), [activeSubscriptions])

  // ── Monthly projection ─────────────────────
  const monthlyProjection = useMemo(() => {
    const now = new Date()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
    const monthSlots = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1, 12, 0, 0)
      return { key: monthKey(date), label: new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date), amount: 0 }
    })
    const endMonthExclusive = new Date(now.getFullYear(), now.getMonth() + 6, 1, 12, 0, 0)
    activeSubscriptions.forEach((sub) => {
      let chargeDate = toLocalNoonDate(sub.nextChargeDate)
      let guard = 0
      while (chargeDate < endMonthExclusive && guard < 240) {
        if (chargeDate >= startMonth) {
          const idx = (chargeDate.getFullYear() - startMonth.getFullYear()) * 12 + (chargeDate.getMonth() - startMonth.getMonth())
          if (idx >= 0 && idx < monthSlots.length) monthSlots[idx].amount += sub.amount
        }
        chargeDate = toLocalNoonDate(nextCycleDate(toIsoDate(chargeDate), sub.frequency))
        guard += 1
      }
    })
    const maxAmount = Math.max(1, ...monthSlots.map((item) => item.amount))
    return monthSlots.map((item) => ({ ...item, height: item.amount === 0 ? 8 : Math.max(12, (item.amount / maxAmount) * 100) }))
  }, [activeSubscriptions])

  // ── Spending history ───────────────────────
  const spendingHistory = useMemo(() => {
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0)
    const historyEndExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0)

    const oldestMonthStart = effectiveSubscriptions.reduce((oldest, sub) => {
      const created = new Date(sub.createdAt)
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

    effectiveSubscriptions.forEach((sub) => {
      let chargeDate = toLocalNoonDate(sub.nextChargeDate)
      const createdAt = new Date(sub.createdAt)
      const createdMonthStart = Number.isNaN(createdAt.getTime())
        ? oldestMonthStart
        : new Date(createdAt.getFullYear(), createdAt.getMonth(), 1, 12, 0, 0)
      let guard = 0

      while (chargeDate >= historyEndExclusive && guard < 240) {
        chargeDate = toLocalNoonDate(previousCycleDate(toIsoDate(chargeDate), sub.frequency))
        guard += 1
      }
      while (chargeDate >= oldestMonthStart && chargeDate >= createdMonthStart && guard < 480) {
        const idx = (chargeDate.getFullYear() - oldestMonthStart.getFullYear()) * 12 + (chargeDate.getMonth() - oldestMonthStart.getMonth())
        if (idx >= 0 && idx < monthSlots.length) monthSlots[idx].amount += sub.amount
        chargeDate = toLocalNoonDate(previousCycleDate(toIsoDate(chargeDate), sub.frequency))
        guard += 1
      }
    })
    return [...monthSlots].reverse()
  }, [effectiveSubscriptions])

  // ── Filters & visible ──────────────────────
  const availableCategories = useMemo(() => {
    const cats = effectiveSubscriptions.map((item) => item.category.trim() || 'General')
    return [...new Set(cats)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  }, [effectiveSubscriptions])

  const visibleCategoryOptions = useMemo(() => {
    const n = categorySearchTerm.trim().toLowerCase()
    if (!n) return availableCategories
    return availableCategories.filter((c) => c.toLowerCase().includes(n))
  }, [availableCategories, categorySearchTerm])

  const activeFilterCount =
    (chargeOrder === 'desc' ? 1 : 0) +
    (frequencyFilter !== 'all' ? 1 : 0) +
    (excludedCategories.length > 0 ? 1 : 0)

  const visibleSubscriptions = useMemo(() => {
    return [...effectiveSubscriptions]
      .filter((item) => (subscriptionFilter === 'all' ? true : item.status === subscriptionFilter))
      .filter((item) => (frequencyFilter === 'all' ? true : item.frequency === frequencyFilter))
      .filter((item) => !excludedCategories.includes(item.category.trim() || 'General'))
      .filter((item) => {
        const n = searchTerm.trim().toLowerCase()
        if (!n) return true
        return item.name.toLowerCase().includes(n) || item.category.toLowerCase().includes(n) || item.frequency.toLowerCase().includes(n)
      })
      .sort((a, b) => {
        const byDate = chargeOrder === 'asc' ? a.nextChargeDate.localeCompare(b.nextChargeDate) : b.nextChargeDate.localeCompare(a.nextChargeDate)
        return byDate !== 0 ? byDate : a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
      })
  }, [chargeOrder, effectiveSubscriptions, excludedCategories, frequencyFilter, searchTerm, subscriptionFilter])

  const editingSubscription = effectiveSubscriptions.find((item) => item.id === editingId) ?? null

  // ── Notification reminders ─────────────────
  useEffect(() => {
    if (!isAuthenticated || !notificationsEnabled || typeof Notification === 'undefined') return
    if (Notification.permission === 'default') { void Notification.requestPermission(); return }
    if (Notification.permission !== 'granted') return

    const today = new Date()
    const digestKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
    const lastDigest = readStorage<string>(storageKeys.reminderDigest, '')
    if (lastDigest === digestKey) return

    const dueReminders = activeSubscriptions.filter((item) => {
      const days = diffInDays(today, new Date(`${item.nextChargeDate}T12:00:00`))
      return days >= 0 && days === item.reminderDays
    })
    if (dueReminders.length === 0) return

    dueReminders.forEach((item) => {
      new Notification('Recordatorio de suscripción', {
        body: `${item.name}: cobro el ${formatDate(item.nextChargeDate)} por ${formatCurrency(item.amount, currency)}.`,
      })
    })
    localStorage.setItem(storageKeys.reminderDigest, JSON.stringify(digestKey))
  }, [activeSubscriptions, currency, isAuthenticated, notificationsEnabled])

  // ── App Store search ───────────────────────
  useEffect(() => {
    if (activeView !== 'form') return
    const term = appSearchTerm.trim()
    if (term.length < 2) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setAppSearchLoading(true)
      setAppSearchError('')
      void fetchAppStoreResults(term, 20, controller.signal)
        .then((mapped) => setAppStoreResults(mapped))
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setAppSearchError('No se pudo buscar en App Store. Inténtalo otra vez.')
          setAppStoreResults([])
        })
        .finally(() => setAppSearchLoading(false))
    }, 260)

    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [activeView, appSearchTerm])

  // ── Handlers ───────────────────────────────
  const openSubscriptionForm = useCallback((subscriptionId: string | null) => {
    if (!subscriptionId) {
      setEditingId(null)
      setFormName('')
      setFormCategory(isGroupProfileActive ? 'Grupo' : 'General')
      setFormCustomLogoUrl('')
      setFormAmount(0)
      if (isGroupProfileActive) {
        setGroupExpenseParticipantIds(selectedGroupMembers.map((m) => m.id))
        setGroupExpensePayerMemberId(selectedGroupMembers[0]?.id ?? '')
      }
      setAppSearchTerm('')
      setAppStoreResults([])
      setAppSearchError('')
      setFormIconKey('')
      setShowIconPicker(false)
      setFormEntryStep('choose')
      setIsManualEntry(false)
      setActiveView('form')
      return
    }

    const target = effectiveSubscriptions.find((item) => item.id === subscriptionId)
    setEditingId(subscriptionId)
    setFormName(target?.name ?? '')
    setFormCategory(target?.category ?? 'General')
    setFormCustomLogoUrl(target?.customLogoUrl ?? '')
    setFormAmount(target?.amount ?? 0)
    setAppSearchTerm('')
    setAppStoreResults([])
    setAppSearchError('')
    setFormIconKey(target?.iconKey ?? '')

    if (!target) {
      setShowIconPicker(false)
      setActiveView('form')
      return
    }

    const key = normalizeAppKey(target.name)
    const visual = getSubscriptionVisual(target.name, target.category, target.status)
    const logoSrc = target.customLogoUrl || appLogoCache[key] || visual.logoSrc
    setShowIconPicker(!logoSrc)
    setFormEntryStep('details')
    setIsManualEntry(false)
    setActiveView('form')
  }, [appLogoCache, effectiveSubscriptions, isGroupProfileActive, selectedGroupMembers, setActiveView, setGroupExpenseParticipantIds, setGroupExpensePayerMemberId])

  const handleNameBlur = useCallback(async (rawName: string) => {
    const name = rawName.trim()
    if (!name) { setShowIconPicker(false); setFormIconKey(''); setFormCustomLogoUrl(''); return }
    if (formCustomLogoUrl) { setShowIconPicker(false); return }

    const cacheKey = normalizeAppKey(name)
    const cachedLogo = appLogoCache[cacheKey]
    if (cachedLogo) { setFormCustomLogoUrl(cachedLogo); setShowIconPicker(false); return }

    try {
      const results = await fetchAppStoreResults(name, 5)
      const bestMatch = pickBestAppMatch(name, results)
      if (bestMatch?.iconUrl) {
        setFormCustomLogoUrl(bestMatch.iconUrl)
        setFormCategory((c) => (c === 'General' ? bestMatch.category : c))
        setAppLogoCache((cur) => ({ ...cur, [cacheKey]: bestMatch.iconUrl }))
        setShowIconPicker(false)
        return
      }
    } catch { /* fallback */ }

    const visual = getSubscriptionVisual(name, '', 'activa')
    if (visual.logoSrc) { setShowIconPicker(false); setFormIconKey(''); return }
    setShowIconPicker(true)
  }, [appLogoCache, formCustomLogoUrl, setAppLogoCache])

  const handleSelectAppResult = useCallback((item: AppStoreResult) => {
    setFormName(item.name)
    setFormCategory(item.category || 'General')
    setFormCustomLogoUrl(item.iconUrl)
    setAppLogoCache((cur) => ({ ...cur, [normalizeAppKey(item.name)]: item.iconUrl }))
    setFormIconKey('')
    setShowIconPicker(false)
    setAppSearchTerm('')
    setAppStoreResults([])
    setAppSearchError('')
    setFormEntryStep('details')
    setIsManualEntry(false)
  }, [setAppLogoCache])

  const handleToggleSubscriptionStatus = useCallback(async (id: string, currentStatus: Status) => {
    const nextStatus: Status = currentStatus === 'activa' ? 'cancelada' : 'activa'

    if (hasSupabase && supabase && userId && isGroupProfileActive && effectiveSelectedGroupId) {
      setIsSyncing(true)
      try {
        const { error } = await supabase.from('group_expenses').update({ is_active: nextStatus === 'activa' }).eq('id', id).eq('group_id', effectiveSelectedGroupId)
        if (!error) await loadGroupScopedSubscriptions(effectiveSelectedGroupId)
      } finally {
        setIsSyncing(false)
      }
      return
    }

    if (hasSupabase && supabase && userId) {
      setIsSyncing(true)
      try {
        const { error } = await supabase.from('subscriptions').update({ status: nextStatus }).eq('id', id).eq('user_id', userId)
        if (!error) await loadSubscriptions(userId)
      } finally {
        setIsSyncing(false)
      }
      return
    }

    setSubscriptions((cur) => cur.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)))
  }, [effectiveSelectedGroupId, isGroupProfileActive, loadGroupScopedSubscriptions, loadSubscriptions, setIsSyncing, userId])

  const handleSoftDeleteSubscription = useCallback(async (id: string) => {
    if (hasSupabase && supabase && userId && isGroupProfileActive && effectiveSelectedGroupId) {
      setIsSyncing(true)
      try {
        const { error } = await supabase.from('group_expenses').update({ anulado: 1 }).eq('id', id).eq('group_id', effectiveSelectedGroupId)
        if (!error) await loadGroupScopedSubscriptions(effectiveSelectedGroupId)
      } finally {
        setIsSyncing(false)
      }
      return
    }

    if (hasSupabase && supabase && userId) {
      setIsSyncing(true)
      try {
        const { error } = await supabase.from('subscriptions').update({ anulado: 1 }).eq('id', id).eq('user_id', userId)
        if (!error) await loadSubscriptions(userId)
      } finally {
        setIsSyncing(false)
      }
      return
    }

    setSubscriptions((cur) => cur.filter((item) => item.id !== id))
  }, [effectiveSelectedGroupId, isGroupProfileActive, loadGroupScopedSubscriptions, loadSubscriptions, setIsSyncing, userId])

  const handleSaveSubscription = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const normalizedName = formName.trim()
    if (!normalizedName) return

    const payload: Omit<Subscription, 'id' | 'createdAt'> = {
      name: normalizedName,
      amount: Number(form.get('amount') ?? 0),
      frequency: String(form.get('frequency')) as Frequency,
      nextChargeDate: String(form.get('nextChargeDate') ?? ''),
      iconKey: String(form.get('iconKey') ?? '').trim() || null,
      customLogoUrl: formCustomLogoUrl.trim() || null,
      category: formCategory.trim() || 'General',
      reminderDays: Number(form.get('reminderDays')) as Reminder,
      status: String(form.get('status')) as Status,
      anulado: 0,
    }

    if (hasSupabase && supabase && userId && isGroupProfileActive && effectiveSelectedGroupId) {
      setIsSyncing(true)

      if (editingId) {
        const { error } = await supabase
          .from('group_expenses')
          .update({
            name: payload.name, amount: payload.amount,
            frequency: payload.frequency, next_charge_date: payload.nextChargeDate,
            is_active: payload.status === 'activa',
          })
          .eq('id', editingId)
          .eq('group_id', effectiveSelectedGroupId)
        if (!error) {
          await loadGroupScopedSubscriptions(effectiveSelectedGroupId)
          await loadGroupMonthBalances(effectiveSelectedGroupId)
        }
      } else {
        const payerMemberId = groupExpensePayerMemberId || selectedGroupMembers[0]?.id || ''
        const participantIds = groupExpenseParticipantIds.length > 0 ? [...new Set(groupExpenseParticipantIds)] : selectedGroupMembers.map((m) => m.id)
        if (!payerMemberId || participantIds.length === 0) {
          setIsSyncing(false)
          setGroupsError('El grupo necesita miembros activos para crear gastos.')
          setActiveView('dashboard')
          return
        }

        const { data: expenseInserted, error: expenseError } = await supabase
          .from('group_expenses')
          .insert({
            group_id: effectiveSelectedGroupId, name: payload.name, amount: payload.amount,
            frequency: payload.frequency, next_charge_date: payload.nextChargeDate,
            payer_member_id: payerMemberId, is_active: payload.status === 'activa',
            created_by_user_id: userId,
          })
          .select('id')
          .single()

        if (!expenseError && expenseInserted) {
          const participantsPayload = participantIds.map((memberId) => ({ expense_id: expenseInserted.id, member_id: memberId, share_type: 'equal' }))
          const { error: participantsError } = await supabase.from('group_expense_participants').insert(participantsPayload)

          if (!participantsError) {
            const { data: chargeInserted, error: chargeError } = await supabase
              .from('expense_charge_instances')
              .insert({
                expense_id: expenseInserted.id, charge_date: payload.nextChargeDate,
                amount_total: payload.amount, payer_member_id: payerMemberId, status: 'pending',
              })
              .select('id')
              .single()

            if (!chargeError && chargeInserted) {
              const splits = equalSplit(payload.amount, participantIds.length)
              const sharesPayload = participantIds.map((memberId, i) => ({
                charge_instance_id: chargeInserted.id, member_id: memberId, owed_amount: splits[i],
              }))
              const { error: sharesError } = await supabase.from('expense_charge_shares').insert(sharesPayload)
              if (!sharesError) {
                await loadGroupScopedSubscriptions(effectiveSelectedGroupId)
                await loadGroupMonthBalances(effectiveSelectedGroupId)
              }
            }
          }
        }
      }
      setIsSyncing(false)
    } else if (hasSupabase && supabase && userId) {
      setIsSyncing(true)
      if (editingId) {
        const { error } = await supabase
          .from('subscriptions')
          .update({
            name: payload.name, amount: payload.amount, frequency: payload.frequency,
            next_charge_date: payload.nextChargeDate, category: payload.category,
            reminder_days: payload.reminderDays, status: payload.status,
            icon_key: payload.iconKey, custom_logo_url: payload.customLogoUrl,
          })
          .eq('id', editingId)
          .eq('user_id', userId)
        if (!error) await loadSubscriptions(userId)
      } else {
        const { error } = await supabase.from('subscriptions').insert({
          user_id: userId, name: payload.name, amount: payload.amount,
          frequency: payload.frequency, next_charge_date: payload.nextChargeDate,
          category: payload.category, reminder_days: payload.reminderDays, status: payload.status,
          icon_key: payload.iconKey, custom_logo_url: payload.customLogoUrl,
        })
        if (!error) await loadSubscriptions(userId)
      }
      setIsSyncing(false)
    } else {
      if (editingId) {
        setSubscriptions((cur) => cur.map((item) => (item.id === editingId ? { ...item, ...payload } : item)))
      } else {
        const id = self.crypto?.randomUUID?.() ?? `local-${Date.now()}`
        setSubscriptions((cur) => [...cur, { id, createdAt: new Date().toISOString(), ...payload }])
      }
    }

    setEditingId(null)
    setFormName('')
    setFormCategory('General')
    setFormCustomLogoUrl('')
    setAppSearchTerm('')
    setAppStoreResults([])
    setAppSearchError('')
    setFormIconKey('')
    setShowIconPicker(false)
    setFormEntryStep('choose')
    setIsManualEntry(false)
    setActiveView('subscriptions')
  }, [
    editingId, effectiveSelectedGroupId, formCategory, formCustomLogoUrl, formName,
    groupExpenseParticipantIds, groupExpensePayerMemberId, isGroupProfileActive,
    loadGroupMonthBalances, loadGroupScopedSubscriptions, loadSubscriptions,
    selectedGroupMembers, setActiveView, setGroupsError, setIsSyncing, userId,
  ])

  const handleExport = useCallback((format: 'json' | 'csv') => {
    const payload =
      format === 'json'
        ? JSON.stringify(effectiveSubscriptions, null, 2)
        : [
            'id,nombre,importe,frecuencia,proximo_cobro,creado_en,categoria,recordatorio,estado',
            ...effectiveSubscriptions.map(
              (item) =>
                `${item.id},"${item.name}",${item.amount},${item.frequency},${item.nextChargeDate},${item.createdAt},"${item.category}",${item.reminderDays},${item.status}`,
            ),
          ].join('\n')

    const blob = new Blob([payload], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = format === 'json' ? 'suscripciones.json' : 'suscripciones.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [effectiveSubscriptions])

  return {
    subscriptions, setSubscriptions, loadSubscriptions,
    // Form
    editingId, editingSubscription,
    formName, setFormName, formCategory, setFormCategory,
    formCustomLogoUrl, setFormCustomLogoUrl, formAmount, setFormAmount,
    formIconKey, setFormIconKey, showIconPicker,
    appSearchTerm, setAppSearchTerm, appStoreResults, appSearchLoading, appSearchError,
    formEntryStep, setFormEntryStep, isManualEntry, setIsManualEntry,
    // Filters
    searchTerm, setSearchTerm, subscriptionFilter, setSubscriptionFilter,
    chargeOrder, setChargeOrder, frequencyFilter, setFrequencyFilter,
    excludedCategories, setExcludedCategories, categorySearchTerm, setCategorySearchTerm,
    showAdvancedFilters, setShowAdvancedFilters,
    availableCategories, visibleCategoryOptions, activeFilterCount,
    visibleSubscriptions,
    // Computed
    scopedSubscriptions, activeSubscriptions, effectiveSubscriptions,
    personalMonthTotal, groupOnlyMonthTotal, combinedMonthTotal,
    groupOnlyYearTotal, personalYearTotal,
    upcomingCharges, todayCharges, upcoming30,
    categoryBreakdown, topExpensive, monthlyProjection, spendingHistory,
    // Handlers
    openSubscriptionForm, handleNameBlur, handleSelectAppResult,
    handleToggleSubscriptionStatus, handleSoftDeleteSubscription, handleSaveSubscription, handleExport,
  }
}
