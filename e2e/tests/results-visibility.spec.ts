import { test, expect, deletePollById } from '../fixtures/poll-fixture'
import { loginAs, getAdminClient } from '../helpers/auth'
import { fixtureUsers } from '../fixtures/test-users'

/**
 * Results-visibility roundtrip — admin hide/show + voter polling integration.
 *
 * Walks the hide/show feature end-to-end through REAL production UI surfaces:
 *   1. Admin creates a poll via the SuggestionForm UI (exercises the
 *      hide-results checkbox pass-through, validator, create-poll EF).
 *      Checkbox stays UNCHECKED at create — scope here is the hide/show
 *      roundtrip after a default-visible create.
 *   2. Voter votes by clicking a choice-button on the SuggestionCard
 *      (exercises submit-vote EF + useVoteSubmit hook).
 *   3. Admin flips the inline Switch on AdminSuggestionRow to hide
 *      (exercises the admin hide/show Switch + toggle-results-visibility EF).
 *   4. Voter polls every 8s (useVoteCounts cadence) and within ~12s sees
 *      the hidden Alert in place of <ResultBars>. The voter's-choice line
 *      lives inside the same alert wrapper so the user retains the context
 *      of their own response while the aggregate is hidden.
 *   5. Admin flips the Switch back to show.
 *   6. Voter polls — the hidden Alert disappears AND the visible-result
 *      UI returns. The post-unhide assertion targets ResultBars'
 *      role="meter" element — the documented stable marker that proves
 *      the visible-result UI rendered (not just that the alert vanished).
 *
 * Selectors copied verbatim from the canonical specs in this repo:
 *   - admin-create flow → e2e/tests/admin-create.spec.ts
 *   - voter-vote flow   → e2e/tests/browse-respond.spec.ts
 *
 * Poll-ID capture uses a service-role title SELECT against `polls`. The
 * title carries `Date.now()` so the SELECT is deterministic; the row was
 * still CREATED through the EF + form path. No service-role INSERTs are
 * issued in the happy-path body.
 *
 * Teardown uses the service-role `deletePollById` helper (FK cascade
 * wipes choices + votes). Acceptable for teardown only — see
 * e2e/fixtures/poll-fixture.ts.
 */
