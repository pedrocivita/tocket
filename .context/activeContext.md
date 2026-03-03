# Active Context - Tocket

<!-- Updated by both Architect and Executor after each session -->

## Current Focus

**v2.5.0 releasing.** Two new commands: `tocket diff` (payload vs git changes verification) and `tocket handoff` (clipboard-ready context summary). New XML parser utility. Generate now persists payload to `.tocket/last-payload.xml`. Doctor checks last payload staleness. 248 tests, 60 suites.

## Recent Changes

| Date       | Change                                                           | Agent             |
| ---------- | ---------------------------------------------------------------- | ----------------- |
| 2026-03-02 | v2.5.0: tocket diff, tocket handoff, XML parser, payload persist | Claude (Executor) |
| 2026-02-26 | v2.4.0: configurable agent roles, smart file mapping, TUI revamp | Claude (Executor) |
| 2026-02-25 | v2.3.0: global templates, OG image, npm publish                  | Claude (Executor) |
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
- ~~OG image generation for social sharing~~ **Done — public/og-image.png on tocket-site**
- ~~npm publish v2.4.0 pending~~ **Superseded by v2.5.0**
- Consider `tocket run` (automated payload execution) for v3.0
- Consider `tocket split` (swarm mode / multi-teammate payloads) for v3.0

## Session Debt (Identified by Self-Improve)

All CLI items resolved in v2.2.2. No remaining debt.

### tocket-site potential improvements

- Mobile particle count reduction (currently same as desktop)
- Add `npm run test` with Vitest if site grows beyond single page
