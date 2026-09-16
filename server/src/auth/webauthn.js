import { config } from '../config.js'

// The WebAuthn ceremony always runs in the browser context of FRONTEND_URL
// (the page the user is actually looking at), never this server's own
// origin — even though the browser's requests are proxied here in dev.
// rpID is the *hostname only* (no port); expectedOrigin is an exact-string
// match against clientDataJSON.origin, so it's normalized to strip a
// trailing slash that would otherwise silently break every ceremony.
const normalizedFrontendUrl = config.FRONTEND_URL.replace(/\/$/, '')

export const rpID = new URL(normalizedFrontendUrl).hostname
export const rpName = 'Gainz.Tracker'
export const expectedOrigin = normalizedFrontendUrl

// Separate cookie names for the two ceremonies so a stale registration
// challenge can never be consumed by an authentication verify call, or
// vice versa.
export const REGISTRATION_CHALLENGE_COOKIE = 'passkey_reg_challenge'
export const AUTHENTICATION_CHALLENGE_COOKIE = 'passkey_auth_challenge'
export const CHALLENGE_MAX_AGE_SECONDS = 300
