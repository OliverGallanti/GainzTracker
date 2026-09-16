export async function api(path, options = {}) {
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
    return null
  }

  return res.json()
}
