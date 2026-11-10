import { OFFICER_ROLES } from './config'

const SESSION_KEY = 'pafowa.session'

// Every account signs in with a phone number. Supabase Auth only knows email
// accounts, so each phone maps to one reserved address on this domain.
// Nothing is ever sent to it; it is only the account key.
export const RESIDENT_LOGIN_DOMAIN = 'residents.pafowa.in'
const SECURITY_EVENT = 'pafowa:security-changed'

export function notifySecurityChanged() {
  try {
    window.dispatchEvent(new Event(SECURITY_EVENT))
  } catch {
    // ignore
  }
}

export function onSecurityChanged(handler) {
  window.addEventListener(SECURITY_EVENT, handler)
  return () => window.removeEventListener(SECURITY_EVENT, handler)
}

export function isOfficerRole(role) {
  return OFFICER_ROLES.includes(role)
}

export function normalisePhone(value) {
  const input = String(value || '').trim()
  if (!input) return ''
  const digits = input.replace(/\D/g, '')
  if (!digits) return ''
  if (input.startsWith('+')) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  return `+${digits}`
}

export function isValidPhone(value) {
  return /^\+[1-9]\d{7,14}$/.test(normalisePhone(value))
}

export function residentLoginEmail(phone) {
  const digits = normalisePhone(phone).replace(/\D/g, '')
  return digits ? `${digits}@${RESIDENT_LOGIN_DOMAIN}` : ''
}

export function markSession(userId) {
  try {
    sessionStorage.setItem(SESSION_KEY, userId)
  } catch {
    // sessionStorage can be unavailable in hardened browsers.
  }
}

export function hasSession(userId) {
  try {
    return sessionStorage.getItem(SESSION_KEY) === userId
  } catch {
    return false
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

function fallbackHash(text) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv-${(hash >>> 0).toString(16)}`
}

let cachedFingerprint = ''

// A stable, non-identifying fingerprint for this browser. It is hashed locally;
// no raw device details are sent to the server.
export async function deviceFingerprint() {
  if (cachedFingerprint) return cachedFingerprint

  const screenInfo =
    typeof window !== 'undefined' && window.screen
      ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
      : 'no-screen'
  const timeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    } catch {
      return ''
    }
  })()

  const parts = [
    navigator.userAgent || '',
    navigator.platform || '',
    navigator.language || '',
    timeZone,
    screenInfo,
    String(navigator.hardwareConcurrency || ''),
    String(navigator.deviceMemory || ''),
  ]
  const raw = parts.join('|')

  try {
    if (globalThis.crypto?.subtle) {
      const bytes = new TextEncoder().encode(raw)
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
      cachedFingerprint = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
      return cachedFingerprint
    }
  } catch {
    // fall through to the simple hash
  }

  cachedFingerprint = fallbackHash(raw)
  return cachedFingerprint
}

export function deviceLabel() {
  const platform = navigator.userAgentData?.platform || navigator.platform || 'Browser'
  const mobile = /Mobi|Android/i.test(navigator.userAgent)
  return `${platform}${mobile ? ' · Mobile' : ' · Desktop'}`
}

export function suggestPassword() {
  const random = new Uint32Array(1)
  crypto.getRandomValues(random)
  return `Pargavi@${String(random[0] % 10000).padStart(4, '0')}`
}
