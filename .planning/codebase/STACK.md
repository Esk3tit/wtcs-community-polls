# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- TypeScript ~6.0.2 - Application code, build configuration

**Secondary:**
- JavaScript - ESLint configuration

## Runtime

**Environment:**
- Node.js (development) - Required for tooling and build processes

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- React 19.2.4 - UI library and component framework
- React DOM 19.2.4 - DOM rendering for React

**Build/Dev:**
- Vite 8.0.4 - Build tool and development server
  - Plugin: @vitejs/plugin-react 6.0.1 - React integration with Fast Refresh support
- TypeScript 6.0.2 - Static type checking and compilation

**Linting/Formatting:**
- ESLint 9.39.4 - Code linting
  - @eslint/js 9.39.4 - Base JavaScript ESLint rules
  - typescript-eslint 8.58.0 - TypeScript support for ESLint
  - eslint-plugin-react-hooks 7.0.1 - React Hooks best practices
  - eslint-plugin-react-refresh 0.5.2 - React Fast Refresh rules
  - globals 17.4.0 - Global variable definitions

## Key Dependencies

**Type Definitions:**
- @types/react 19.2.14 - React type definitions
- @types/react-dom 19.2.3 - React DOM type definitions
- @types/node 24.12.2 - Node.js type definitions

## Configuration

**Environment:**
- No environment configuration file detected
- Development: Uses `npm run dev` with Vite dev server
- Build: Uses TypeScript compilation followed by Vite bundling

**Build:**
- Vite config: `vite.config.ts` - Basic setup with React plugin
- TypeScript configs:
  - `tsconfig.json` - References app and node configs
  - `tsconfig.app.json` - App code compilation (ES2023, JSX, bundler mode)
  - `tsconfig.node.json` - Build tool compilation (ES2023, bundler mode)
- ESLint config: `eslint.config.js` - Flat config format with React and TypeScript support

## Platform Requirements

**Development:**
- Node.js with npm
- Modern terminal/IDE with TypeScript support
- Browser with ES2023 support

**Production:**
- Browser with ES2023 support
- Served as static files (SPA) - compatible with any static hosting
- No server-side runtime required

## Build & Run Commands

```bash
npm install          # Install dependencies
npm run dev         # Start development server
npm run build       # Build for production (tsc + vite)
npm run preview     # Preview production build locally
npm run lint        # Run ESLint checks
```

---

*Stack analysis: 2026-04-06*
