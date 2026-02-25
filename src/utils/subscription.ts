import type { AppStoreResult, Reminder, Status, Subscription, SupabaseSubscriptionRow } from '../types'
import { diffInDays, nextCycleDate, previousCycleDate, toIsoDate, toLocalNoonDate } from './date'

export const normalizeReminder = (value: number): Reminder => {
  if (value === 1 || value === 3 || value === 7) {
    return value
  }
  return 3
}

export const toChargePaymentKey = (subscriptionId: string, isoDate: string) =>
  `${subscriptionId}__${isoDate}`

export const equalSplit = (amount: number, count: number) => {
  if (count <= 0) {
    return []
  }

  const cents = Math.round(amount * 100)
  const base = Math.floor(cents / count)
  const remainder = cents - base * count

  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100)
}

export const fromSupabaseRow = (row: SupabaseSubscriptionRow): Subscription => ({
  id: row.id,
  name: row.name,
  amount: Number(row.amount),
  frequency: row.frequency,
  nextChargeDate: row.next_charge_date,
  createdAt: row.created_at,
  category: row.category,
  reminderDays: normalizeReminder(row.reminder_days),
  status: row.status,
  iconKey: row.icon_key ?? null,
  customLogoUrl: row.custom_logo_url ?? null,
  anulado: (row.anulado === 1 ? 1 : 0) as 0 | 1,
})

export const normalizeAppKey = (value: string) => value.trim().toLowerCase()

export const fetchAppStoreResults = async (
  term: string,
  limit: number,
  signal?: AbortSignal,
): Promise<AppStoreResult[]> => {
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&country=es&limit=${limit}`,
    signal ? { signal } : undefined,
  )

  if (!response.ok) {
    throw new Error('No se pudo consultar App Store')
  }

  const data = (await response.json()) as {
    results?: Array<{
      trackId: number
      trackName: string
      artworkUrl100?: string
      primaryGenreName?: string
    }>
  }

  return (data.results ?? []).map((item) => ({
    id: item.trackId,
    name: item.trackName,
    iconUrl: String(item.artworkUrl100 ?? '').replace('100x100bb', '512x512bb'),
    category: item.primaryGenreName ?? 'General',
  }))
}

export const pickBestAppMatch = (term: string, results: AppStoreResult[]) => {
  if (results.length === 0) {
    return null
  }

  const normalizedTerm = normalizeAppKey(term)
  const exact = results.find((item) => normalizeAppKey(item.name) === normalizedTerm)
  return exact ?? results[0]
}

export const getNextChargeCountdown = (nextChargeDate: string, status: Status) => {
  if (status === 'cancelada') {
    return 'cancelada'
  }

  const days = diffInDays(new Date(), toLocalNoonDate(nextChargeDate))

  if (days <= 0) {
    return 'hoy'
  }

  if (days === 1) {
    return '1 día'
  }

  if (days < 7) {
    return `${days} días`
  }

  const weeks = Math.ceil(days / 7)
  return weeks === 1 ? '1 semana' : `${weeks} semanas`
}

export const calculatePeriodTotal = (items: Subscription[], periodStart: Date, periodEndExclusive: Date) => {
  let total = 0

  items.forEach((subscription) => {
    let chargeDate = toLocalNoonDate(subscription.nextChargeDate)
    let guard = 0

    while (chargeDate >= periodStart && guard < 240) {
      chargeDate = toLocalNoonDate(previousCycleDate(toIsoDate(chargeDate), subscription.frequency))
      guard += 1
    }
    chargeDate = toLocalNoonDate(nextCycleDate(toIsoDate(chargeDate), subscription.frequency))

    guard = 0
    while (chargeDate < periodEndExclusive && guard < 480) {
      if (chargeDate >= periodStart) {
        total += subscription.amount
      }
      chargeDate = toLocalNoonDate(nextCycleDate(toIsoDate(chargeDate), subscription.frequency))
      guard += 1
    }
  })

  return total
}
