# Active Context - Tocket

<!-- Updated by both Architect and Executor after each session -->

## Current Focus

**v1.2.0 ready.** Smart Init shipped: auto-detects stack from `package.json`/`tsconfig.json`, pre-populates `techContext.md` with real data, generates `.cursorrules` for Cursor IDE. 38 tests passing (9 suites). Awaiting `npm publish` by Pedro.

## Recent Changes

| Date       | Change                                                          | Agent             |
| ---------- | --------------------------------------------------------------- | ----------------- |
| 2026-02-24 | Smart Init: auto-detect stack, .cursorrules, 38 tests, v1.2.0  | Claude (Executor) |
| 2026-02-24 | Test suite (29 tests, node:test), version 1.1.0, release prep  | Claude (Executor) |
| 2026-02-24 | Full init scaffold (8 files), generate v2.0, validate command   | Claude (Executor) |
| 2026-02-24 | README rewrite, docs/ directory (3 guides), protocol evaluation | Claude (Executor) |
| 2026-02-24 | TOCKET.md protocol spec + template in init command              | Claude (Executor) |
| 2026-02-24 | Memory Bank + CLAUDE.md + GEMINI.md initialized                 | Claude (Executor) |
| 2026-02-24 | CI, CONTRIBUTING, CODE_OF_CONDUCT, PR template                  | Claude (Executor) |
| 2026-02-24 | Initial CLI with init, generate, sync commands                  | Pedro (Manual)    |

## Open Decisions

- Add `--force` flag to `tocket init`?
- `examples/` directory with real payload exchange walkthrough?
- Expand CI to run `npm test` (currently only runs build)?
