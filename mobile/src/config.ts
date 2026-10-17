// Inlined at build time by Expo from EXPO_PUBLIC_* variables: eas.json for cloud
// builds, mobile/.env.local for local ones. Neither value is secret (the web
// client id is visible in every browser login anyway).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://gainztracker-p8dw.onrender.com'

// The WEB OAuth client id (the same GOOGLE_CLIENT_ID the server uses): native
// Google Sign-In only returns an ID token when configured with it, and the server
// checks the token was issued for exactly this id.
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''
