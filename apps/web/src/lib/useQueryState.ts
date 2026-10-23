import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * useState backed by a URL query parameter, so sidebars and links can open a
 * page on a given tab or filter. The fallback value is left out of the URL.
 */
export function useQueryState<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [params, setParams] = useSearchParams()
  const value = (params.get(key) as T | null) ?? fallback
  const set = useCallback(
    (v: T) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          if (v === fallback || v === '') next.delete(key)
          else next.set(key, v)
          return next
        },
        { replace: true },
      ),
    [key, fallback, setParams],
  )
  return [value, set]
}
