import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@/components/theme-provider'

// jsdom does not implement window.matchMedia -- provide a stub
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

function ThemeConsumer() {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={() => setTheme('light')} data-testid="set-light">Light</button>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">Dark</button>
      <button onClick={() => setTheme('system')} data-testid="set-system">System</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
  })

  it('defaults to system theme', () => {
    const { getByTestId } = render(
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(getByTestId('current-theme').textContent).toBe('system')
  })

  it('applies dark class when dark theme selected', () => {
    const { getByTestId } = render(
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <ThemeConsumer />
      </ThemeProvider>
    )
    act(() => { getByTestId('set-dark').click() })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  it('applies light class when light theme selected', () => {
    const { getByTestId } = render(
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <ThemeConsumer />
      </ThemeProvider>
    )
    act(() => { getByTestId('set-light').click() })
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists theme to localStorage', () => {
    const { getByTestId } = render(
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <ThemeConsumer />
      </ThemeProvider>
    )
    act(() => { getByTestId('set-dark').click() })
    expect(localStorage.getItem('test-theme')).toBe('dark')
  })

  it('restores theme from localStorage on mount', () => {
    localStorage.setItem('test-theme', 'dark')
    const { getByTestId } = render(
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <ThemeConsumer />
      </ThemeProvider>
    )
    expect(getByTestId('current-theme').textContent).toBe('dark')
  })
})
