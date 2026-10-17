// `T` is what the caller expects back; it isn't checked at runtime. Defaults to
// `any` so untyped (JSX) callers keep working.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...options,
  })

  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`)
  }

  if (res.status === 204) {
    return null as T
  }

  return res.json()
}
