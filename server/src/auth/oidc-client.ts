import * as client from 'openid-client'
import { config } from '../config.ts'

let googleConfigPromise: Promise<client.Configuration> | undefined

// Discovery is done once and cached — the resulting config is reused for every login.
export function getGoogleOidcConfig() {
  if (!googleConfigPromise) {
    googleConfigPromise = client.discovery(
      new URL('https://accounts.google.com'),
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
    )
  }
  return googleConfigPromise
}
