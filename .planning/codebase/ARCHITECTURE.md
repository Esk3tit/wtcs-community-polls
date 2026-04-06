# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Single Page Application (SPA) with Client-Side Rendering

**Key Characteristics:**
- React 19 with TypeScript for type safety
- Vite as build tool and dev server with Hot Module Replacement (HMR)
- Component-based UI architecture with CSS modules for styling
- No backend service layer (static content and client state only)
- Minimal dependencies - core focus on React and React DOM

## Layers

**Presentation Layer:**
- Purpose: Render user interface and handle user interactions
- Location: `src/`
- Contains: React components, styles (CSS), SVG assets
- Depends on: React, React DOM, asset imports
- Used by: Browser/DOM

**Entry Point Layer:**
- Purpose: Bootstrap the application and mount React to DOM
- Location: `src/main.tsx`
- Contains: StrictMode wrapper, root DOM target mounting
- Depends on: React, React DOM
- Used by: HTML template (`index.html`)

**Component Layer:**
- Purpose: Encapsulate UI logic and state management
- Location: `src/App.tsx`
- Contains: Root component with event handlers, state (count), JSX layout
- Depends on: React hooks (useState), asset imports
- Used by: Entry point

**Asset Layer:**
- Purpose: Store static resources (images, icons, SVGs)
- Location: `src/assets/`, `public/`
- Contains: SVG logos (React, Vite), hero image, favicon, icon spritesheet
- Depends on: None
- Used by: Components and HTML

## Data Flow

**User Interaction Flow:**

1. Browser loads `index.html` with root div and script tag
2. `src/main.tsx` renders `App` component into #root element
3. `App` component initializes with state (count = 0)
4. User clicks button triggering onClick handler
5. Handler calls setCount, triggering re-render
6. React updates DOM with new count value

**Asset Loading Flow:**

1. Vite processes import statements for assets in `App.tsx`
2. Assets are bundled and served with versioned filenames
3. SVG sprites from `public/icons.svg` loaded via SVG `<use>` elements
4. Images (`react.svg`, `vite.svg`, `hero.png`) imported directly

**State Management:**
- Local component state only via React's `useState` hook
- Count state lives in `App` component
- No global state management (Redux, Context API)
- No API calls or external data fetching

## Key Abstractions

**React Component:**
- Purpose: Encapsulate UI and logic
- Examples: `src/App.tsx`
- Pattern: Functional component with hooks (useState)

**CSS Custom Properties:**
- Purpose: Centralize theme colors and typography
- Examples: `--text`, `--accent`, `--bg`, `--shadow` in `src/index.css`
- Pattern: CSS variables with light/dark theme support via media query `prefers-color-scheme`

**Responsive Design:**
- Purpose: Adapt layout for mobile/tablet/desktop
- Pattern: CSS media queries at breakpoint `(max-width: 1024px)`
- Applied to: Layout sections (#center, #next-steps), typography, spacing

## Entry Points

**HTML Entry:**
- Location: `index.html`
- Triggers: Browser page load
- Responsibilities: Define DOM structure, load favicon, include script tag for `src/main.tsx`

**JavaScript Entry:**
- Location: `src/main.tsx`
- Triggers: HTML script tag execution
- Responsibilities: Import React, render App component to DOM, enable StrictMode for development checks

**Component Entry:**
- Location: `src/App.tsx`
- Triggers: Called by main.tsx render
- Responsibilities: Render UI sections, manage count state, handle button click events

## Error Handling

**Strategy:** React StrictMode for development warnings

**Patterns:**
- StrictMode wraps entire app in `src/main.tsx` for detecting unsafe lifecycle methods, legacy APIs
- No explicit error boundary or error handling (minimal error surface)
- Console errors would surface in browser dev tools

## Cross-Cutting Concerns

**Logging:** None - no logging framework configured

**Validation:** None - no form validation or data validation layer

**Authentication:** None - no auth system (public, static content only)

**Styling:** Global CSS with scoped component styles
- Global styles: `src/index.css` (colors, typography, layout)
- Component styles: `src/App.css` (component-specific interactions and animations)
- No CSS-in-JS library (plain CSS)

**Build/Compile:** TypeScript compilation with strict checks
- Strict rules configured in `tsconfig.app.json`: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Vite handles module bundling and code splitting

---

*Architecture analysis: 2026-04-06*
