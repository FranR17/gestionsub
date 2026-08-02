import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import {
  buildSubscriptionsExportPayload,
  escapeCsvCell,
  normalizeImportedSubscription,
  parseCsvRows,
  parseExportedSubscriptionsCsv,
} from './subscriptionImportExport'

const subscription: Subscription = {
  id: 'sub-1',
  name: 'Netflix, Premium',
  amount: 12.99,
  frequency: 'mensual',
  nextChargeDate: '2026-01-01',
  paymentEndDate: null,
  createdAt: '2026-01-01T12:00:00.000Z',
  category: 'Entretenimiento',
  reminderDays: 3,
  reminderTime: '09:00',
  status: 'activa',
  anulado: 0,
}

describe('subscription import/export helpers', () => {
  it('escapes CSV cells with separators or quotes', () => {
    expect(escapeCsvCell('Netflix')).toBe('Netflix')
    expect(escapeCsvCell('Entretenimiento, hogar')).toBe('"Entretenimiento, hogar"')
    expect(escapeCsvCell('Plan "Premium"')).toBe('"Plan ""Premium"""')
    expect(escapeCsvCell('linea 1\nlinea 2')).toBe('"linea 1\nlinea 2"')
  })

  it('builds CSV export payloads', () => {
    const payload = buildSubscriptionsExportPayload([subscription], 'csv')

    expect(payload).toContain('id,nombre,importe')
    expect(payload).toContain('"Netflix, Premium"')
  })

  it('parses CSV rows with quoted commas and quotes', () => {
    expect(parseCsvRows('nombre,categoria\n"Plan ""Premium""","Casa, ocio"')).toEqual([
      ['nombre', 'categoria'],
      ['Plan "Premium"', 'Casa, ocio'],
    ])
  })

  it('maps exported CSV subscriptions to importable records', () => {
    const records = parseExportedSubscriptionsCsv([
      'id,nombre,importe,frecuencia,proximo_cobro,fin_pago,financiado,financiera,creado_en,categoria,recordatorio,estado',
      'sub-1,"Netflix, Premium",12.99,mensual,2026-01-01,,no,,2026-01-01T12:00:00.000Z,Entretenimiento,3,activa',
    ].join('\n'))

    expect(records[0]).toMatchObject({
      name: 'Netflix, Premium',
      amount: '12.99',
      frequency: 'mensual',
      nextChargeDate: '2026-01-01',
      category: 'Entretenimiento',
    })
  })

  it('normalizes imported subscriptions from exported JSON', () => {
    const imported = normalizeImportedSubscription({
      name: 'Spotify',
      amount: '9.99',
      frequency: 'mensual',
      nextChargeDate: '2026-02-01',
      category: '',
      reminderDays: 99,
      status: 'activa',
    }, 'import-1', '2026-01-01T12:00:00.000Z')

    expect(imported).toMatchObject({
      id: 'import-1',
      name: 'Spotify',
      amount: 9.99,
      category: 'General',
      reminderDays: 3,
      anulado: 0,
    })
  })

  it('rejects invalid imported subscriptions', () => {
    expect(normalizeImportedSubscription({ name: '', amount: 1 }, 'x', 'now')).toBeNull()
    expect(normalizeImportedSubscription({ name: 'Bad', amount: 1, frequency: 'diaria', nextChargeDate: '2026-01-01' }, 'x', 'now')).toBeNull()
    expect(normalizeImportedSubscription({ name: 'Bad', amount: -1, frequency: 'mensual', nextChargeDate: '2026-01-01' }, 'x', 'now')).toBeNull()
  })
})
