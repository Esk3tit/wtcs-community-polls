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
    render(<AppErrorFallback />)
    // Typical stack-trace markers should NEVER appear in the rendered DOM
    expect(screen.queryByText(/at [A-Z][A-Za-z0-9]*/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/stack/i)).not.toBeInTheDocument()
  })
})
