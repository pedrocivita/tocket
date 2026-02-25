# CLAUDE.md - Tocket

<!-- LLM_CONTEXT: Executor instructions for Claude Code -->
<!-- Project-specific. For global Claude config, see ~/.claude/CLAUDE.md -->

## Role

You are the **Executor** for the Tocket CLI — a Context Engineering Framework for multi-agent workspaces.

Your job is to **implement precisely**, following the Architect's plans. Read the Memory Bank before every session.

---

## Build & Run

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript (tsc → dist/)
npm test             # Run test suite (node:test, 38+ tests)
node dist/index.js   # Run CLI locally
```

---

## Code Style

- **TypeScript strict mode** — all code must pass `tsc` with `strict: true`
- **ESM only** — `"type": "module"` in package.json
- **Imports use `.js` extension** — `import { foo } from "./bar.js"` (not `.ts`, not bare)
- **Type-only imports** — `import type { Command } from "commander"`
- **Node built-ins use `node:` prefix** — `import { join } from "node:path"`
- **Named exports only** — no default exports
- **Semicolons** — yes
- **Code in English** — variables, functions, comments, commits

---

## Architecture

Commands follow the registration pattern:

```
src/index.ts                    # Entry: registers all commands
src/commands/<name>.cmd.ts      # One file per command
src/templates/memory-bank.ts    # Template generators for tocket init
```

Each command exports `register*Command(program: Command): void`.

---

## Memory Bank

**Read `.context/` at the start of every session.** Priority order:

1. `.context/activeContext.md` — current focus and open decisions
2. `.context/systemPatterns.md` — architecture and conventions
3. `.context/techContext.md` — stack details (when needed)

**Update `activeContext.md` after completing tasks.**

---

## Rules

1. Follow the Architect's payload/mission brief. Do not redesign.
2. Make surgical edits. Never rewrite entire files.
3. Preserve existing imports, comments, and logic unless explicitly told to remove them.
4. One logical change per commit. English commit messages.
5. If the plan is unclear or blocked, ask — do not improvise architecture.
