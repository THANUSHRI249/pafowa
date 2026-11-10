import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { repo } from '../lib/data'
import {
  deviceFingerprint,
  deviceLabel,
  hasSession,
  isOfficerRole,
  markSession,
} from '../lib/security'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [notice, setNotice] = useState('')

  const completeSession = useCallback(async (profile) => {
    const fingerprint = await deviceFingerprint()
    try {
      await repo.auth.registerLogin({
        deviceHash: fingerprint,
        platform: deviceLabel(),
        userAgent: navigator.userAgent,
      })
    } catch (error) {
      if (/locked/i.test(error.message || '')) {
        setUser(profile)
        setStatus('locked')
        return profile
      }
      throw error
    }

    setUser(profile)
    setNotice('')
    setStatus('ready')
    return profile
  }, [])

  useEffect(() => {
    let active = true

    async function boot() {
      try {
        const profile = await repo.auth.getSession()
        if (!active) return

        if (!profile) {
          setStatus('ready')
          return
        }

        if (profile.security_locked) {
          setUser(profile)
          setStatus('locked')
          return
        }

        if (!hasSession(profile.id)) {
          await repo.auth.signOut()
          if (!active) return
          setUser(null)
          setNotice('session')
          setStatus('ready')
          return
        }

        setUser(profile)
        setStatus('ready')
      } catch {
        if (active) setStatus('ready')
      }
    }

    boot()

    const unsubscribe = repo.auth.onChange((profile) => {
      if (!active) return
      if (!profile) {
        setUser(null)
        setStatus('ready')
      }
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const signIn = useCallback(
    async (phone, password) => {
      const profile = await repo.auth.signIn(phone, password)

      if (profile.security_locked) {
        setUser(profile)
        setStatus('locked')
        return profile
      }

      markSession(profile.id)
      return completeSession(profile)
    },
    [completeSession],
  )

  const signOut = useCallback(async () => {
    await repo.auth.signOut()
    setUser(null)
    setNotice('')
    setStatus('ready')
  }, [])

  const refresh = useCallback(async () => {
    const profile = await repo.profiles.getMe()
    setUser(profile)
    return profile
  }, [])

  const value = useMemo(
    () => ({
      user,
      status,
      notice,
      isOfficer: isOfficerRole(user?.role),
      isTreasurer: user?.role === 'treasurer',
      isPresident: user?.role === 'president',
      isSecretary: user?.role === 'secretary',
      isResident: user?.role === 'resident',
      isReadOnlyOfficer: isOfficerRole(user?.role) && user?.role !== 'treasurer',
      signIn,
      signOut,
      refresh,
      setUser,
    }),
    [
      user,
      status,
      notice,
      signIn,
      signOut,
      refresh,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
