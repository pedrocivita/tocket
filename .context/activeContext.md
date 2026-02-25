# Active Context - Tocket

<!-- Updated by both Architect and Executor after each session -->

## Current Focus

**v2.1.0 — Focus & Eject Commands.** Added `tocket focus` for quick activeContext updates and `tocket eject` for clean workspace removal. Dashboard menu expanded with both new commands. Tests added for both.

## Recent Changes

| Date       | Change                                                          | Agent             |
| ---------- | --------------------------------------------------------------- | ----------------- |
| 2026-02-25 | v2.1: focus, eject, dashboard integration, 81 tests             | Claude (Executor) |
| 2026-02-24 | v2.0: theme, dashboard, config, smart generate, 67 tests        | Claude (Executor) |
| 2026-02-24 | --force flag, version dedupe, CI tests, doc updates, examples   | Claude (Executor) |
| 2026-02-24 | Smart Init: auto-detect stack, .cursorrules, 38 tests, v1.2.0   | Claude (Executor) |
| 2026-02-24 | Test suite (29 tests, node:test), version 1.1.0, release prep   | Claude (Executor) |
| 2026-02-24 | Full init scaffold (8 files), generate v2.0, validate command   | Claude (Executor) |
| 2026-02-24 | README rewrite, docs/ directory (3 guides), protocol evaluation | Claude (Executor) |
| 2026-02-24 | TOCKET.md protocol spec + template in init command              | Claude (Executor) |
| 2026-02-24 | Memory Bank + CLAUDE.md + GEMINI.md initialized                 | Claude (Executor) |
| 2026-02-24 | CI, CONTRIBUTING, CODE_OF_CONDUCT, PR template                  | Claude (Executor) |
| 2026-02-24 | Initial CLI with init, generate, sync commands                  | Pedro (Manual)    |

## Open Decisions

- ~~Add `tocket config` command~~ **Done** (TUI + non-interactive flags)
- ~~Auto-fill `<scope>` from git~~ **Done** (getStagedFiles + getModifiedFiles)
- ~~Add branded terminal theme~~ **Done** (chalk, static ASCII banner, no figlet)
- Should `tocket generate` automatically read the last commit for context in prompt generation? (deferred to v2.1)

## Session Debt (Identified by Self-Improve)

(None — all items resolved in this session)
