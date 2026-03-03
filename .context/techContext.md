# Tech Context - Tocket

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript 5.9 | `strict: true` |
| Runtime | Node.js 20+ | ESM (`"type": "module"`) |
| Build | `tsc` | Output to `dist/`, declarations enabled |
| CLI framework | Commander.js 14 | Subcommand registration pattern |
| Interactive prompts | @inquirer/prompts 8 | `input`, `select`, `number` |
| Clipboard | clipboardy 5 | For `generate` command output |
| Module system | ESM (Node16) | **All imports must use `.js` extension** |
| CI | GitHub Actions | Node 20, `npm ci` + `npm run build` |
| Package | `@pedrocivita/tocket` | Published to npm, `npx` executable |

## TypeScript Configuration

```json
{
  "target": "ES2022",
  "module": "Node16",
  "moduleResolution": "Node16",
  "strict": true,
  "declaration": true
}
```

## Critical Rules

1. **ESM imports require `.js` extension** — Even though source is `.ts`, compiled imports reference `.js` files. Example: `import { foo } from "./bar.js"` (not `./bar` or `./bar.ts`).

2. **Type-only imports use `import type`** — Commander types are imported as `import type { Command } from "commander"`.

3. **No default exports** — All modules use named exports (`export function`, `export const`).

4. **Node built-ins use `node:` prefix** — `import { mkdir } from "node:fs/promises"`.

## Project Structure

```
tocket/
  src/
    index.ts              # CLI entry point (Commander setup)
    commands/
      init.cmd.ts         # tocket init — scaffold workspace
      generate.cmd.ts     # tocket generate — build payload XML
      sync.cmd.ts         # tocket sync — update Memory Bank
      validate.cmd.ts     # tocket validate — health check
      config.cmd.ts       # tocket config — global settings TUI
      focus.cmd.ts        # tocket focus — update Current Focus
      status.cmd.ts       # tocket status — quick overview
      doctor.cmd.ts       # tocket doctor — deep diagnostics
      lint.cmd.ts         # tocket lint — context quality audit
      diff.cmd.ts         # tocket diff — payload vs git changes
      handoff.cmd.ts      # tocket handoff — session context summary
      eject.cmd.ts        # tocket eject — remove scaffolding
      dashboard.ts        # Interactive menu (no-args entry point)
    templates/
      memory-bank.ts      # Template functions for scaffolded files
    utils/
      theme.ts            # Purple theme, banner, semantic helpers
      git.ts              # Git wrappers (staged, modified, commits, diff)
      config.ts           # Global config (~/.tocketrc.json)
      context.ts          # Shared constants and helpers
      xml.ts              # Payload XML parser (for tocket diff)
    tests/                # Test suite (248 tests, 60 suites)
  dist/                   # Compiled output (gitignored)
  .context/               # Memory Bank (committed)
  .tocket/                # CLI artifacts like last-payload.xml (gitignored)
  CLAUDE.md               # Executor agent instructions
  GEMINI.md               # Architect agent instructions
```

## Command Registration Pattern

Each command lives in `src/commands/<name>.cmd.ts` and exports a `register*Command(program: Command): void` function. The entry point calls each registration function sequentially.
