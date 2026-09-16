import { SEARCH_MAX_CHARS, SEARCH_MIN_CHARS } from './constants'

export type SearchQuery = { ok: true; query: string } | { ok: false; error: string }

export function validateSearchQuery(raw: string): SearchQuery {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Search query must be text.' }
  }
  const query = raw.trim().replace(/\s+/g, ' ')
  if (query.length === 0) {
    return { ok: false, error: 'Enter a place name before searching.' }
  }
  if (query.length < SEARCH_MIN_CHARS) {
    return { ok: false, error: `Type at least ${SEARCH_MIN_CHARS} characters.` }
  }
  if (query.length > SEARCH_MAX_CHARS) {
    return { ok: false, error: `Keep search under ${SEARCH_MAX_CHARS} characters.` }
  }
  if (/[\u0000-\u001F\u007F]/.test(query)) {
    return { ok: false, error: 'Search cannot include control characters.' }
  }
  if (/^https?:\/\//i.test(query)) {
    return { ok: false, error: 'Paste a place name, not a URL.' }
  }
  return { ok: true, query }
}
