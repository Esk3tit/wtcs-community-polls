# 05-09 — README Screenshots

## What was built

4 production screenshots committed to `docs/screenshots/`, captured live from `polls.wtcsmapban.com` via Playwright MCP (user signed in as admin; Claude drove navigation + captures).

## Files

| File | Size | Viewport | Content |
|------|------|----------|---------|
| `docs/screenshots/topics-list.png` | ~75 KB | 1440×900 | Active Topics hero — pinned Sinai card + below-fold previews, category tabs, search |
| `docs/screenshots/suggestion-with-results.png` | ~35 KB | element crop | Expanded Sinai card showing result bars, percentages + counts, response footer |
| `docs/screenshots/admin-shell.png` | ~58 KB | 1440×900 | `/admin` Suggestions tab with Active/Closed/All filters + Create CTA + 6 suggestion rows |
| `docs/screenshots/mobile-view.png` | ~52 KB | 390×844 (iPhone 14 Pro) | Topics list on mobile — hamburger nav, stacked category chips, pinned Sinai expanded |

Total: 224 KB (well under any reasonable README budget).

## Acceptance criteria

| Must-have | Status |
|-----------|--------|
| `docs/screenshots/` directory exists with ≥4 PNGs | ✓ |
| Real prod captures (not mocks / placeholders) | ✓ — live from polls.wtcsmapban.com |
| Filenames match README template (topics-list / suggestion-with-results / admin-shell / mobile-view) | ✓ |

## Notes

- Captured in a single session by Claude via `mcp__plugin_compound-engineering_pw__browser_*` tools after the user signed in with Discord inside the Playwright Chromium window.
- Re-captures are trivial: run Playwright MCP, repeat the 4-step flow (topics, focused card element, /admin, resize + /topics).
- `.playwright-mcp/` artifacts (accessibility snapshots) are NOT committed.
