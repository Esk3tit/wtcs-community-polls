import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AppErrorFallback } from '@/components/AppErrorFallback'

describe('AppErrorFallback (UI-SPEC Contract 2)', () => {
  it('renders the heading copy verbatim', () => {
    render(<AppErrorFallback />)
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
  })

  it('renders the body copy verbatim', () => {
    render(<AppErrorFallback />)
    expect(
      screen.getByText(/The page hit an unexpected error\. Reloading usually helps/),
    ).toBeInTheDocument()
  })

  it('renders a Reload page primary button', () => {
    render(<AppErrorFallback />)
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument()
  })

  it('renders a Report issue secondary link', () => {
    render(<AppErrorFallback />)
    // Either a link element or a button — UI-SPEC says Button variant=link.
    expect(screen.getByText(/report issue/i)).toBeInTheDocument()
  })

  it('does NOT render any stack trace or raw error text (ASVS V7)', () => {
    const { container } = render(<AppErrorFallback />)
    // Assert against the full subtree text so multi-line stack frames
    // (e.g. inside a <pre>) or concatenated text nodes can't slip past.
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/at [A-Z][A-Za-z0-9]*/)
    expect(text).not.toMatch(/Error:/)
    expect(text).not.toMatch(/\bstack trace\b/i)
  })
})
