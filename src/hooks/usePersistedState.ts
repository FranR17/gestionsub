import { useEffect, useState } from 'react'
import { readStorage } from '../utils/storage'

/**
 * Like useState, but automatically persists to localStorage
 * whenever the value changes.
 * Optional `init` transform is applied once when reading from storage.
 */
export function usePersistedState<T>(key: string, fallback: T, init?: (v: T) => T) {
  const [value, setValue] = useState<T>(() => {
    const raw = readStorage<T>(key, fallback)
    return init ? init(raw) : raw
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}
