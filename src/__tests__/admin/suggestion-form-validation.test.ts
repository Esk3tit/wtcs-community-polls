import { describe, it, expect } from 'vitest'
import { validateSuggestionForm } from '@/lib/validation/suggestion-form'

const future = () => new Date(Date.now() + 7 * 86400_000).toISOString()
const valid = () => ({
  title: 'Test suggestion',
  description: 'A description',
  choices: ['Yes', 'No'],
  category_id: null,
  image_url: null,
  closes_at: future(),
})

describe('validateSuggestionForm', () => {
  it('accepts a valid input', () => {
    const r = validateSuggestionForm(valid())
    expect(r.ok).toBe(true)
  })

  it('rejects empty title', () => {
    const r = validateSuggestionForm({ ...valid(), title: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.title).toBe('Title is required.')
  })

  it('rejects title shorter than 3', () => {
    const r = validateSuggestionForm({ ...valid(), title: 'ab' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.title).toMatch(/at least 3/)
  })

  it('rejects title longer than 120', () => {
    const r = validateSuggestionForm({ ...valid(), title: 'a'.repeat(121) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.title).toMatch(/120/)
  })

  it('rejects description longer than 1000', () => {
    const r = validateSuggestionForm({ ...valid(), description: 'a'.repeat(1001) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.description).toMatch(/1000/)
  })

  it('rejects fewer than 2 choices', () => {
    const r = validateSuggestionForm({ ...valid(), choices: ['Only'] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.choices).toMatch(/At least 2/)
  })

  it('rejects more than 10 choices', () => {
    const r = validateSuggestionForm({
      ...valid(),
      choices: Array.from({ length: 11 }, (_, i) => `c${i}`),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.choices).toMatch(/Maximum 10/)
  })

  it('rejects empty choice', () => {
    const r = validateSuggestionForm({ ...valid(), choices: ['Yes', ''] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.choices).toMatch(/between 1 and 200/)
  })

  it('rejects duplicate choices (case-insensitive)', () => {
    const r = validateSuggestionForm({ ...valid(), choices: ['Yes', 'YES'] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.choices).toMatch(/Duplicate/)
  })

  it('rejects past closes_at', () => {
    const r = validateSuggestionForm({
      ...valid(),
      closes_at: new Date(Date.now() - 1000).toISOString(),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.closes_at).toMatch(/at least 1 minute/)
  })

  it('rejects invalid image URL', () => {
    const r = validateSuggestionForm({ ...valid(), image_url: 'not a url' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.image_url).toMatch(/valid/)
  })

  it('accepts a valid image URL', () => {
    const r = validateSuggestionForm({
      ...valid(),
      image_url: 'https://example.com/img.jpg',
    })
    expect(r.ok).toBe(true)
  })

  it('rejects closes_at less than 60 seconds in the future', () => {
    const r = validateSuggestionForm({
      ...valid(),
      closes_at: new Date(Date.now() + 59_000).toISOString(),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.closes_at).toMatch(/at least 1 minute/)
  })

  it('rejects impossible dates like Feb 30 (round-trip check)', () => {
    const r = validateSuggestionForm({
      ...valid(),
      closes_at: '2099-02-30T12:00:00Z',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.closes_at).toMatch(/impossible/)
  })

  it('accepts valid ISO timestamps with explicit offsets', () => {
    const r = validateSuggestionForm({
      ...valid(),
      closes_at: '2099-01-01T00:30:00+02:00',
    })
    expect(r.ok).toBe(true)
  })

  it('normalizes blank optional fields to null', () => {
    const r = validateSuggestionForm({
      ...valid(),
      category_id: '   ',
      image_url: '   ',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.category_id).toBeNull()
      expect(r.value.image_url).toBeNull()
    }
  })
})
