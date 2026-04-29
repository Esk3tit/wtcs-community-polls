# Feature Landscape

**Domain:** Community polling/voting platform (esports governance)
**Researched:** 2026-04-06

## Table Stakes

Features users expect. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Authenticated voting (one account = one vote) | Core integrity requirement. StrawPoll-style IP-only checks are trivially bypassed with proxies/VPNs. Discord OAuth + DB unique constraint is the correct approach. | Medium | Already planned. Discord OAuth + UNIQUE constraint on (user_id, poll_id). |
| Multiple choice options per poll | Every polling tool supports this. Discord native supports up to 10. | Low | Already planned. N configurable choices. No practical upper limit needed beyond ~20. |
| Poll timer with auto-close | Discord native, EasyPoll, PollBotPlus all have timed polls. Users expect polls to end. | Low | Already planned. 7d, 14d, custom. |
| Results display (percentages + counts) | Every platform shows results. Raw counts + percentages are baseline. | Low | Already planned. Show after user votes. |
| Mobile-responsive design | 60-70% of Discord users are on mobile. Community members will tap links from Discord on their phones. | Medium | Already planned. Mobile breakpoint at 1024px. |
| Admin-only poll creation | Must prevent random users from creating polls. Discord native had this gap initially (anyone with send permissions could create polls). | Low | Already planned. Discord-native admin model. |
| Poll listing and browsing | Users need to find polls. A feed/list view is the minimum. | Low | Implicit in the design. Main landing page. |
| Dark mode | Discord users live in dark mode. A bright white polling site would feel jarring. | Low | Already planned via CSS custom properties. |

## Differentiators

Features that set this platform apart from Discord native polls and StrawPoll-style tools. Not expected, but create real value for an esports governance use case.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Discord server membership verification | Ensures only actual WTCS community members vote, not brigaded outsiders. Discord native polls can't restrict by server membership from an external site. This is the single strongest anti-manipulation feature. | Medium | Already planned. Check membership in official WT esports Discord server via API. |
| 2FA enforcement | Rejects throwaway/bot Discord accounts. Dramatically raises the cost of vote manipulation since 2FA requires a phone number or authenticator app. No polling bot does this. | Low | Already planned. Check `mfa_enabled` flag from Discord OAuth. |
| Account age check | Prevents freshly created sockpuppet accounts. 30-day minimum is reasonable. | Low | Already planned. Check account creation date from Discord user object. |
| Vote-then-reveal results | Prevents bandwagon voting and strategic voting. Users must commit before seeing where things stand. PollBotPlus offers "hide results" but most tools don't. Critical for governance integrity. | Medium | Already planned. Results hidden until user has voted. |
| Results restricted to voters only | Encourages participation rather than lurking. Creates social pressure to engage. Unique differentiator -- almost no platform does this. | Medium | Already planned. Even after poll closes, only voters see results. |
| Admin-created categories with filtering | Organizes polls by topic (e.g., "Lineup Changes", "Rule Proposals", "Map Pool"). Discord native polls have no categorization. | Medium | Already planned. Dynamic categories with tabs/pills + search. |
| Poll archive with status tracking | Closed polls show outcome: Rejected / Processing / Implemented. This closes the feedback loop -- community sees their votes matter. No Discord bot provides this. | Medium | Already planned. Public archive with status labels. |
| Pinned/highlighted polls | Surfaces urgent or important votes above the noise. Simple but effective admin tool. | Low | Already planned. Pin flag on polls. |
| Poll images | Visual context for proposals (e.g., showing the vehicle being discussed, a map screenshot). Discord native polls are text-only. | Low | Already planned. Admin upload or external URL. |
| Server-side vote validation | Edge Functions validate votes server-side, preventing client-side manipulation. Most lightweight polling tools validate client-side only. | Medium | Already planned. Supabase Edge Functions. |
| Pre-aggregated vote counts | Postgres trigger maintains a `vote_counts` table, avoiding COUNT(*) on every poll request. Keeps polling fast even as vote tables grow. | Medium | Already planned. Postgres trigger approach. |

## Anti-Features

