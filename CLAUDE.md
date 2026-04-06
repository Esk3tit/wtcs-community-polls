<!-- GSD:project-start source:PROJECT.md -->
## Project

**WTCS Community Polls**

A community suggestion and opinion-gathering platform for the War Thunder Competitive Scene (WTCS). Admins create suggestions/topics (e.g. "Remove MiG-29 12-3 from this lineup"), community members share their opinions via Discord OAuth. Hosted at polls.wtcsmapvote.com as a sibling to the main WTCS Map Vote/Ban app — fully independent, sharing only admin accounts conceptually.

**User-facing name:** WTCS Community Suggestions
**Internal/admin name:** WTCS Community Polls (used in code, DB, admin UI)

**Core Value:** Community members can share opinions on competitive scene proposals with confidence that results are authentic — one verified Discord account, one response, no manipulation.

### Constraints

- **Budget**: $0/month — Supabase free tier, Netlify legacy free tier, Upstash Redis free tier
- **Tech stack**: Vite + React + TypeScript + TanStack Router + shadcn/ui + Tailwind CSS v4 (frontend), Supabase (backend), Netlify (hosting) — all locked decisions
- **Auth**: Discord OAuth only, enforced via Supabase native Discord provider
- **Scale**: Must work within Supabase free tier limits (500MB DB, 1GB storage, 2M Edge Function invocations/month)
- **Hosting**: Netlify legacy free tier — separate site from main WTCS app
- **Rate limiting**: Upstash Redis free tier (if needed for abuse prevention)
- **Design system**: shadcn/ui Maia style, Neutral preset (bbVJxbc), Inter font
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ~6.0.2 - Application code, build configuration
- JavaScript - ESLint configuration
## Runtime
- Node.js (development) - Required for tooling and build processes
- npm
- Lockfile: `package-lock.json` (present)
## Frameworks
- React 19.2.4 - UI library and component framework
- React DOM 19.2.4 - DOM rendering for React
- Vite 8.0.4 - Build tool and development server
- TypeScript 6.0.2 - Static type checking and compilation
- ESLint 9.39.4 - Code linting
## Key Dependencies
- @types/react 19.2.14 - React type definitions
- @types/react-dom 19.2.3 - React DOM type definitions
- @types/node 24.12.2 - Node.js type definitions
## Configuration
- No environment configuration file detected
- Development: Uses `npm run dev` with Vite dev server
- Build: Uses TypeScript compilation followed by Vite bundling
- Vite config: `vite.config.ts` - Basic setup with React plugin
- TypeScript configs:
- ESLint config: `eslint.config.js` - Flat config format with React and TypeScript support
## Platform Requirements
- Node.js with npm
- Modern terminal/IDE with TypeScript support
- Browser with ES2023 support
- Browser with ES2023 support
- Served as static files (SPA) - compatible with any static hosting
- No server-side runtime required
## Build & Run Commands
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React components: PascalCase with `.tsx` extension (e.g., `App.tsx`)
- Styles: Named after component or section with `.css` extension (e.g., `App.css`, `index.css`)
- Entry point: `main.tsx` for application bootstrap
- Type-agnostic filenames follow component naming convention
- React component functions: PascalCase (e.g., `function App()`)
- Arrow functions within components: camelCase (e.g., `setCount`, `(count) => count + 1`)
- Imported library functions maintain their library conventions (e.g., `useState`, `createRoot`)
- State variables: camelCase (e.g., `count`, `setCount`)
- React hooks: Prefix with `use` per React conventions (e.g., `useState`)
- CSS variable names: kebab-case prefixed with double dashes (e.g., `--text`, `--accent-bg`, `--social-bg`)
- Class names: kebab-case (e.g., `counter`, `hero`, `button-icon`)
- DOM IDs: kebab-case (e.g., `center`, `next-steps`, `social`)
- TypeScript enforced with `tsconfig.app.json` targeting ES2023
- React component typing via implicit JSX and prop inference
- Types for third-party imports included via TypeScript (`@types/react`, `@types/react-dom`)
## Code Style
- No `.prettierrc` file - follows ESLint defaults
- ECMAScript 2020+ syntax supported
- Indentation and spacing determined by ESLint configuration
- ESLint 9.39.4 with flat config (`eslint.config.js`)
- Rule sets:
- Browser globals enabled via `globals.browser`
- ECMAVersion: 2020
- `noUnusedLocals: true` - Unused variables cause compilation error
- `noUnusedParameters: true` - Unused function parameters cause error
- `erasableSyntaxOnly: true` - Only syntax that can be erased during type-stripping allowed
- `noFallthroughCasesInSwitch: true` - Switch case fallthrough requires explicit handling
## Import Organization
- Not configured - relative imports used throughout
- Module resolution: `bundler` mode via `tsconfig.app.json`
- `import/export` syntax required (`"type": "module"` in `package.json`)
- `verbatimModuleSyntax: true` - Requires explicit type imports/exports syntax
## Error Handling
- No try/catch blocks in current codebase
- React 19 uses `StrictMode` wrapper in `main.tsx` for development error detection
- No custom error boundaries implemented
- Component errors propagate to React's error handling
## Logging
- No logging utility configured
- Development debugging via React DevTools and browser console available
## Comments
- Not extensively used in current codebase
- Code is self-documenting through clear function/variable naming
- Not implemented in current codebase
- TypeScript types provide implicit documentation
## Function Design
- React components: No parameters (functional components with hooks)
- Callback handlers: Minimal parameters (e.g., arrow functions capturing scope)
- React components return JSX elements
- Handlers return void or state updates
## Module Design
- Default export for main component (`export default App`)
- React component serves as root export from module
- Not used - direct imports from source files
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- React 19 with TypeScript for type safety
- Vite as build tool and dev server with Hot Module Replacement (HMR)
- Component-based UI architecture with CSS modules for styling
- No backend service layer (static content and client state only)
- Minimal dependencies - core focus on React and React DOM
## Layers
- Purpose: Render user interface and handle user interactions
- Location: `src/`
- Contains: React components, styles (CSS), SVG assets
- Depends on: React, React DOM, asset imports
- Used by: Browser/DOM
- Purpose: Bootstrap the application and mount React to DOM
- Location: `src/main.tsx`
- Contains: StrictMode wrapper, root DOM target mounting
- Depends on: React, React DOM
- Used by: HTML template (`index.html`)
- Purpose: Encapsulate UI logic and state management
- Location: `src/App.tsx`
- Contains: Root component with event handlers, state (count), JSX layout
- Depends on: React hooks (useState), asset imports
- Used by: Entry point
- Purpose: Store static resources (images, icons, SVGs)
- Location: `src/assets/`, `public/`
- Contains: SVG logos (React, Vite), hero image, favicon, icon spritesheet
- Depends on: None
- Used by: Components and HTML
## Data Flow
- Local component state only via React's `useState` hook
- Count state lives in `App` component
- No global state management (Redux, Context API)
- No API calls or external data fetching
## Key Abstractions
- Purpose: Encapsulate UI and logic
- Examples: `src/App.tsx`
- Pattern: Functional component with hooks (useState)
- Purpose: Centralize theme colors and typography
- Examples: `--text`, `--accent`, `--bg`, `--shadow` in `src/index.css`
- Pattern: CSS variables with light/dark theme support via media query `prefers-color-scheme`
- Purpose: Adapt layout for mobile/tablet/desktop
- Pattern: CSS media queries at breakpoint `(max-width: 1024px)`
- Applied to: Layout sections (#center, #next-steps), typography, spacing
## Entry Points
- Location: `index.html`
- Triggers: Browser page load
- Responsibilities: Define DOM structure, load favicon, include script tag for `src/main.tsx`
- Location: `src/main.tsx`
- Triggers: HTML script tag execution
- Responsibilities: Import React, render App component to DOM, enable StrictMode for development checks
- Location: `src/App.tsx`
- Triggers: Called by main.tsx render
- Responsibilities: Render UI sections, manage count state, handle button click events
## Error Handling
- StrictMode wraps entire app in `src/main.tsx` for detecting unsafe lifecycle methods, legacy APIs
- No explicit error boundary or error handling (minimal error surface)
- Console errors would surface in browser dev tools
## Cross-Cutting Concerns
- Global styles: `src/index.css` (colors, typography, layout)
- Component styles: `src/App.css` (component-specific interactions and animations)
- No CSS-in-JS library (plain CSS)
- Strict rules configured in `tsconfig.app.json`: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Vite handles module bundling and code splitting
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
