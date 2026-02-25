import type { LucideIcon } from 'lucide-react'

export type Frequency = 'semanal' | 'mensual' | 'trimestral' | 'anual'
export type Status = 'activa' | 'cancelada'
export type Reminder = 1 | 3 | 7
export type ThemeMode = 'light' | 'dark'
export type AuthMode = 'login' | 'register'
export type SubscriptionFilter = 'all' | 'activa' | 'cancelada'
export type ChargeOrder = 'asc' | 'desc'
export type GroupFrequency = 'puntual' | 'semanal' | 'mensual' | 'anual'
export type View = 'dashboard' | 'subscriptions' | 'form' | 'timeline' | 'settings'

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
  createdAt: string
  iconKey?: string | null
  customLogoUrl?: string | null
  category: string
  reminderDays: Reminder
  status: Status
  anulado: 0 | 1
}

export type SupabaseSubscriptionRow = {
  id: string
  user_id: string
  name: string
  amount: number
  frequency: Frequency
  next_charge_date: string
  created_at: string
  category: string
  reminder_days: number
  status: Status
  icon_key?: string | null
  custom_logo_url?: string | null
  anulado?: number
}

export type GroupExpenseRow = {
  id: string
  name: string
  amount: number
  frequency: GroupFrequency
  next_charge_date: string
  created_at: string
  is_active: boolean
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
