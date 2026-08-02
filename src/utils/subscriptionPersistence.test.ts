import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import {
  subscriptionSelectColumns,
  toSupabaseImportedSubscriptionInsert,
  toSupabaseSubscriptionInsert,
  toSupabaseSubscriptionPayload,
} from './subscriptionPersistence'

const subscription: Subscription = {
  id: 'sub-1',
  name: 'Netflix',
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
  iconKey: 'streaming',
  customLogoUrl: null,
  isFinanced: false,
  financingProviderName: null,
  financingProviderLogoUrl: null,
}

describe('subscription persistence helpers', () => {
  it('keeps select columns aligned with saved fields', () => {
    expect(subscriptionSelectColumns).toContain('payment_end_date')
    expect(subscriptionSelectColumns).toContain('reminder_time')
    expect(subscriptionSelectColumns).toContain('anulado')
  })

  it('maps UI payloads to Supabase columns', () => {
    expect(toSupabaseSubscriptionPayload(subscription)).toMatchObject({
      name: 'Netflix',
      next_charge_date: '2026-01-01',
      reminder_days: 3,
      icon_key: 'streaming',
    })
  })

  it('adds user_id for inserts', () => {
    expect(toSupabaseSubscriptionInsert(subscription, 'user-1')).toMatchObject({
      user_id: 'user-1',
      name: 'Netflix',
    })
  })

  it('maps imported subscriptions to insert rows', () => {
    expect(toSupabaseImportedSubscriptionInsert(subscription, 'user-1')).toMatchObject({
      user_id: 'user-1',
      custom_logo_url: null,
      financing_provider_name: null,
    })
  })
})
