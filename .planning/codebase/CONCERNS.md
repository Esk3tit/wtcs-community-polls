# Codebase Concerns

**Analysis Date:** 2026-04-06

## Tech Debt

**Boilerplate and Placeholder Code:**
- Issue: Entire application consists of Vite + React template scaffolding with no production-ready functionality. The project is named "wtcs-community-polls" but contains only a generic counter example and links to Vite/React documentation.
- Files: `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/App.css`
- Impact: Application cannot fulfill its stated purpose (community polls system). Currently serves no business value beyond a development template.
- Fix approach: Replace App.tsx with actual polls UI, implement polls service layer, add data persistence, and remove all template content.

**Accessibility and SEO Issues:**
- Issue: Multiple images lack descriptive alt text - empty alt attributes (`alt=""`) on hero images and logo images render them inaccessible to screen readers
- Files: `src/App.tsx` lines 14, 44, 50, 65-70, 77-84, 89-96, 101-108
- Impact: Fails WCAG 2.1 Level A compliance. Users with visual impairments cannot understand context of hero section, framework logos, and social media icons. Search engines cannot index page content properly.
- Fix approach: Add meaningful alt text to all images: describe content (e.g., "WTCS community logo", "React framework icon"), not generic terms. Use aria-hidden on decorative SVG icons more consistently.

**Unused Imports and Dead Code:**
- Issue: CSS uses CSS nesting syntax (lines 10-56 in App.css) which is not yet widely supported across browsers without transpilation. Template imports React logos and Vite assets that don't relate to actual application domain.
- Files: `src/App.tsx` lines 2-4, `src/App.css` entire file
- Impact: Unused imagery and styles increase bundle size. CSS nesting compatibility uncertain - may break in older browsers. Confuses developers about actual application purpose.
- Fix approach: Remove Vite/React template images and styling. Add domain-appropriate CSS and assets for polls UI.

## Missing Critical Features

**No Testing Infrastructure:**
- Problem: Zero test files exist in codebase. No unit tests, integration tests, or E2E tests despite TypeScript configuration supporting type safety.
- Files: None present
- Blocks: Cannot validate polls functionality, user interactions, or data persistence without tests. High risk for regressions in production.
- Priority: High

**No State Management or Data Persistence:**
- Problem: Application only manages local React component state (counter). No data layer, API integration, or persistence mechanism exists for polls data.
- Files: `src/App.tsx` lines 8 - only useState for counter
- Blocks: Cannot store poll questions, track votes, or retrieve results. Entire application feature set blocked.
- Priority: Critical

**No Environment Configuration:**
- Problem: No .env support, no config management, no ability to specify API endpoints, database connections, or feature flags.
- Files: Missing - no .env.example or env configuration documented
- Blocks: Cannot configure for different environments (dev/staging/prod). Secrets management impossible.
- Priority: High

**No Error Handling or Validation:**
- Problem: No error boundaries, no form validation, no API error handling patterns established.
- Files: Entire codebase
- Blocks: User-facing errors will crash application. Invalid poll submissions will be undetected.
- Priority: High

## Security Considerations

**No Input Validation:**
- Risk: Application will eventually accept user poll submissions. Without validation framework in place, vulnerable to injection attacks, malformed data, and abuse.
- Files: Not yet implemented - `src/App.tsx` will need forms
- Current mitigation: None
- Recommendations: Implement validation library (zod, valibot) before adding form inputs. Validate on client and server. Sanitize any rendered user content.

**No CSRF Protection:**
- Risk: When polls API is added, POST requests for voting will be unprotected against Cross-Site Request Forgery attacks.
- Files: Not yet implemented
- Current mitigation: None (problem deferred)
- Recommendations: Implement CSRF token validation in API layer. Use SameSite cookie attributes when session cookies added.

**External Links Without Rel Attributes:**
- Risk: Links to external sites (GitHub, Discord, X.com, Bluesky) in src/App.tsx lack rel="noopener noreferrer" attributes. Could allow opened external pages to access window.opener and manipulate parent.
- Files: `src/App.tsx` lines 43, 49, 64, 76, 88, 100
- Current mitigation: None
- Recommendations: Add rel="noopener noreferrer" to all target="_blank" links.

**No Rate Limiting or Abuse Prevention:**
- Risk: Once voting endpoints exist, users could spam votes without limit. No bot detection or rate limiting mentioned.
- Files: Not yet implemented
- Current mitigation: None
- Recommendations: Plan API rate limiting strategy. Consider implementing CAPTCHA or proof-of-work for poll participation.

## Fragile Areas

**React Strict Mode Configuration:**
- Files: `src/main.tsx` lines 6-9
- Why fragile: StrictMode is enabled which causes components to render twice during development. This helps catch side effects but masks real issues if not properly handled. Once real data fetching and state management added, this could expose race conditions.
- Safe modification: Keep StrictMode enabled - it's beneficial for catching issues early. Ensure any useEffect cleanup functions are properly implemented.
- Test coverage: No tests exist to validate component behavior under StrictMode.

**TypeScript Configuration Strict Mode:**
- Files: `tsconfig.app.json` lines 19-21
- Why fragile: Configuration enables `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` which are strict but helpful. However, current boilerplate code passes only because there's minimal logic. As actual business logic is added, tight coupling between unused variable detection and actual code may cause conflicts during rapid development.
- Safe modification: Keep strict settings but plan to organize code early (avoid large functions with many unused parameters). Use `_paramName` pattern for intentionally unused parameters.
- Test coverage: No tests to catch regressions.

## Performance Bottlenecks

