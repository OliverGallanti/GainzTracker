import { QueryClient, useQuery, type QueryKey } from '@tanstack/react-query'

// One cache for the whole web app (TanStack Query, as on the phone): cards that
// read the same data share one request, and data refetches when the tab comes
// back to the front, so food logged on the phone shows up here on its own.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2 } }, // Render's free tier can take a minute to wake
})

// Fetch-on-mount plus refetch-on-demand, under a cache key:
//
//   const { data, error, reload } = useLoad(['thing', id], () => api('/api/thing'))
//
// - `data` is `undefined` until the first success (null is a legitimate value,
//   e.g. "no macro goal set yet"), and is KEPT across a failed reload so a
//   flaky refetch after a save doesn't blank the card.
// - `error` is true after a failed load and clears on the next success.
// - `reload()` refetches every reader of that key, e.g. after a mutation.
export interface LoadResult<T> {
  data: T | undefined
  error: boolean
  reload: () => void
}

export function useLoad<T>(key: QueryKey, loader: () => Promise<T>): LoadResult<T> {
  const query = useQuery({ queryKey: key, queryFn: loader })
  return {
    data: query.data,
    error: query.isError,
    reload: () => void queryClient.invalidateQueries({ queryKey: key }),
  }
}
