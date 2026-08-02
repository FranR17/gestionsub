import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Subscription } from '../types'
import { formatCurrency, formatDate } from './format'
import { nextCycleDate } from './date'

/**
 * Check if we're running on a native platform (iOS/Android)
 */
export const isNativePlatform = () => Capacitor.isNativePlatform()

/**
 * Request notification permissions (native + web).
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (isNativePlatform()) {
      const result = await LocalNotifications.requestPermissions()
      return result.display === 'granted'
    }
    // Web fallback
    if (typeof Notification !== 'undefined') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
  } catch {
    return false
  }
  return false
}

/**
 * Check if notification permissions are granted.
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    if (isNativePlatform()) {
      const result = await LocalNotifications.checkPermissions()
      return result.display === 'granted'
    }
    if (typeof Notification !== 'undefined') {
      return Notification.permission === 'granted'
    }
  } catch {
    return false
  }
  return false
}

/**
 * Generate a stable numeric ID for a subscription notification.
 * Uses a simple hash of the subscription ID string.
 */
function stableNotificationId(subscriptionId: string): number {
  let hash = 0
  for (let i = 0; i < subscriptionId.length; i++) {
    hash = ((hash << 5) - hash + subscriptionId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 2147483647 || 1 // keep in int32 range, never 0
}

/**
 * Number of future charge cycles to schedule notifications for.
 * This ensures notifications fire even if the user doesn't open the app.
 */
const FUTURE_CYCLES = 6

/**
 * Schedule native local notifications for all active subscriptions.
 * Each subscription gets notifications for the next FUTURE_CYCLES charge dates,
 * scheduled at (chargeDate - reminderDays) at the configured reminderTime.
 *
 * Previously scheduled notifications are cleared and re-created.
 */
export async function scheduleAllNotifications(
  subscriptions: Subscription[],
  currency: string,
): Promise<void> {
  if (!isNativePlatform()) return

  try {
    const hasPermission = await checkNotificationPermission()
    if (!hasPermission) {
      const granted = await requestNotificationPermission()
      if (!granted) return
    }

    // Cancel all previously scheduled
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }

    const now = new Date()
    const notifications: Array<{
      id: number
      title: string
      body: string
      schedule: { at: Date; allowWhileIdle: boolean }
      sound: string
      smallIcon: string
      iconColor: string
    }> = []

    const activeSubs = subscriptions.filter(
      (sub) => sub.status === 'activa' && sub.anulado !== 1,
    )

    for (const sub of activeSubs) {
      const [hours, minutes] = (sub.reminderTime || '09:00').split(':').map(Number)
      let currentChargeDate = sub.nextChargeDate

      for (let cycle = 0; cycle < FUTURE_CYCLES; cycle++) {
        const chargeDate = new Date(`${currentChargeDate}T12:00:00`)
        const reminderDate = new Date(chargeDate)
        reminderDate.setDate(reminderDate.getDate() - sub.reminderDays)
        reminderDate.setHours(hours, minutes, 0, 0)

        if (reminderDate > now) {
          // Future — schedule normally
          const daysText =
            sub.reminderDays === 0 ? 'Hoy' :
            sub.reminderDays === 1 ? 'Mañana' :
            `En ${sub.reminderDays} días`

          // Unique ID per sub + cycle to avoid collisions
          const notifId = (stableNotificationId(sub.id) + cycle) % 2147483647 || 1

          notifications.push({
            id: notifId,
            title: `${daysText}: cobro de ${sub.name}`,
            body: `Se te cobra ${formatCurrency(sub.amount, currency)} el ${formatDate(currentChargeDate)}.`,
            schedule: { at: reminderDate, allowWhileIdle: true },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#6366f1',
          })
        }
        // Past reminder dates are simply skipped

        // Advance to the next charge date based on frequency
        currentChargeDate = nextCycleDate(currentChargeDate, sub.frequency)
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications })
    }
  } catch {
    // silently fail
  }
}

/**
 * Send a test notification immediately (for debugging).
 */
export async function sendTestNotification(): Promise<boolean> {
  try {
    if (isNativePlatform()) {
      const hasPermission = await checkNotificationPermission()
      if (!hasPermission) {
        const granted = await requestNotificationPermission()
        if (!granted) return false
      }
      const testDate = new Date(Date.now() + 3_000) // 3 seconds from now
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 999999,
            title: '🔔 Notifyra funciona',
            body: 'Las notificaciones están configuradas correctamente.',
            schedule: { at: testDate, allowWhileIdle: true },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#6366f1',
          },
        ],
      })
      return true
    }
    // Web fallback
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('🔔 Notifyra funciona', {
        body: 'Las notificaciones están configuradas correctamente.',
      })
      return true
    }
  } catch {
    return false
  }
  return false
}

/**
 * Fire a web notification immediately (for non-native platforms).
 */
export function fireWebNotification(title: string, body: string) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body })
  }
}