test('[@smoke] admin creates, voter votes, admin hide/show roundtrip end-to-end', async ({
  page,
  browser,
}) => {
  // `[E2E]` prefix scopes locators per the project's E2E-SCOPE-1 lint
  // convention. `Date.now()` keeps the title unique across runs so the
  // service-role title SELECT (poll-ID capture) is deterministic.
  const title = `[E2E] results-visibility ${Date.now()}`
  let createdPollId: string | undefined

  // Admin and voter live in separate browser contexts so each owns its
  // own localStorage session; `loginAs` writes via addInitScript on the
  // next navigation in that context.
  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()

  try {
    // ---- STEP 1: Admin creates the poll via SuggestionForm UI ----
    await loginAs(adminPage, fixtureUsers.adminUser.id)
    await adminPage.goto('/admin')

    // Primary Create trigger — stable testid (same as admin-create.spec.ts).
    await adminPage.getByTestId('admin-create-suggestion').click()

    await adminPage.getByLabel(/title/i).fill(title)

    // Yes/No preset auto-fills both choice rows; defaults for closes_at
    // (now + 7d), category_id (null), image_url (null) all pass the
    // validator. Hide-results checkbox is left UNCHECKED — the scope
    // here is the hide/show roundtrip after a default-visible create.
    await adminPage.getByRole('button', { name: /^Yes\/No$/ }).click()

    // Single submit button on SuggestionForm — stable testid.
    await adminPage.getByTestId('suggestion-form-submit').click()

    // Tightened post-submit URL guard: `/admin` or `/admin/suggestions`
    // exactly (optional trailing slash / query). A looser /\/admin/
    // regex would also match `/admin/suggestions/new`, hiding silent
    // submit failures.
    await expect(adminPage).toHaveURL(/\/admin(?:\/suggestions)?\/?(?:\?.*)?$/, {
      timeout: 10_000,
    })
    await expect(adminPage.getByText(title)).toBeVisible({ timeout: 10_000 })

    // ---- STEP 1a: Capture the new poll ID by title (deterministic) ----
    // Service-role SELECT is read-only and isolated to the row the admin
    // just created via the EF. Avoids a brittle DOM-based ID capture —
    // the AdminSuggestionRow renders one `visibility-switch-${pollId}`
    // testid per row, but selecting the right row by title via
    // Playwright's `has:` filter is unreliable across re-renders.
    const adminClient = getAdminClient()
    const { data: pollRow, error: lookupError } = await adminClient
      .from('polls')
      .select('id')
      .eq('title', title)
      .single()
    if (lookupError || !pollRow) {
      throw new Error(
        `Could not resolve created poll id by title: ${lookupError?.message ?? 'no row'}`,
      )
    }
    createdPollId = pollRow.id as string
    expect(createdPollId).toMatch(/^[0-9a-f-]{36}$/)

    // visibility-switch testid on the AdminSuggestionRow Switch — a
    // sanity-check that the row rendered and the testid template was
    // applied before STEP 3 toggles it.
    await expect(
      adminPage.getByTestId(`visibility-switch-${createdPollId}`),
    ).toBeVisible({ timeout: 10_000 })

    // ---- STEP 2: Voter votes via SuggestionCard choice-button ----
    await loginAs(page, fixtureUsers.memberUser.id)
    await page.goto('/topics')

    // E2E-SCOPE-1: filter the card by unique `[E2E]`-prefixed title.
    const voterCard = page
      .getByTestId('suggestion-card')
      .filter({ hasText: title })
      .first()
    await expect(voterCard).toBeVisible({ timeout: 10_000 })

    // The new poll is NOT pinned, so SuggestionCard renders collapsed
    // with the wrapper role=button + aria-expanded=false. Click the
    // collapsed trigger to expand. Resilience pattern copied verbatim
    // from browse-respond.spec.ts.
    // eslint-disable-next-line no-restricted-syntax -- DOM-scoped inside fixture card; at most one collapsed trigger exists when card is unpinned.
    const collapsedTrigger = voterCard.getByRole('button', { expanded: false }).first()
    // eslint-disable-next-line no-restricted-syntax -- DOM-scoped variable bound above; .count() probes presence of the at-most-one collapsed trigger.
    if (await collapsedTrigger.count()) {
      await collapsedTrigger.click()
    }

    // Stable `choice-button` testid — getByRole('button') would also
    // match the CollapsibleTrigger and pick the wrong element.
    // eslint-disable-next-line no-restricted-syntax -- DOM-scoped inside fixture card; .first() picks the first choice button.
    const firstChoice = voterCard.getByTestId('choice-button').first()
    await firstChoice.click()

    // Sanity: results are still VISIBLE (hide checkbox was unchecked at
    // create). The hidden-alert wrapper must NOT be on screen yet.
    await expect(
      page.getByTestId(`results-hidden-alert-${createdPollId}`),
    ).not.toBeVisible()

    // ---- STEP 3: Admin flips the inline Switch to HIDE ----
    const adminSwitch = adminPage.getByTestId(`visibility-switch-${createdPollId}`)
    await expect(adminSwitch).toBeVisible({ timeout: 10_000 })
    await adminSwitch.click()

    // ---- STEP 4: Voter side polls (8s cadence). Within ~12s the
    // hidden Alert appears in place of <ResultBars>. The voter's-choice
    // line lives inside the same wrapper so the user keeps the context
    // of their own response while the aggregate is hidden.
    await expect(
      page.getByTestId(`results-hidden-alert-${createdPollId}`),
    ).toBeVisible({ timeout: 12_000 })

    // Assert on the AlertTitle copy — the actual hide-state marker. The
    // "Your response" line also renders inside the visible-result branch
    // via ResultBars (highlights the voter's choice), so a future refactor
    // that moves that copy into ResultBars would silently satisfy a text
    // check on "Your response" even with the alert wrapper hidden.
    await expect(
      page.getByTestId(`results-hidden-alert-${createdPollId}`),
    ).toContainText('Results temporarily hidden by admin')

    // ---- STEP 5: Admin flips the inline Switch back to SHOW ----
    await adminSwitch.click()

    // ---- STEP 6: Voter polls — both checks fire ----
    // Assertion A: hidden Alert disappears.
    await expect(
      page.getByTestId(`results-hidden-alert-${createdPollId}`),
    ).not.toBeVisible({ timeout: 12_000 })

    // Assertion B (strong post-unhide check): the visible-result UI
    // returns. Targets ResultBars' role="meter" element — the documented
    // stable marker (browse-respond spec header notes this same primitive).
    // One vote was cast, so at least one meter renders inside the voter
    // card subtree. This proves the visible-result UI re-rendered — a
    // blank/error branch could satisfy assertion A alone, but only
    // ResultBars emits role="meter".
    // eslint-disable-next-line no-restricted-syntax -- DOM-scoped inside voterCard; .first() picks the first meter inside ResultBars.
    const firstMeter = voterCard.locator('[role="meter"]').first()
    await expect(firstMeter).toBeVisible({ timeout: 12_000 })
  } finally {
    // Always close the admin context and delete the created poll, even
    // if the spec body throws. Best-effort teardown — deletePollById
    // logs but does not rethrow so reporter shows the real failure.
    await adminContext.close()
    if (createdPollId) {
      await deletePollById(createdPollId)
    }
  }
})
