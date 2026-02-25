import {
  Briefcase,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Music,
  Smartphone,
  Tv,
  Wifi,
} from 'lucide-react'
import type { IconOption, Subscription } from './types'

export const storageKeys = {
  session: 'gestionsub.session',
  subscriptions: 'gestionsub.subscriptions',
  appLogoCache: 'gestionsub.appLogoCache',
  chargePayments: 'gestionsub.chargePayments',
  currency: 'gestionsub.currency',
  theme: 'gestionsub.theme',
  notifications: 'gestionsub.notifications',
  reminder: 'gestionsub.reminder',
  email: 'gestionsub.email',
  authMode: 'gestionsub.authMode',
  reminderDigest: 'gestionsub.reminderDigest',
  profileContext: 'gestionsub.profileContext',
} as const

export const seedSubscriptions: Subscription[] = [
  {
    id: 'local-1',
    name: 'Netflix',
    amount: 12.99,
    frequency: 'mensual',
    nextChargeDate: '2026-02-19',
    createdAt: '2025-10-01T12:00:00.000Z',
    category: 'Entretenimiento',
    reminderDays: 3,
    status: 'activa',
    anulado: 0,
  },
  {
    id: 'local-2',
    name: 'Spotify',
    amount: 9.99,
    frequency: 'mensual',
    nextChargeDate: '2026-03-01',
    createdAt: '2025-11-01T12:00:00.000Z',
    category: 'Música',
    reminderDays: 1,
    status: 'activa',
    anulado: 0,
  },
  {
    id: 'local-3',
    name: 'Gimnasio',
    amount: 35,
    frequency: 'mensual',
    nextChargeDate: '2026-02-22',
    createdAt: '2025-12-01T12:00:00.000Z',
    category: 'Salud',
    reminderDays: 7,
    status: 'activa',
    anulado: 0,
  },
]

export const weekDayLabels = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

export const iconOptions: IconOption[] = [
  { key: 'home', label: 'Casa', Icon: Home },
  { key: 'bank', label: 'Banco', Icon: Landmark },
  { key: 'gym', label: 'Gimnasio', Icon: Dumbbell },
  { key: 'streaming', label: 'Streaming', Icon: Tv },
  { key: 'music', label: 'Música', Icon: Music },
  { key: 'gaming', label: 'Gaming', Icon: Gamepad2 },
  { key: 'health', label: 'Salud', Icon: HeartPulse },
  { key: 'work', label: 'Trabajo', Icon: Briefcase },
  { key: 'phone', label: 'Móvil', Icon: Smartphone },
  { key: 'internet', label: 'Internet', Icon: Wifi },
  { key: 'education', label: 'Estudio', Icon: GraduationCap },
]

export const iconOptionByKey = new Map(iconOptions.map((option) => [option.key, option]))
