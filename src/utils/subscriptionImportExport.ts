import type { Subscription } from '../types'
import { normalizeReminder } from './subscription'

export const escapeCsvCell = (value: string | number | boolean | null | undefined) => {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export const buildSubscriptionsExportPayload = (subscriptions: Subscription[], format: 'json' | 'csv') => {
  if (format === 'json') return JSON.stringify(subscriptions, null, 2)

  return [
    'id,nombre,importe,frecuencia,proximo_cobro,fin_pago,financiado,financiera,creado_en,categoria,recordatorio,estado',
    ...subscriptions.map((item) => [
      item.id,
      item.name,
      item.amount,
      item.frequency,
      item.nextChargeDate,
      item.paymentEndDate ?? '',
      item.isFinanced ? 'si' : 'no',
      item.financingProviderName ?? '',
      item.createdAt,
      item.category,
      item.reminderDays,
      item.status,
    ].map(escapeCsvCell).join(',')),
  ].join('\n')
}

export const parseCsvRows = (text: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

export const parseExportedSubscriptionsCsv = (text: string): unknown[] => {
  const [headers, ...rows] = parseCsvRows(text)
  if (!headers) return []
  const indexByHeader = new Map(headers.map((header, index) => [header.trim().toLowerCase(), index]))
  const read = (row: string[], key: string) => row[indexByHeader.get(key) ?? -1] ?? ''

  return rows.map((row) => ({
    name: read(row, 'nombre'),
    amount: read(row, 'importe'),
    frequency: read(row, 'frecuencia'),
    nextChargeDate: read(row, 'proximo_cobro'),
    paymentEndDate: read(row, 'fin_pago'),
    isFinanced: read(row, 'financiado').toLowerCase() === 'si',
    financingProviderName: read(row, 'financiera'),
    createdAt: read(row, 'creado_en'),
    category: read(row, 'categoria'),
    reminderDays: read(row, 'recordatorio'),
    status: read(row, 'estado'),
  }))
}

const frequencies = ['semanal', 'mensual', 'trimestral', 'anual'] as const
const statuses = ['activa', 'cancelada'] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readString = (record: Record<string, unknown>, key: string, fallback = '') => {
  const value = record[key]
  return typeof value === 'string' ? value : fallback
}

const readNullableString = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : null
}

const readBoolean = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'boolean' ? value : false
}

const readNumber = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return Number.NaN
}

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

export const normalizeImportedSubscription = (
  value: unknown,
  fallbackId: string,
  fallbackCreatedAt: string,
): Subscription | null => {
  if (!isRecord(value)) return null

  const name = readString(value, 'name').trim()
  const amount = readNumber(value, 'amount')
  const frequency = readString(value, 'frequency') as Subscription['frequency']
  const nextChargeDate = readString(value, 'nextChargeDate')
  const status = readString(value, 'status', 'activa') as Subscription['status']

  if (!name || !Number.isFinite(amount) || amount < 0) return null
  if (!frequencies.includes(frequency) || !isIsoDate(nextChargeDate)) return null
  if (!statuses.includes(status)) return null

  const paymentEndDate = readString(value, 'paymentEndDate')

  return {
    id: fallbackId,
    name,
    amount,
    frequency,
    nextChargeDate,
    paymentEndDate: isIsoDate(paymentEndDate) ? paymentEndDate : null,
    createdAt: readString(value, 'createdAt') || fallbackCreatedAt,
    iconKey: readNullableString(value, 'iconKey'),
    customLogoUrl: readNullableString(value, 'customLogoUrl'),
    isFinanced: readBoolean(value, 'isFinanced'),
    financingProviderName: readNullableString(value, 'financingProviderName'),
    financingProviderLogoUrl: readNullableString(value, 'financingProviderLogoUrl'),
    category: readString(value, 'category', 'General').trim() || 'General',
    reminderDays: normalizeReminder(readNumber(value, 'reminderDays')),
    reminderTime: readString(value, 'reminderTime', '09:00') || '09:00',
    status,
    anulado: 0,
  }
}
