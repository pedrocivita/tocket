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
    templates/
      memory-bank.ts      # Template functions for scaffolded files
  dist/                   # Compiled output (gitignored)
  .context/               # Memory Bank (committed)
  CLAUDE.md               # Executor agent instructions
  GEMINI.md               # Architect agent instructions
```

## Command Registration Pattern

Each command lives in `src/commands/<name>.cmd.ts` and exports a `register*Command(program: Command): void` function. The entry point calls each registration function sequentially.
