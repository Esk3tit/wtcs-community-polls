import { describe, it, expect } from 'vitest'

describe('Test Infrastructure', () => {
  it('vitest runs successfully', () => {
    expect(true).toBe(true)
  })

  it('can use testing-library matchers', () => {
    const div = document.createElement('div')
    div.textContent = 'hello'
    document.body.appendChild(div)
    expect(div).toBeInTheDocument()
    document.body.removeChild(div)
  })
})
