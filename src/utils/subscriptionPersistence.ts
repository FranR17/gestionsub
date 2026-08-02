import type { Subscription } from '../types'

export const subscriptionSelectColumns = [
  'id',
  'user_id',
  'name',
  'amount',
  'frequency',
  'next_charge_date',
  'payment_end_date',
  'created_at',
  'category',
  'reminder_days',
  'reminder_time',
  'status',
  'icon_key',
  'custom_logo_url',
  'is_financed',
  'financing_provider_name',
  'financing_provider_logo_url',
  'anulado',
].join(',')

type SubscriptionSavePayload = Omit<Subscription, 'id' | 'createdAt'>

export const toSupabaseSubscriptionPayload = (payload: SubscriptionSavePayload) => ({
  name: payload.name,
  amount: payload.amount,
  frequency: payload.frequency,
  next_charge_date: payload.nextChargeDate,
  payment_end_date: payload.paymentEndDate,
  category: payload.category,
  reminder_days: payload.reminderDays,
  reminder_time: payload.reminderTime,
  status: payload.status,
  icon_key: payload.iconKey,
  custom_logo_url: payload.customLogoUrl,
  is_financed: payload.isFinanced,
  financing_provider_name: payload.financingProviderName,
  financing_provider_logo_url: payload.financingProviderLogoUrl,
})

export const toSupabaseSubscriptionInsert = (payload: SubscriptionSavePayload, userId: string) => ({
  user_id: userId,
  ...toSupabaseSubscriptionPayload(payload),
})

export const toSupabaseImportedSubscriptionInsert = (subscription: Subscription, userId: string) => ({
  user_id: userId,
  name: subscription.name,
  amount: subscription.amount,
  frequency: subscription.frequency,
  next_charge_date: subscription.nextChargeDate,
  payment_end_date: subscription.paymentEndDate,
  category: subscription.category,
  reminder_days: subscription.reminderDays,
  reminder_time: subscription.reminderTime,
  status: subscription.status,
  icon_key: subscription.iconKey,
  custom_logo_url: subscription.customLogoUrl,
  is_financed: subscription.isFinanced,
  financing_provider_name: subscription.financingProviderName,
  financing_provider_logo_url: subscription.financingProviderLogoUrl,
})
