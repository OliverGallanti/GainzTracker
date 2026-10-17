// Never stored — derived from the latest weight entry plus the profile height
// each render, so it can't go stale against either.
export function computeBmi(weightKg: number | null | undefined, heightCm: number | null | undefined) {
  if (!weightKg || !heightCm) return null
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}
