// The y-axis range for a progress chart. Taking only the plotted points would
// push a goal or reference line outside the range off-screen, so every one of
// them is included, then padded by 10% (at least 1 unit) and rounded outward.
// Null when there's nothing to show.
export function chartYDomain(values: number[], extras: number[] = []): [number, number] | null {
  const all = [...values, ...extras]
  if (all.length === 0) return null
  const min = Math.min(...all)
  const max = Math.max(...all)
  const padding = Math.max((max - min) * 0.1, 1)
  return [Math.floor(min - padding), Math.ceil(max + padding)]
}
