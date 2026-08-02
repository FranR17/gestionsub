import type { Frequency } from '../types'

export const diffInDays = (fromDate: Date, toDate: Date) => {
  const utcFrom = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
  const utcTo = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())
  return Math.floor((utcTo - utcFrom) / (1000 * 60 * 60 * 24))
}

export const toLocalNoonDate = (date: string) => new Date(`${date}T12:00:00`)

export const toIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const addMonthsClamped = (date: Date, months: number) => {
  const year = date.getFullYear()
  const monthIndex = date.getMonth() + months
  const targetYear = year + Math.floor(monthIndex / 12)
  const targetMonth = ((monthIndex % 12) + 12) % 12
  const targetMonthDays = new Date(targetYear, targetMonth + 1, 0).getDate()
  const day = Math.min(date.getDate(), targetMonthDays)
  return new Date(targetYear, targetMonth, day, 12, 0, 0)
}

export const nextCycleDate = (date: string, frequency: Frequency) => {
  const base = toLocalNoonDate(date)
  if (frequency === 'semanal') {
    base.setDate(base.getDate() + 7)
    return toIsoDate(base)
  }
  if (frequency === 'mensual') {
    return toIsoDate(addMonthsClamped(base, 1))
  }
  if (frequency === 'trimestral') {
    return toIsoDate(addMonthsClamped(base, 3))
  }
  return toIsoDate(addMonthsClamped(base, 12))
}

export const previousCycleDate = (date: string, frequency: Frequency) => {
  const base = toLocalNoonDate(date)
  if (frequency === 'semanal') {
    base.setDate(base.getDate() - 7)
    return toIsoDate(base)
  }
  if (frequency === 'mensual') {
    return toIsoDate(addMonthsClamped(base, -1))
  }
  if (frequency === 'trimestral') {
    return toIsoDate(addMonthsClamped(base, -3))
  }
  return toIsoDate(addMonthsClamped(base, -12))
}

export const advanceToCurrentOrFutureDate = (date: string, frequency: Frequency, now: Date) => {
  let candidate = date
  let guard = 0
  while (diffInDays(now, toLocalNoonDate(candidate)) < 0 && guard < 120) {
    candidate = nextCycleDate(candidate, frequency)
    guard += 1
  }
  return candidate
}

export const tomorrowIso = () => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return toIsoDate(date)
}

export const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`
