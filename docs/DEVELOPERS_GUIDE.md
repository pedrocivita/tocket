# Developer Guide

Guide for contributing to the Tocket CLI codebase.

## Prerequisites

- Node.js 20+
- npm 10+
- Git

## Setup

```bash
git clone https://github.com/pedrocivita/tocket.git
cd tocket
npm install
npm run build
```

Verify the build works:

```bash
node dist/index.js --help
```

## Project structure

```
tocket/
  src/
    index.ts                    # CLI entry point (Commander setup + dashboard detection)
    commands/
      init.cmd.ts               # tocket init — scaffold workspace
      generate.cmd.ts           # tocket generate — smart payload builder
      sync.cmd.ts               # tocket sync — update Memory Bank
      validate.cmd.ts           # tocket validate — workspace health check
      config.cmd.ts             # tocket config — global settings TUI
      dashboard.ts              # Interactive menu (no-args entry point)
    templates/
      memory-bank.ts            # Template functions for scaffolded files
    utils/
      theme.ts                  # Purple theme, ASCII banner, semantic helpers
      git.ts                    # Git wrappers (staged files, commits, branch)
      config.ts                 # Global config (~/.tocketrc.json) read/write
    tests/
      memory-bank.test.ts       # Template tests (38 tests)
      theme.test.ts             # Theme utility tests (10 tests)
      git.test.ts               # Git utility tests (12 tests)
      config.test.ts            # Config utility tests (7 tests)
  dist/                         # Compiled output (gitignored)
  docs/                         # Documentation (you are here)
  .context/                     # Memory Bank (committed)
  .github/
    workflows/ci.yml            # GitHub Actions CI
    PULL_REQUEST_TEMPLATE.md    # PR template
```

## Tech stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| TypeScript | 5.9 | Language |
| Node.js | 20+ | Runtime |
| Commander.js | 14 | CLI framework |
| @inquirer/prompts | 8 | Interactive prompts |
| clipboardy | 5 | Clipboard access |
| chalk | 5 | Terminal styling (purple theme) |

## Code conventions

### ESM

The project uses ES Modules (`"type": "module"` in package.json). This means:

- **All imports must use `.js` extension** — `import { foo } from "./bar.js"`, not `./bar` or `./bar.ts`
- **Use `node:` prefix for built-ins** — `import { join } from "node:path"`
- **Use `import type` for type-only imports** — `import type { Command } from "commander"`

### Exports

- **Named exports only** — no `export default`
- Every module exports specific named functions or constants

### File naming

- Commands: `src/commands/<name>.cmd.ts`
- Templates: `src/templates/<name>.ts`
- Use `kebab-case` for file names, `camelCase` for exports

### Style

- Semicolons: yes
- All code, comments, and commits in English
- TypeScript `strict: true`

## Adding a new command

1. Create `src/commands/mycommand.cmd.ts`:

```typescript
import type { Command } from "commander";

export function registerMycommandCommand(program: Command): void {
  program
    .command("mycommand")
    .description("What it does")
    .action(async () => {
      // implementation
    });
}
```

2. Register it in `src/index.ts`:

```typescript
import { registerMycommandCommand } from "./commands/mycommand.cmd.js";

// ... after other registrations:
registerMycommandCommand(program);
```

3. Build and test:

```bash
npm run build
node dist/index.js mycommand
```

## Adding a new template

Templates live in `src/templates/memory-bank.ts` as exported functions that return markdown strings:

```typescript
export const myTemplateMd = (projectName: string) =>
  `# My Template - ${projectName}

Content here. Use \`\\\`\` to escape backticks inside template literals.
`;
```

Then import and use it in the relevant command.

## Build

```bash
npm run build    # Compiles TypeScript to dist/
```

There is no watch mode configured yet. After editing, run `npm run build` manually.

## Testing

The project uses Node.js built-in test runner (`node:test`) with 67 tests across 20 suites.

```bash
npm test    # Compiles TypeScript and runs all tests
```

Test files:
- `src/tests/memory-bank.test.ts` — template function tests (38 tests)
- `src/tests/theme.test.ts` — theme utility smoke tests (10 tests)
- `src/tests/git.test.ts` — git wrapper tests (12 tests)
- `src/tests/config.test.ts` — config read/write tests (7 tests)

For manual command testing:

```bash
npm run build
node dist/index.js --help
node dist/index.js               # Test dashboard (interactive menu)
node dist/index.js init          # Test in a temp directory
node dist/index.js init --force  # Test overwrite without prompts
node dist/index.js generate      # Test smart scope from git
node dist/index.js sync          # Test in a directory with .context/
node dist/index.js validate      # Test Memory Bank validation
node dist/index.js config --show # Test config display
node dist/index.js config --author "Test" # Test non-interactive config
```

## CI

GitHub Actions runs on push to `main` and on pull requests:

- Checkout
- Setup Node.js 20
- `npm ci`
- `npm run build`

- `npm test` (build + 67 tests)

## Submitting changes

1. Fork the repo
2. Create a branch: `feature/my-change` or `fix/my-bug`
3. Make focused, atomic commits in English
4. Run `npm run build` to verify
5. Open a PR using the template

For architectural proposals, read the [Contributing Guide](../CONTRIBUTING.md) — complex changes should use the Memory Bank protocol.

## Reading the Memory Bank

Before working on the codebase, read:

1. `.context/activeContext.md` — What's currently being worked on
2. `.context/systemPatterns.md` — Architecture decisions
3. `.context/techContext.md` — Stack details

This is the Tocket protocol applied to itself.
