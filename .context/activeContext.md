# Active Context - Tocket

<!-- Updated by both Architect and Executor after each session -->

## Current Focus

**Open-source preparation.** Linked tocket.ai across all docs, expanded CONTRIBUTING.md for external PRs, added GitHub issue templates, cleaned up repo. CLI at v2.2.2 (149 tests, 44 suites). Site live at tocket.ai.

## Recent Changes

| Date       | Change                                                           | Agent             |
| ---------- | ---------------------------------------------------------------- | ----------------- |
| 2026-02-25 | Implemented global templates (~/.tocket/templates)               | Claude (Executor) |
| 2026-02-25 | Open-source prep: tocket.ai links, CONTRIBUTING, issue templates | Claude (Executor) |
| 2026-02-25 | tocket-site v1.0: premium landing page, star particles, deploy   | Claude (Executor) |
| 2026-02-25 | v2.2.2: session debt cleanup, shared utils, 149 tests            | Claude (Executor) |
| 2026-02-25 | v2.2.1: gitignore check on init, c8 coverage, 138 tests          | Claude (Executor) |
| 2026-02-25 | v2.2: doctor, lint, minimal init, non-interactive flags, tests   | Claude (Executor) |
| 2026-02-25 | Docs: File convention and zero-runtime pollution pivot           | Claude (Executor) |
| 2026-02-25 | v2.1: focus, eject, status, dashboard, 84 tests, tagged+pushed   | Claude (Executor) |
| 2026-02-24 | v2.0: theme, dashboard, config, smart generate, 67 tests         | Claude (Executor) |
| 2026-02-24 | --force flag, version dedupe, CI tests, doc updates, examples    | Claude (Executor) |
| 2026-02-24 | Smart Init: auto-detect stack, .cursorrules, 38 tests, v1.2.0    | Claude (Executor) |
| 2026-02-24 | Test suite (29 tests, node:test), version 1.1.0, release prep    | Claude (Executor) |
| 2026-02-24 | Full init scaffold (8 files), generate v2.0, validate command    | Claude (Executor) |
| 2026-02-24 | README rewrite, docs/ directory (3 guides), protocol evaluation  | Claude (Executor) |
| 2026-02-24 | TOCKET.md protocol spec + template in init command               | Claude (Executor) |
| 2026-02-24 | Memory Bank + CLAUDE.md + GEMINI.md initialized                  | Claude (Executor) |
| 2026-02-24 | CI, CONTRIBUTING, CODE_OF_CONDUCT, PR template                   | Claude (Executor) |
| 2026-02-24 | Initial CLI with init, generate, sync commands                   | Pedro (Manual)    |

## Open Decisions

- ~~Add `tocket doctor` for deeper diagnostics~~ **Done**
- ~~Investigate `tocket generate` automatically reading the last commit for context~~ **Done**
- How to propagate `tocket lint` warnings to the Agent's system prompt dynamically? (deferred)
- ~~Custom domain for tocket-site (tocket.ai)~~ **Done — live at tocket.ai**
- OG image generation for social sharing — not yet created

## Session Debt (Identified by Self-Improve)

All CLI items resolved in v2.2.2. No remaining debt.

### tocket-site potential improvements

- OG image (`/public/og-image.png`) for Twitter/LinkedIn previews
- Mobile particle count reduction (currently same as desktop)
- Add `npm run test` with Vitest if site grows beyond single page
- Consider custom domain setup on Vercel