Features to explicitly NOT build. These are tempting but wrong for this use case.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Anonymous voting | Destroys accountability. Esports governance requires knowing that real, verified community members cast votes. Anonymous voting enables manipulation and undermines trust. | Keep Discord identity tied to every vote. Show vote counts, not individual votes. Privacy comes from not exposing WHO voted for WHAT, not from hiding identity entirely. |
| Multiple OAuth providers (Google, GitHub, etc.) | Fragments identity. The community lives on Discord. Adding other providers creates loopholes for duplicate voting across providers and adds complexity with zero benefit. | Discord OAuth only. Period. |
| Ranked-choice or approval voting | Over-engineered for the use case. WTCS polls are simple proposals: "Should we do X? Yes/No" or "Pick one of these options." RCV adds cognitive load and implementation complexity. | Simple single-choice voting. If a poll needs nuance, create separate polls. |
| User-created polls | Opens the door to spam, troll polls, and dilution of legitimate governance. The admin model is intentional -- only trusted community leaders create polls. | Admin-only creation. Community members suggest polls via Discord channels, admins curate. |
| Comments/discussion on polls | Discussion belongs in Discord where the community already lives. Building a parallel discussion system splits conversation and adds moderation burden. | Link polls back to Discord discussion threads. Polls are for voting, Discord is for discussing. |
| Real-time WebSockets | Supabase Realtime adds complexity and potential free-tier cost. With 20-30 concurrent users, HTTP polling every 5-10 seconds is indistinguishable from real-time. | HTTP polling at 5-10 second intervals. Simple, sufficient, free. |
| Detailed analytics dashboard | Vanity metrics for admins. At this community size (300-400 voters/week), admins can eyeball results. Building charts and trend analysis is wasted effort. | Show vote counts and percentages. Defer analytics to v2 only if admins actually request it. |
| Email notifications | The community does not use email for coordination. They use Discord. Email notifications would go unread and add SMTP infrastructure complexity. | Discord webhook notifications in v2 if needed. Not email. |
| Weighted voting | Some governance platforms weight votes by stake or role. This creates perceived unfairness and political drama in a gaming community. One person, one vote. | Equal votes for all verified community members. |
| Blockchain/Web3 voting | Trendy but absurd for a 300-person esports community. Adds massive complexity for zero practical benefit. A Postgres UNIQUE constraint is all the "immutability" needed. | Supabase PostgreSQL with proper constraints and RLS. |
| Poll editing after votes are cast | Changing poll options after people have voted invalidates those votes and destroys trust. | If a poll has errors, close it and create a new one. Allow editing only before the first vote. |
| Voter list visibility | Showing who voted for what option creates social pressure, bullying, and vote-buying in a competitive gaming community. | Show aggregate results only. Individual votes are private (stored in DB for integrity but never exposed via API). |

## Feature Dependencies

```
Discord OAuth ──> 2FA Check ──> Account Age Check ──> Server Membership Check
     │
     └──> Admin Role Check ──> Poll Creation ──> Category Assignment
                                    │                    │
                                    ├── Poll Timer       │
                                    ├── Poll Image       │
                                    └── Pin/Highlight    │
                                                         │
Vote Casting ──> Vote-then-Reveal ──> Results Display <──┘
     │                                      │
     └── Server-side Validation             └── Archive + Status Tracking
              │
              └── Rate Limiting (Upstash Redis)
```

Key dependency chains:
- **Auth chain:** Discord OAuth must work before any voting or admin features. 2FA/age/membership checks layer on top.
- **Poll lifecycle:** Creation -> Active (voting) -> Closed -> Archived with status. Each state has different rules.
- **Vote integrity:** Server-side validation must be in place before voting goes live. Cannot bolt on later.

## MVP Recommendation

Prioritize for launch (Phase 1-2):

1. **Discord OAuth with 2FA + account age checks** -- Foundation. Nothing works without auth.
2. **Admin model (seed + promote)** -- Must exist before poll creation.
3. **Poll CRUD with timer and auto-close** -- Core functionality.
4. **Single-choice voting with one-vote-per-user** -- The whole point.
5. **Vote-then-reveal results** -- Key differentiator, low marginal cost to build during initial results implementation.
6. **Basic poll listing with categories** -- Users need to find and browse polls.
7. **Server membership verification** -- Critical integrity feature. Build into auth flow from day one.

Defer to post-launch:
- **Poll images:** Nice-to-have, not blocking. Text polls work fine initially.
- **Poll archive with status tracking:** Can launch with just "open" and "closed" states. Add Rejected/Processing/Implemented labels in a fast follow.
- **Pin/highlight:** Simple DB flag, easy to add later.
- **Search:** Not needed until there are enough polls to lose track of them (50+).
- **Discord webhook notifications:** Explicitly out of scope for v1 per PROJECT.md.

## Sources

- [Discord Polls FAQ](https://support.discord.com/hc/en-us/articles/22163184112407-Polls-FAQ) -- Discord native poll limitations (10 options, 14 day max, no role restriction)
- [EasyPoll vs Discord Native](https://easypoll.bot/vs-discord-polls) -- Feature comparison showing gaps in native polls
- [PollBotPlus](https://pollbotplus.com/) -- Hidden results, anonymous voting, timed polls feature set
- [Intigriti: Hackers' Guide to Online Voting](https://www.intigriti.com/blog/news/a-hackers-guide-to-online-voting-systems) -- Vote manipulation techniques and prevention
- [StrawPoll manipulation analysis](https://technofaq.org/posts/2019/09/how-straw-poll-votes-can-be-manipulated/) -- Why IP-only protection is insufficient
- [Capterra Voting Software 2026](https://www.capterra.com/voting-software/) -- Market landscape overview
- [Polling.com Free Tools Comparison](https://blog.polling.com/free-polling-tools-which-one-is-right-for-you/) -- Feature comparison across free polling tools
