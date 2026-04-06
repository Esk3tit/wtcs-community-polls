# Codebase Structure

**Analysis Date:** 2026-04-06

## Directory Layout

```
wtcs-community-polls/
├── src/                        # Source code and assets
│   ├── App.tsx                # Root component with UI and state
│   ├── App.css                # Component-specific styles
│   ├── main.tsx               # Application entry point
│   ├── index.css              # Global styles and theme
│   └── assets/                # Static images and icons
│       ├── react.svg          # React logo
│       ├── vite.svg           # Vite logo
│       └── hero.png           # Hero image
├── public/                    # Public static assets (served as-is)
│   ├── favicon.svg            # Browser tab icon
│   └── icons.svg              # SVG sprite sheet for icons
├── index.html                 # HTML template and entry point
├── vite.config.ts             # Vite build configuration
├── tsconfig.json              # TypeScript root config
├── tsconfig.app.json          # TypeScript app compilation config
├── tsconfig.node.json         # TypeScript node/build tools config
├── package.json               # Dependencies and scripts
├── package-lock.json          # Locked dependency versions
├── eslint.config.js           # ESLint rules and configuration
├── .gitignore                 # Git ignore patterns
├── LICENSE                    # Apache 2.0 license
└── README.md                  # Project documentation
```

## Directory Purposes

**src/:**
- Purpose: All application source code and component assets
- Contains: React components, styles, images, entry point
- Key files: `App.tsx`, `main.tsx`, `index.css`, `App.css`

**src/assets/:**
- Purpose: Component-specific static assets (images, logos)
- Contains: SVG and PNG files imported in components
- Key files: `react.svg`, `vite.svg`, `hero.png`

**public/:**
- Purpose: Static files served at root of application without processing
- Contains: Favicon and SVG sprite sheet for icons
- Key files: `favicon.svg`, `icons.svg`
- Generated: No
- Committed: Yes

**Root Config Files:**
- Purpose: Build, type checking, and linting configuration
- Contains: TypeScript configs, Vite config, ESLint config
- Key files: `vite.config.ts`, `tsconfig.app.json`, `eslint.config.js`

## Key File Locations

**Entry Points:**
- `index.html`: HTML template loaded by browser, defines root div and script src
- `src/main.tsx`: JavaScript entry point, mounts React app to DOM
- `src/App.tsx`: React root component, renders all UI

**Configuration:**
- `package.json`: Project metadata, dependencies, npm scripts
- `tsconfig.app.json`: TypeScript compiler options for app code
- `vite.config.ts`: Vite dev server and build configuration
- `eslint.config.js`: Linting rules for TypeScript/React code

**Core Logic:**
- `src/App.tsx`: UI structure, state management (count), event handlers
- `src/main.tsx`: React DOM setup, StrictMode wrapper

**Styling:**
- `src/index.css`: Global styles, CSS custom properties (theme), typography, layout
- `src/App.css`: Component-specific styles, animations, responsive breakpoints

**Assets:**
- `src/assets/`: Component-imported images (react.svg, vite.svg, hero.png)
- `public/`: Server-root assets (favicon.svg, icons.svg)

## Naming Conventions

**Files:**
- React components: PascalCase with `.tsx` extension (e.g., `App.tsx`)
- Entry point: `main.tsx`
- Styles: Match component name with `.css` extension (e.g., `App.css` for `App.tsx`)
- Config: kebab-case for config files (e.g., `vite.config.ts`, `tsconfig.app.json`)
- Assets: kebab-case or simple names (e.g., `hero.png`, `react.svg`)

**Directories:**
- Standard directory names: lowercase, single word (e.g., `src`, `public`, `assets`)

**Variables and Functions:**
- camelCase for variables and functions (inferred from React/TypeScript conventions)
- PascalCase for React component names

## Where to Add New Code

**New Feature:**
- Primary code: `src/App.tsx` (add new component or extend App component)
- Styles: `src/App.css` (add component-specific styles)
- Tests: Create `src/App.test.tsx` (following naming convention, not yet established)

**New Component/Module:**
- Implementation: Create new file in `src/` (e.g., `src/Counter.tsx`)
- Styling: Create accompanying `.css` file (e.g., `src/Counter.css`)
- Import in: `src/App.tsx` to use the component

**Utilities:**
- Shared helpers: Create `src/utils/` directory if utilities grow beyond simple functions
- Format: One utility per file, exported as named export

**Static Assets:**
- Component-used images: `src/assets/` (imported in components)
- Root-level static files: `public/` (favicon, spritesheet, manifest files)
- Public assets do not need import statements, accessible via `/path` directly

## Special Directories

**dist/:**
- Purpose: Build output directory
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by npm install)
- Committed: No (in .gitignore)

**.planning/:**
- Purpose: Planning and documentation files
- Generated: Manually created
- Committed: Yes

**.git/:**
- Purpose: Git version control metadata
- Generated: By git init
- Committed: N/A (git internal)

## Import Path Conventions

**Asset Imports:**
- SVGs and images: `import heroImg from './assets/hero.png'`
- SVG sprites: Reference via `<use href="/icons.svg#icon-name"></use>` (public path)

**Component Imports:**
- Relative imports: `import App from './App.tsx'`
- React imports: `import { useState } from 'react'`
- No path aliases configured (moduleResolution: bundler in tsconfig.app.json)

---

*Structure analysis: 2026-04-06*
