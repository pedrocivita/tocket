![CI](https://github.com/pedrocivita/tocket/actions/workflows/ci.yml/badge.svg)
[![npm](https://img.shields.io/npm/v/@pedrocivita/tocket)](https://www.npmjs.com/package/@pedrocivita/tocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

# Tocket

**The Context Engineering Framework for Multi-Agent Workspaces**

When multiple AI agents work on the same codebase, context is lost between sessions and between agents. Each one starts from scratch, re-reads files, and makes decisions that conflict with previous ones.

Tocket fixes this with two primitives:

- **Memory Bank** — A `.context/` directory with version-controlled markdown files that any AI can read. The project's ground truth lives in files, not in chat history.
- **Triangulation** — An Architect plans, an Executor implements, and structured XML payloads are the handoff between them.

## Who is this for?

- Developers using **multi-agent setups** (Gemini + Claude, Cursor + Copilot, etc.)
- Teams that want **reproducible AI-assisted development** across sessions
- Anyone tired of re-explaining project context to AI every time they open a chat

## You don't need the CLI to use Tocket

The protocol is just files. You can adopt it manually:

1. Create a `.context/` directory with `activeContext.md` and `systemPatterns.md`
2. Add a `TOCKET.md` to your repo root (see [the spec](TOCKET.md))
3. Tell your AI agents to read `.context/` before acting

The CLI just automates the scaffolding.

## Quick Start

```bash
# Interactive dashboard — guided entry point
npx @pedrocivita/tocket

# Scaffold a new workspace (creates .context/, TOCKET.md, CLAUDE.md, GEMINI.md)
npx @pedrocivita/tocket init

# Generate a payload XML with smart git integration
npx @pedrocivita/tocket generate

# Sync session progress into Memory Bank
npx @pedrocivita/tocket sync
```

## Commands

| Command           | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `tocket`          | Interactive dashboard with guided menu                               |
| `tocket init`     | Scaffolds `.context/`, `TOCKET.md`, `CLAUDE.md`, `GEMINI.md`         |
| `tocket generate` | Smart payload builder — auto-fills scope from git, multi-task support |
| `tocket sync`     | Appends session summary + git log to `.context/progress.md`          |
| `tocket validate` | Checks if the current directory has a valid Tocket Memory Bank       |
| `tocket config`   | Manage global settings (`~/.tocketrc.json`)                          |

## Configuration

Set global defaults so you don't repeat yourself:

```bash
# Interactive setup
tocket config

# Or use flags (CI-friendly)
tocket config --author "Your Name" --priority medium --skills "core,lsp"

# View current config
tocket config --show
```

Config is stored at `~/.tocketrc.json` and pre-fills author, priority, and skills in all commands.

## How Triangulation works

```
Architect (any planning AI)         Executor (any coding AI)
     │                                   │
     │  1. Reads .context/               │
     │  2. Analyzes task                 │
     │  3. Generates <payload> XML       │
     │──────── structured handoff ──────►│
     │                                   │  4. Reads .context/ + payload
     │                                   │  5. Implements tasks
     │                                   │  6. Updates .context/
     │◄──────── status report ───────────│
```

The Architect doesn't write code. The Executor doesn't make architecture decisions. The payload is the contract between them.

## Memory Bank files

```
.context/
  activeContext.md    ← Current focus. Read this first.
  systemPatterns.md   ← Architecture decisions and conventions.
  techContext.md      ← Stack, build tools, critical rules.
  productContext.md   ← What the product is and why it exists.
  progress.md         ← What's done, what's next.
```

All files are markdown. All files are committed to git. Any AI that can read files can participate.

## Documentation

| Guide                                       | Description                                     |
| ------------------------------------------- | ----------------------------------------------- |
| [Getting Started](docs/GETTING_STARTED.md)  | Set up your first Tocket workspace in 5 minutes |
| [Tocket Rules](docs/TOCKET_RULES.md)        | Complete reference for all protocol rules       |
| [Developer Guide](docs/DEVELOPERS_GUIDE.md) | Contributing to the Tocket CLI codebase         |
| [Protocol Spec](TOCKET.md)                  | The agent-agnostic protocol specification       |

## How is this different from...

| Tool             | What it does                         | How Tocket differs                                                                   |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| `.cursorrules`   | Single-agent instructions for Cursor | Tocket defines _inter-agent_ protocol, not just single-agent rules                   |
| `CLAUDE.md`      | Instructions for Claude Code         | Tocket generates `CLAUDE.md` _as part of_ a broader multi-agent system               |
| `AGENTS.md`      | Codex agent instructions             | Same idea for one agent; Tocket coordinates multiple agents                          |
| Prompt templates | Static prompts for LLMs              | Tocket's Memory Bank evolves with the project; payloads are structured, not freeform |

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT
