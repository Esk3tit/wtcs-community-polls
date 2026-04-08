---
created: 2026-04-08T05:10:00Z
scope: phase-05
tags: [ux, performance, loading]
---

Add loading skeletons and/or prefetch-on-hover for navigation between Topics and Archive pages. First load is noticeably slow due to cold DB queries; subsequent loads are fast from cache. Consider skeleton placeholders for SuggestionList during initial data fetch, and prefetching data on link hover to make navigation feel instant.
