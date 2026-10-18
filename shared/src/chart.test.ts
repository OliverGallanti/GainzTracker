import { describe, expect, it } from 'vitest'
import { chartYDomain } from './chart'

describe('chartYDomain', () => {
  it('pads the data range by 10% and rounds outward', () => {
    expect(chartYDomain([80, 90])).toEqual([79, 91])
  })

  it('keeps a goal outside the data on screen', () => {
    expect(chartYDomain([80, 82], [70])).toEqual([68, 84]) // 70..82, padded 1.2
  })

  it('pads at least 1 unit, so a single point or flat line still has room', () => {
    expect(chartYDomain([80])).toEqual([79, 81])
    expect(chartYDomain([80, 80, 80])).toEqual([79, 81])
  })

  it('is null with nothing to show', () => {
    expect(chartYDomain([])).toBeNull()
  })
})
