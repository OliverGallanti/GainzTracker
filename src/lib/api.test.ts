import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

function mockFetch(response) {
  const spy = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', spy)
  return spy
}

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api', () => {
  it('always sends cookies, or the session never reaches the BFF', async () => {
    const fetchSpy = mockFetch(jsonResponse({ ok: true }))
    await api('/api/me')
    expect(fetchSpy.mock.calls[0][1].credentials).toBe('include')
  })

  it('returns the parsed JSON body', async () => {
    mockFetch(jsonResponse({ email: 'a@b.c' }))
    await expect(api('/api/me')).resolves.toEqual({ email: 'a@b.c' })
  })

  // Regression: Fastify rejects an empty body that claims to be JSON, which
  // is what broke logout — a POST with no body must not set Content-Type.
  it('omits Content-Type when there is no body', async () => {
    const fetchSpy = mockFetch(jsonResponse(null, 204))
    await api('/auth/logout', { method: 'POST' })
    expect(fetchSpy.mock.calls[0][1].headers['Content-Type']).toBeUndefined()
  })

  it('sets Content-Type when there is a body', async () => {
    const fetchSpy = mockFetch(jsonResponse({}))
    await api('/api/weights', { method: 'POST', body: JSON.stringify({ weightKg: 80 }) })
    expect(fetchSpy.mock.calls[0][1].headers['Content-Type']).toBe('application/json')
  })

  it('returns null for 204 rather than trying to parse an empty body', async () => {
    mockFetch({ ok: true, status: 204, json: async () => { throw new Error('no body to parse') } })
    await expect(api('/api/weights/1', { method: 'DELETE' })).resolves.toBeNull()
  })

  it('throws on a non-2xx response, naming the status', async () => {
    mockFetch(jsonResponse({ error: 'Not authenticated' }, 401))
    await expect(api('/api/me')).rejects.toThrow('401')
  })

  it('throws on 409, so callers can surface a conflict instead of failing silently', async () => {
    mockFetch(jsonResponse({ error: 'Already logged a session for today' }, 409))
    await expect(api('/api/workout-splits/x/logs', { method: 'POST', body: '{}' })).rejects.toThrow()
  })

  it('lets callers add their own headers', async () => {
    const fetchSpy = mockFetch(jsonResponse({}))
    await api('/api/me', { headers: { 'X-Test': '1' } })
    expect(fetchSpy.mock.calls[0][1].headers['X-Test']).toBe('1')
  })
})
