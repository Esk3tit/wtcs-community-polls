// DBHY-05 regression test — profile_self_update_allowed trigger gate.
//
// Proves the GUC-based gate works in both directions:
//   - Direct authenticated client UPDATEs to protected columns are rejected.
//   - The update_profile_after_auth RPC bypasses the gate (GUC is set inside
//     the RPC before the UPDATE, so the trigger takes the trusted path).
//   - The transaction-local GUC does not leak across HTTP requests / pooled
//     connections (GUC-leak guard, case f).
//
// This test is RED before supabase db push applies Migration 15 — the prior
// migration's gate was permanently false in SECURITY DEFINER context, so
// direct UPDATEs to protected columns were silently accepted. Full green
// requires Plan 03 (supabase db push).
//
// Why beforeEach (not beforeAll) for the reset: each case mutates or attempts
// to mutate the memberUser profile. A per-case reset guarantees the starting
// state is known regardless of execution order (is_admin=false after case b
// would otherwise bleed into case e's precondition).

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { mintClients, type IntegrationClients } from './helpers'
import { fixtureUsers } from '../fixtures/test-users'

describe('profile_self_update_allowed trigger gate (DBHY-05)', () => {
  let clients: IntegrationClients

  beforeAll(async () => {
    clients = await mintClients({ authAs: 'memberUser' })
  })

  // Re-baseline memberUser before every case so cases are order-independent.
  // serviceRole writes succeed on the GUC-gated path because the trigger's
  // protected-column branch only enforces against the authenticated direct-client
  // path — serviceRole bypasses RLS entirely, so it operates as the function
  // owner context where the GUC check does not apply.
  beforeEach(async () => {
    await clients.serviceRole
      .from('profiles')
      .update({
        is_admin: false,
        mfa_verified: true,
        guild_member: true,
        discord_username: 'PlaywrightMember',
      })
      .eq('id', fixtureUsers.memberUser.id)
  })

  afterAll(async () => {
    // Restore fixture profile to seed state so sibling suites see expected values.
    // is_admin:false is explicitly restored because case (b) attempted is_admin:true
    // and prior Migration 14 (broken gate) would have silently accepted it.
    await clients.serviceRole
      .from('profiles')
      .update({ is_admin: false, mfa_verified: true, guild_member: true })
      .eq('id', fixtureUsers.memberUser.id)
  })

  it('(a) direct authenticated UPDATE to mfa_verified is rejected by trigger', async () => {
    const { error } = await clients.authed
      .from('profiles')
      .update({ mfa_verified: false })
      .eq('id', fixtureUsers.memberUser.id)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/mfa_verified via client/i)
  })

  it('(b) direct authenticated UPDATE to is_admin is rejected by trigger', async () => {
    const { error } = await clients.authed
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', fixtureUsers.memberUser.id)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/is_admin via client/i)
  })

  it('(c) direct authenticated UPDATE to guild_member is rejected by trigger', async () => {
    const { error } = await clients.authed
      .from('profiles')
      .update({ guild_member: false })
      .eq('id', fixtureUsers.memberUser.id)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/guild_member via client/i)
  })

  it('(d) direct authenticated UPDATE to discord_username is allowed (non-protected column)', async () => {
    const { error } = await clients.authed
      .from('profiles')
      .update({ discord_username: 'RenamedMember' })
      .eq('id', fixtureUsers.memberUser.id)
    // Proves the gate does NOT block non-protected columns when the GUC is absent.
    // Guards against over-broad enforcement in the trigger.
    expect(error).toBeNull()
  })

  it('(e) update_profile_after_auth RPC succeeds via GUC bypass — ordered proof', async () => {
    // Step 1: Flip protected columns to a known-different state via serviceRole.
    // This ensures the subsequent RPC assertion cannot pass as a no-op write.
    await clients.serviceRole
      .from('profiles')
      .update({ mfa_verified: false, guild_member: false })
      .eq('id', fixtureUsers.memberUser.id)

    // Step 2: Read back and assert the flip actually applied (precondition holds).
    const { data: pre } = await clients.serviceRole
      .from('profiles')
      .select('mfa_verified, guild_member')
      .eq('id', fixtureUsers.memberUser.id)
      .single()
    expect(pre!.mfa_verified).toBe(false)
    expect(pre!.guild_member).toBe(false)

    // Step 3: Call the RPC via the authed client — must succeed.
    const { error } = await clients.authed.rpc('update_profile_after_auth', {
      p_mfa_verified: true,
      p_discord_username: 'PlaywrightMember',
      p_avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
      p_guild_member: true,
    })
    expect(error).toBeNull()

    // Step 4: Read back via serviceRole and assert protected columns were committed.
    // A no-op write (member already true) cannot satisfy this because step 1 set them false.
    const { data: post } = await clients.serviceRole
      .from('profiles')
      .select('mfa_verified, guild_member')
      .eq('id', fixtureUsers.memberUser.id)
      .single()
    expect(post!.mfa_verified).toBe(true)
    expect(post!.guild_member).toBe(true)
  })

  it('(f) GUC-leak guard: transaction-local GUC does not persist after RPC completes', async () => {
    // First ensure the RPC path works (sets up the GUC internally, then commits,
    // which auto-clears the transaction-local flag).
    await clients.authed.rpc('update_profile_after_auth', {
      p_mfa_verified: true,
      p_discord_username: 'PlaywrightMember',
      p_avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
      p_guild_member: true,
    })

    // Immediately after the RPC completes, attempt a direct UPDATE on the same
    // authed client. The GUC was set inside the RPC's transaction — it must have
    // auto-cleared on commit (is_local=true). The next request must be rejected,
    // proving the GUC did not leak across HTTP requests or pooled connections.
    const { error: leak } = await clients.authed
      .from('profiles')
      .update({ mfa_verified: false })
      .eq('id', fixtureUsers.memberUser.id)
    expect(leak).not.toBeNull()
    expect(leak!.message).toMatch(/mfa_verified via client/i)
  })
})