**Inline Styles and CSS-in-JS Overhead:**
- Problem: App.css contains 184 lines of styling with complex transforms and animations (perspective 3D transforms on hero images). Hero image animations use CSS transforms with perspective which are performant, but no lazy loading of images.
- Files: `src/App.tsx` lines 14, 44, 50 (img tags), `src/App.css` lines 45-56
- Cause: Default Vite template loads all images eagerly. 3D transforms are GPU-accelerated so acceptable, but SVG icon loading pattern is unclear (uses icon sprite at /icons.svg which may or may not exist).
- Improvement path: Add img loading="lazy" attributes. Verify icon sprite serves correctly. Remove unused hero animations once real UI is implemented.

**No Code Splitting or Route-based Bundling:**
- Problem: Single-page application with all code bundled together. No evidence of async code splitting for future features.
- Files: `src/main.tsx` loads entire App
- Cause: Application is simple enough to not need splitting yet, but architectural pattern not established.
- Improvement path: Plan route-based code splitting once multiple polls pages/views exist. Consider React Router with lazy components.

## Dependencies at Risk

**ESLint and TypeScript Version Misalignment:**
- Risk: `eslint@9.39.4` (latest major 9) while TypeScript is `~6.0.2` (targeting 6.0.x). TypeScript 6.0 was released April 2024. This version pinning is very restrictive (tilde allows only patch updates). When TypeScript 6.1 or 7.0 releases, need to manually update rather than automatic minor updates.
- Impact: Eslint 10.0.1 available but not used. May miss critical bug fixes or security patches if locked too long.
- Migration plan: Change TypeScript dependency to `^6.0.2` to allow minor version updates. Monitor ESLint 10.x release notes before updating.

**React Version 19.2.4:**
- Risk: React 19.x is recent (2024). Using pre-1.0 version pattern (19.x instead of semantic versioning) means API could change in minor versions. No React Query or state management library yet - using bare React hooks will become bottleneck as app scales.
- Impact: As application grows to handle many polls, voting state, and real-time updates, React 19 hooks alone insufficient. Refactoring to add state management later will be expensive.
- Migration plan: Plan to add Jotai or Zustand for state management before adding 5+ pages. Consider React Query for server state before adding API polling.

**Vite 8.0.5 Pinned:**
- Risk: Vite 8.0.4 specified but ^8.0.4 allows any 8.x version. Latest Vite is now in 5.x range (current: 5.x+). Using Vite 8.0.5 means missing major performance improvements and features in Vite 5+.
- Impact: Slower development experience, missed dependency optimizations. May become problematic when deploying to newer Node.js versions.
- Migration plan: Test with Vite 5.x major upgrade soon. Node.js 18+ recommended by Vite 5. Verify build artifacts size before committing.

**Missing Testing Dependencies:**
- Risk: No test runner installed (Vitest, Jest). No assertion library (Chai, Expect). Must add before writing tests, which will add more dependencies.
- Impact: Difficult to retroactively add testing - must interrupt development to set up test infrastructure.
- Migration plan: Set up Vitest + React Testing Library ASAP before adding business logic.

## Scaling Limits

**No API Layer Architecture:**
- Current capacity: Development-only, local state only
- Limit: Cannot scale beyond single browser session. Zero data persistence. No multi-user support possible.
- Scaling path: Design API contract (REST endpoints for GET /polls, POST /polls/:id/votes). Implement backend (Node.js + Express recommended to match JS stack). Add fetch/axios client layer. Plan database schema.

**No Database Design:**
- Current capacity: React state only
- Limit: No data survives page reload. Single user only.
- Scaling path: Design polls schema (id, question, createdBy, createdAt, options[], votes[]). Choose database (PostgreSQL recommended for reliability, or MongoDB for quick iteration). Add ORM/client (Prisma or Drizzle).

**No Real-time Synchronization:**
- Current capacity: Zero
- Limit: Users cannot see live vote counts. No polling or WebSocket infrastructure.
- Scaling path: Once >10 concurrent users expected, add WebSocket layer (Socket.io or ws library) or server-sent events (SSE) for vote count updates.

## Test Coverage Gaps

**No Component Testing:**
- What's not tested: App component rendering, button click handling, SVG icon loading, responsive layout at breakpoints
- Files: `src/App.tsx` entirely untested
- Risk: Button click handler at line 26 could be broken and undetected. HTML structure changes could break in production.
- Priority: High - add tests before adding any new components

**No Hook Testing:**
- What's not tested: React hooks usage (useState for counter), Hook Dependency Arrays (if used in future)
- Files: `src/App.tsx` lines 8
- Risk: useState hook would be covered by component tests, but if custom hooks added, no framework to test them
- Priority: High

**No CSS Regression Testing:**
- What's not tested: Responsive styles, CSS nesting feature support, animation smoothness
- Files: `src/App.css` entirely uncovered
- Risk: Browser-specific CSS bugs won't be caught until production. CSS nesting may fail in older browsers.
- Priority: Medium - consider visual regression testing with Playwright or Percy before major layout changes

**No Integration Testing:**
- What's not tested: Form submission (when added), API interaction (when added), state updates across components
- Files: Not applicable yet - no forms or API
- Risk: Once polls form is added, cannot test complete user flow without integration tests
- Priority: High - set up integration testing framework before adding forms

**No E2E Testing:**
- What's not tested: Complete user journey (view polls, vote, see results)
- Files: Not applicable yet
- Risk: UI regressions in production. Cannot test across real browsers automatically.
- Priority: Medium - consider Playwright E2E tests for critical voting flow once feature complete

---

*Concerns audit: 2026-04-06*
