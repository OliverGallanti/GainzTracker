import * as SecureStore from 'expo-secure-store'
import { API_URL } from './config'

// The Bearer token from POST /auth/google/token, kept in the device keystore.
const TOKEN_KEY = 'gainz.token'
let token: string | null = null

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY)
  return token
}

export async function saveToken(value: string) {
  token = value
  await SecureStore.setItemAsync(TOKEN_KEY, value)
}

export async function clearToken() {
  token = null
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

// The token was rejected (expired or revoked): the app signs the user out.
export class UnauthorizedError extends Error {}

// Same contract as the web app's api(): throws on non-2xx, null for 204.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers name the type they expect
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(API_URL + path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) throw Object.assign(new Error(`Request to ${path} failed with status ${res.status}`), { status: res.status })
  if (res.status === 204) return null as T
  return res.json()
}
