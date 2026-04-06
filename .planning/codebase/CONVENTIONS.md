# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension (e.g., `App.tsx`)
- Styles: Named after component or section with `.css` extension (e.g., `App.css`, `index.css`)
- Entry point: `main.tsx` for application bootstrap
- Type-agnostic filenames follow component naming convention

**Functions:**
- React component functions: PascalCase (e.g., `function App()`)
- Arrow functions within components: camelCase (e.g., `setCount`, `(count) => count + 1`)
- Imported library functions maintain their library conventions (e.g., `useState`, `createRoot`)

**Variables:**
- State variables: camelCase (e.g., `count`, `setCount`)
- React hooks: Prefix with `use` per React conventions (e.g., `useState`)
- CSS variable names: kebab-case prefixed with double dashes (e.g., `--text`, `--accent-bg`, `--social-bg`)
- Class names: kebab-case (e.g., `counter`, `hero`, `button-icon`)
- DOM IDs: kebab-case (e.g., `center`, `next-steps`, `social`)

**Types:**
- TypeScript enforced with `tsconfig.app.json` targeting ES2023
- React component typing via implicit JSX and prop inference
- Types for third-party imports included via TypeScript (`@types/react`, `@types/react-dom`)

## Code Style

**Formatting:**
- No `.prettierrc` file - follows ESLint defaults
- ECMAScript 2020+ syntax supported
- Indentation and spacing determined by ESLint configuration

**Linting:**
- ESLint 9.39.4 with flat config (`eslint.config.js`)
- Rule sets:
  - `@eslint/js` - JavaScript baseline recommendations
  - `typescript-eslint` - TypeScript-specific rules
  - `eslint-plugin-react-hooks` - React hooks best practices
  - `eslint-plugin-react-refresh` - Vite React refresh compatibility
- Browser globals enabled via `globals.browser`
- ECMAVersion: 2020

**Enforced Constraints:**
- `noUnusedLocals: true` - Unused variables cause compilation error
- `noUnusedParameters: true` - Unused function parameters cause error
- `erasableSyntaxOnly: true` - Only syntax that can be erased during type-stripping allowed
- `noFallthroughCasesInSwitch: true` - Switch case fallthrough requires explicit handling

## Import Organization

**Order:**
1. React imports (e.g., `import { useState } from 'react'`)
2. React DOM imports (e.g., `import { createRoot } from 'react-dom/client'`)
3. Local styles (e.g., `import './index.css'`)
4. Local components (e.g., `import App from './App.tsx'`)
5. Asset imports (e.g., `import heroImg from './assets/hero.png'`)

**Path Aliases:**
- Not configured - relative imports used throughout
- Module resolution: `bundler` mode via `tsconfig.app.json`

**Module Syntax:**
- `import/export` syntax required (`"type": "module"` in `package.json`)
- `verbatimModuleSyntax: true` - Requires explicit type imports/exports syntax

## Error Handling

**Patterns:**
- No try/catch blocks in current codebase
- React 19 uses `StrictMode` wrapper in `main.tsx` for development error detection
- No custom error boundaries implemented
- Component errors propagate to React's error handling

## Logging

**Framework:** Not implemented

**Patterns:**
- No logging utility configured
- Development debugging via React DevTools and browser console available

## Comments

**When to Comment:**
- Not extensively used in current codebase
- Code is self-documenting through clear function/variable naming

**JSDoc/TSDoc:**
- Not implemented in current codebase
- TypeScript types provide implicit documentation

## Function Design

**Size:** Compact component functions

**Parameters:**
- React components: No parameters (functional components with hooks)
- Callback handlers: Minimal parameters (e.g., arrow functions capturing scope)

**Return Values:**
- React components return JSX elements
- Handlers return void or state updates

## Module Design

**Exports:**
- Default export for main component (`export default App`)
- React component serves as root export from module

**Barrel Files:**
- Not used - direct imports from source files

---

*Convention analysis: 2026-04-06*
