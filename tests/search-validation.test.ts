import { describe, expect, it } from 'vitest'
import { parseCoordinatePair, validateCoordinates } from '../src/shared/coordinates'
import { validateSearchQuery } from '../src/shared/search-validation'

describe('search validation', () => {
  it('accepts a trimmed place name', () => {
    expect(validateSearchQuery('  Millennium Park  ')).toEqual({
      ok: true,
      query: 'Millennium Park'
    })
  })

  it('rejects empty, tiny, huge, control, and URL queries', () => {
    expect(validateSearchQuery('').ok).toBe(false)
    expect(validateSearchQuery('A').ok).toBe(false)
    expect(validateSearchQuery('x'.repeat(201)).ok).toBe(false)
    expect(validateSearchQuery('hi\u0007there').ok).toBe(false)
    expect(validateSearchQuery('https://example.com').ok).toBe(false)
  })
})

describe('coordinate validation', () => {
  it('parses a valid pair', () => {
    expect(parseCoordinatePair('41.8781', '-87.6298')).toEqual({ lat: 41.8781, lng: -87.6298 })
  })

  it('rejects out-of-range and non-numeric values', () => {
    expect(parseCoordinatePair('91', '0')).toEqual({ error: 'Latitude must be between -90 and 90.' })
    expect(parseCoordinatePair('0', '200')).toEqual({ error: 'Longitude must be between -180 and 180.' })
    expect(parseCoordinatePair('north', 'west')).toEqual({
      error: 'Latitude and longitude must be finite numbers.'
    })
    expect(validateCoordinates({ lat: Number.NaN, lng: 0 })).toEqual({
      error: 'Coordinates must be finite numbers.'
    })
  })
})
