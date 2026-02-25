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
