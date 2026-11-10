import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { repo } from '../lib/data'
import {
  deviceFingerprint,
  deviceLabel,
  hasMfaSession,
  hasResidentSession,
  isOfficerRole,
  markMfaSession,
  markResidentSession,
} from '../lib/security'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [notice, setNotice] = useState('')
  const [mfa, setMfa] = useState(null)

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
        setMfa(null)
        setStatus('locked')
        return profile
      }
      throw error
    }

    setUser(profile)
    setMfa(null)
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

        if (isOfficerRole(profile.role)) {
          let level = null
          if (hasMfaSession(profile.id)) {
            const state = await repo.auth.getMfaState()
            level = state?.currentLevel
          }
          const secondFactorOk = level === 'aal2'
          if (!hasMfaSession(profile.id) || !secondFactorOk) {
            await repo.auth.signOut()
            if (!active) return
            setUser(null)
            setNotice('officer')
            setStatus('ready')
            return
          }
          setUser(profile)
          setStatus('ready')
          return
        }

        if (!hasResidentSession(profile.id)) {
          await repo.auth.signOut()
          if (!active) return
          setUser(null)
          setNotice('resident')
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
        setMfa(null)
        setStatus('ready')
      }
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const signIn = useCallback(
    async (email, password) => {
      const profile = await repo.auth.signIn(email, password)

      if (profile.security_locked) {
        setUser(profile)
        setMfa(null)
        setStatus('locked')
        return profile
      }

      if (profile.role === 'resident') {
        await repo.auth.signOut()
        throw new Error('This is a resident account. Use the Resident tab.')
      }

      if (!isOfficerRole(profile.role)) {
        return completeSession(profile)
      }

      const state = await repo.auth.getMfaState()
      setUser(profile)

      if (!state.hasVerifiedFactor) {
        const enrollment = await repo.auth.enrollMfa()
        setMfa({ mode: 'enroll', factorId: enrollment.factorId, enrollment })
        setStatus('mfa-enroll')
        return profile
      }

      setMfa({ mode: 'challenge', factorId: state.factorId, enrollment: null })
      setStatus('mfa-challenge')
      return profile
    },
    [completeSession],
  )

  const signInResident = useCallback(
    async (phone, password) => {
      const profile = await repo.auth.signInResident(phone, password)

      if (profile.security_locked) {
        setUser(profile)
        setMfa(null)
        setStatus('locked')
        return profile
      }

      if (profile.role !== 'resident') {
        await repo.auth.signOut()
        throw new Error('This is a committee account. Use the Committee tab.')
      }

      markResidentSession(profile.id)
      return completeSession(profile)
    },
    [completeSession],
  )

  const verifyMfa = useCallback(
    async (code) => {
      if (!mfa?.factorId) throw new Error('Start sign-in again to set up your authenticator.')
      const profile = await repo.auth.verifyMfa(mfa.factorId, code)

      if (profile.security_locked) {
        setUser(profile)
        setMfa(null)
        setStatus('locked')
        return profile
      }

      markMfaSession(profile.id)
      return completeSession(profile)
    },
    [mfa, completeSession],
  )

  const cancelEnrollment = useCallback(async () => {
    if (mfa?.mode === 'enroll' && mfa.factorId) {
      await repo.auth.cancelMfa(mfa.factorId).catch(() => null)
    }
    await repo.auth.signOut()
    setUser(null)
    setMfa(null)
    setStatus('ready')
  }, [mfa])

  const signOut = useCallback(async () => {
    await repo.auth.signOut()
    setUser(null)
    setMfa(null)
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
      mfa,
      isOfficer: isOfficerRole(user?.role),
      isTreasurer: user?.role === 'treasurer',
      isPresident: user?.role === 'president',
      isSecretary: user?.role === 'secretary',
      isResident: user?.role === 'resident',
      isReadOnlyOfficer: isOfficerRole(user?.role) && user?.role !== 'treasurer',
      signIn,
      signInResident,
      signOut,
      verifyMfa,
      cancelEnrollment,
      refresh,
      setUser,
    }),
    [
      user,
      status,
      notice,
      mfa,
      signIn,
      signInResident,
      signOut,
      verifyMfa,
      cancelEnrollment,
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
