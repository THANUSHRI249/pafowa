import { useCallback, useEffect, useRef, useState } from 'react'
import { repo } from '../lib/data'
import { onSecurityChanged } from '../lib/security'

export function useSecurityOverview(enabled = true) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [error, setError] = useState(null)
  const activeRef = useRef(true)

  const reload = useCallback(async () => {
    if (!enabled) return
    try {
      const result = await repo.security.overview()
      if (!activeRef.current) return
      setData(result)
      setError(null)
    } catch (err) {
      if (!activeRef.current) return
      setError(err)
    } finally {
      if (activeRef.current) setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    activeRef.current = true
    if (!enabled) {
      setLoading(false)
      return () => {
        activeRef.current = false
      }
    }

    reload()
    const timer = setInterval(reload, 30000)
    const onFocus = () => reload()
    const unsubscribe = onSecurityChanged(reload)
    window.addEventListener('focus', onFocus)

    return () => {
      activeRef.current = false
      clearInterval(timer)
      unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, reload])

  return { data, loading, error, reload }
}
