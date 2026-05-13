import '@testing-library/jest-dom/vitest'

// jsdom does not implement ResizeObserver; radix-ui primitives (Checkbox, Switch,
// Select, etc.) reach for it during layout-effect mount. Polyfill globally so
// component tests can render shadcn-vendored radix primitives without crashing.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver
}
