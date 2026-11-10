import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Runs an async loader whenever `deps` change and exposes a reload function.
 * Keeps the last successful data while reloading so screens do not flicker.
 */
export function useAsyncData(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const reload = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.resolve()
      .then(() => loaderRef.current())
      .then((result) => {
        if (!active) return
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, loading, error, reload, setData }
}
