/**
 * Regression guard for vite.config.ts `rolldownOptions.output.keepNames: true`.
 *
 * Without `keepNames: true`, the Oxc/Rolldown minifier mangles every function
 * name to a short glyph (e.g. `$M`), making Sentry stack frames unreadable in
 * production. This script asserts that each allowlisted component still appears
 * as a literal `function Name(` declaration in the built bundle — a pattern
 * that only survives when `keepNames` is active.
 *
 * Run after `npm run build`. Wired into CI by plan 15-03.
 * Requirements: OBSV-04. Allowlist decisions: D-05, D-06.
 */

import { readdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

// Names verified present as literal `function Name(` in dist/assets/*.js on the
// phase-15 branch build. Covers shell + auth + consent + smoke-debug paths so
// that a keepNames regression is caught regardless of which chunk is affected.
// AuthGate and App are excluded — they are arrow-function components and are not
// emitted as `function X(` declarations even with keepNames active.
const ALLOWLIST = [
  'RenderThrowSmoke',  // smoke/debug canary; verified in Phase 7 baseline
  'ConsentProvider',   // consent context provider; covers GDPR opt-in path
  'ConsentBanner',     // consent UI; covers consent render path
  'AdminGuard',        // admin auth boundary
  'AuthProvider',      // auth shell wrapping the app
  'RootLayout',        // top-level app shell layout
  'AppErrorFallback',  // React error boundary; covers crash-handling path
];

const DIST_ASSETS = 'dist/assets';

// Probe for dist/assets/ before doing any work. Absence means the developer
// skipped `npm run build` — give an actionable error rather than a confusing
// "0 files" pass.
try {
  await access(DIST_ASSETS);
} catch {
  console.error(
    '[verify-sourcemap-names] ERROR: dist/assets/ not found.\n' +
    'Run `npm run build` first, then re-run this script.'
  );
  process.exit(1);
}

// `recursive: true` walks nested subdirs (e.g. `dist/assets/vendor/*.js`) so a
// future Rollup/Vite chunking change can't silently shrink coverage to top-level
// chunks only. Returns paths relative to DIST_ASSETS.
const entries = await readdir(DIST_ASSETS, { recursive: true });
const jsFiles = entries.filter((e) => e.endsWith('.js'));

const contents = await Promise.all(
  jsFiles.map((f) => readFile(join(DIST_ASSETS, f), 'utf8'))
);
const combined = contents.join('\n');

const missing = ALLOWLIST.filter((name) => {
  // Produces: /\bfunction ConsentProvider\b/ (example for first name)
  const re = new RegExp(`\\bfunction ${name}\\b`);
  return !re.test(combined);
});

if (missing.length > 0) {
  console.error(
    `[verify-sourcemap-names] FAIL: ${missing.length} name(s) missing from dist/assets/*.js\n` +
    missing.map((n) => `  - ${n}`).join('\n') + '\n' +
    'This means vite.config.ts rolldownOptions.output.keepNames may have regressed. ' +
    'Restore the flag or update the allowlist if a name was renamed in source.'
  );
  process.exit(1);
}

console.log(
  `[verify-sourcemap-names] OK: ${jsFiles.length} chunk(s) scanned, ` +
  `${ALLOWLIST.length}/${ALLOWLIST.length} allowlisted names found — keepNames contract holds.`
);
