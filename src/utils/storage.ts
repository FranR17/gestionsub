export const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const storedValue = localStorage.getItem(key)
    if (!storedValue) {
      return fallback
    }
    return JSON.parse(storedValue) as T
  } catch {
    return fallback
  }
}

const isAppStorageKey = (key: string) =>
  key.startsWith('gestionsub.') ||
  key === 'gestionsub.pendingInvite' ||
  /^sb-.+-auth-token$/.test(key) ||
  key.startsWith('supabase.auth.token')

const removeMatchingStorageKeys = (storage: Storage) => {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index)
    if (key && isAppStorageKey(key)) {
      storage.removeItem(key)
    }
  }
}

export const clearLocalAppData = async () => {
  removeMatchingStorageKeys(localStorage)
  removeMatchingStorageKeys(sessionStorage)

  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }
}
