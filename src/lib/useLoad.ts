import { useEffect, useRef, useState } from 'react'

// Fetch-on-mount plus refetch-on-demand, once, instead of hand-rolled per card.
//
//   const { data, error, reload } = useLoad(() => api('/api/thing'), key)
//
// - `data` is `undefined` until the first success (null is a legitimate value,
//   e.g. "no macro goal set yet"), and is KEPT across a failed reload so a
//   flaky refetch after a save doesn't blank the card.
// - `error` is true after a failed load and clears on the next success.
// - `key` re-runs the load when it changes (a prop, an id); `reload()` re-runs
//   it on demand, e.g. after a mutation.
// - A response that arrives after a newer load started is dropped, so a slow
//   old request can never overwrite fresher data.
//
// State is set inside the promise callbacks, never synchronously in the effect
// body — the latter is what react-hooks/set-state-in-effect rightly flags.
export interface LoadResult<T> {
  data: T | undefined
  error: boolean
  reload: () => void
}

export function useLoad<T>(loader: () => Promise<T>, key?: unknown): LoadResult<T> {
  const [state, setState] = useState<{ data: T | undefined; error: boolean }>({ data: undefined, error: false })
  const [tick, setTick] = useState(0)

  // Read through a ref so a fresh inline `loader` each render doesn't re-fire
  // the fetch; only `key` and `reload()` do.
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  })

  useEffect(() => {
    let stale = false
    loaderRef.current().then(
      (data) => {
        if (!stale) setState({ data, error: false })
      },
      () => {
        if (!stale) setState((s) => ({ ...s, error: true }))
      },
    )
    return () => {
      stale = true
    }
  }, [key, tick])

  return { data: state.data, error: state.error, reload: () => setTick((t) => t + 1) }
}
