# 06-AUTH-REPRO-LOG

> **Diagnose-first gate (D-02).** Manual reproduction in the user's MAIN browser
> (the one where Discord login fails) against `https://polls.wtcsmapban.com/`,
> performed BEFORE any code change in Phase 6. Record outcome of each step inline.
>
> Each step is independent — if Step 0 resolves the symptom, you can stop and skip
> to the **Step 0-4 summary** section. Otherwise continue through Step 4.
>
> Strongest a-priori hypothesis (06-RESEARCH.md, Pitfall 4): the Supabase
> `sb-<project-ref>-code-verifier` localStorage key is being wiped between
> redirect-to-Discord and return-from-Discord, which would surface as a PKCE
> failure inside `handleAuthCallback`. Watch for this signal in Step 1 and Step 2.
>
> **Browser under test:**
> Perplexity Comet Stable Release

---

## Step 0 — Service worker / cache flush (P-04)

> Prepended before D-02 Step 1 because a stale service worker from a prior
> deploy could intercept fetches and explain the differential vs. incognito.
> There should be no SW registered today, but verify.

- **0a.** DevTools → Application → Service Workers. Listed for `polls.wtcsmapban.com`:
  _None_
  - Action taken: _nothing to unregister_
- **0b.** DevTools → Application → Storage → "Clear site data" with all checkboxes
  ticked (cache, service workers, cookies, localStorage, sessionStorage, IndexedDB).
  - Done? Y (cleared out site settings for just polls.wtcsmapban.com)
- **0c.** Hard reload (Cmd+Shift+R / Ctrl+Shift+R). Done? Y (implicit — 0d retried login after 0b cleared all site data)
- **0d.** Attempted Discord login.
  - **Outcome:** PASS
  - If FAIL: AuthErrorPage `?reason=` value: _(auth-failed | 2fa-required | not-in-server | other)_
  - Console errors observed: _(paste or "(none)")_

---

## Step 1 — Storage hygiene

- **1a.** DevTools → Application → Storage. Cleared cookies AND localStorage AND
  sessionStorage for BOTH:
  - `polls.wtcsmapban.com` — done? _(Y/N)_
  - Supabase project URL `https://<project-ref>.supabase.co` — done? _(Y/N)_
- **1b.** Reloaded, attempted Discord login.
  - **Outcome:** _(PASS / FAIL)_
  - AuthErrorPage `?reason=` value (if FAIL): _(...)_
  - Console errors observed: _(paste or "(none)")_
- **1c.** PKCE verifier check (Pitfall 4 signal): immediately AFTER clicking
  "Login with Discord" but BEFORE Discord redirects you back, did
  `localStorage.getItem('sb-<project-ref>-code-verifier')` exist?
  - _(Y / N / not checked)_
  - And after redirect-back: did the same key still exist?
  - _(Y / N / not checked)_

---

## Step 2 — Browser extensions

> Disable extensions ONE AT A TIME, with priority for privacy/cookie blockers.
> Retry login after each disable. Record outcome per extension.

| Extension | Version | Disabled? | Login outcome after disable |
|-----------|---------|-----------|------------------------------|
| _(e.g. uBlock Origin)_ | _(1.x)_ | _(Y/N)_ | _(PASS / FAIL / not retried)_ |
| _(Privacy Badger)_ | | | |
| _(Multi-Account Containers)_ | | | |
| _(Brave Shields, if applicable)_ | | | |
| _(other tracking/cookie blocker)_ | | | |

**Net result for Step 2:** _(PASS = some extension was the culprit, name it / FAIL = login still broken with all priority extensions disabled)_

---

## Step 3 — Third-party cookie setting

- **3a.** Current third-party cookie setting in the browser under test:
  _(e.g. Safari ITP "on", Firefox ETP "Strict", Chrome "Block third-party cookies", or "Allow all")_
- **3b.** If blocked: switched to "Allow" / "Block in incognito only" / equivalent
  permissive setting; retried login.
  - **Outcome:** _(PASS / FAIL / not applicable — already permissive)_

---

## Step 4 — Second profile

- **4a.** Created or used a second main-browser profile:
  _(Chrome profile name / Firefox container / Safari profile)_
- **4b.** Attempted Discord login from the second profile.
  - **Outcome:** _(PASS = profile-state corruption likely / FAIL = bug reproduces across profiles)_

---

## Step 0-4 summary

- **Did any step resolve the symptom?** **Y** — Step 0 (Clear site data + reload).
- **Which step + likely cause:** Step 0. Clearing site data for `polls.wtcsmapban.com`
  (cache + cookies + localStorage + sessionStorage + IndexedDB) restored a working
  Discord login flow on the next attempt. No service workers were registered, so the
  resolving factor was stale browser-side storage state — most likely an orphaned
  Supabase PKCE artifact (`sb-<project-ref>-code-verifier`) left over from a prior
  aborted or interrupted OAuth attempt (06-RESEARCH.md Pitfall 4 — strongest a-priori
  hypothesis). Without the ?debug=auth overlay against the failing state we cannot
  confirm the exact key, but the differential ("works after clear, fails before")
  matches that pattern and rules out: live Supabase backend issue, Discord-side
  outage, code defect introduced by recent deploys.
- **Disposition:** Environmental, not a code defect. Per success_criteria of this
  plan: "the diagnose-first work still ships (Sentry breadcrumbs are launch hygiene
  regardless), but code-level investigation can be scoped down." Tasks 2 and 3 of
  06-01 still execute (breadcrumbs + ?debug=auth overlay) so any future re-occurrence
  is observable in production. Task 4 records the environmental disposition and
  clears the activation key — no overlay capture step is required since the failing
  state is no longer reproducible on demand.
- **Steps 1-4 status:** Not run. Per the early-exit clause at the top of this log
  ("if Step 0 resolves the symptom, you can stop and skip to the Step 0-4 summary"),
  steps 1 through 4 were intentionally skipped once Step 0 PASSed.
- **Browser context:** Perplexity Comet Stable Release (Chromium-based; uses its
  own profile/storage namespace separate from a vanilla Chrome install). Worth
  flagging that this is a less-common browser surface; if the bug recurs in other
  Chromium browsers we'd want to revisit the hypothesis.

---

<!--
Do NOT delete the sections below — Task 4 will fill them in after the
?debug=auth overlay is captured against the failing browser.
-->

## Captured State

_(Filled in by Task 4 after the overlay is captured. Paste the six-section
overlay output here, with token values already truncated by the overlay.)_

## Root Cause + Fix  /  Root Cause: Environmental

_(Filled in by Task 4. Either:
- (a) "Code defect: <description>. Targeted fix landed in commit <hash> touching <files>."
- (b) "Environmental: <description>. No code-level fix required; instrumentation ships as launch hygiene per D-02.")_

## Activation Key Cleared

_(Filled in by Task 4 after diagnosis. Required acceptance criterion (T-06-19):
the user must run `localStorage.removeItem('wtcs_debug_auth')` in DevTools and
record the timestamp here so the overlay does not persist as an always-on
backdoor past Phase 6.)_

- Cleared at: _(YYYY-MM-DD HH:MM local time)_
- Verified via: `localStorage.getItem('wtcs_debug_auth')` returns `null` — _(Y/N)_
