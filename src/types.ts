import type { LucideIcon } from 'lucide-react'

export type Frequency = 'semanal' | 'mensual' | 'trimestral' | 'anual'
export type Status = 'activa' | 'cancelada'
export type Reminder = number
export type ThemeMode = 'light' | 'dark'
export type AuthMode = 'login' | 'register'
export type SubscriptionFilter = 'all' | 'activa' | 'cancelada'
export type ChargeOrder = 'asc' | 'desc'
export type GroupFrequency = 'puntual' | 'semanal' | 'mensual' | 'trimestral' | 'anual'
export type GroupSplitMode = 'equal' | 'custom'
export type View = 'dashboard' | 'subscriptions' | 'form' | 'timeline' | 'groups' | 'settings' | 'settlements'

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type Subscription = {
  id: string
  name: string
  amount: number
  frequency: Frequency
  nextChargeDate: string
  paymentEndDate?: string | null
  createdAt: string
  iconKey?: string | null
  customLogoUrl?: string | null
  isFinanced?: boolean
  financingProviderName?: string | null
  financingProviderLogoUrl?: string | null
  category: string
  reminderDays: Reminder
  reminderTime: string
  status: Status
  anulado: 0 | 1
  groupId?: string | null
  groupPayerMemberId?: string | null
  groupParticipantIds?: string[]
  groupShares?: Record<string, number> | null
}

export type PriceChange = {
  id: string
  subscriptionId: string
  subscriptionName: string
  previousAmount: number
  nextAmount: number
  changedAt: string
}

export type SupabaseSubscriptionRow = {
  id: string
  user_id: string
  name: string
  amount: number
  frequency: Frequency
  next_charge_date: string
  payment_end_date?: string | null
  created_at: string
  category: string
  reminder_days: number
  reminder_time?: string | null
  status: Status
  icon_key?: string | null
  custom_logo_url?: string | null
  is_financed?: boolean | null
  financing_provider_name?: string | null
  financing_provider_logo_url?: string | null
  anulado?: number
}

export type GroupExpenseRow = {
  id: string
  name: string
  amount: number
  frequency: GroupFrequency
  next_charge_date: string
  payment_end_date?: string | null
  is_financed?: boolean | null
  financing_provider_name?: string | null
  financing_provider_logo_url?: string | null
  created_at: string
  is_active: boolean
  payer_member_id?: string | null
}

export type Group = {
  id: string
  name: string
  ownerUserId: string
  createdAt: string
}

export type GroupMember = {
  id: string
  groupId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  status: 'invited' | 'active' | 'left'
  displayName: string
}

export type GroupInvite = {
  id: string
  groupId: string
  inviteeEmail: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expiresAt: string
}

export type GroupBalance = {
  member_id: string
  member_name: string
  paid_total: number
  owed_total: number
  net_total: number
}

export type SettlementTransfer = {
  from_member_id: string
  from_name: string
  to_member_id: string
  to_name: string
  amount: number
}

export type MonthlyPaymentSummary = {
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  totalCount: number
  paidCount: number
  pendingCount: number
}

export type Settlement = {
  settled: boolean
  settled_at?: string
  settled_by?: string
  balance_snapshot?: GroupBalance[]
  transfers?: SettlementTransfer[]
  notes?: string
}

export type IconOption = {
  key: string
  label: string
  Icon: LucideIcon
}

export type AppStoreResult = {
  id: number
  name: string
  iconUrl: string
  category: string
}
