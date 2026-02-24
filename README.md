# Tocket

**The Context Engineering Framework for Multi-Agent Workspaces**

Tocket structures how AI agents share context, hand off work, and build on each other's output. It turns ad-hoc prompting into a repeatable engineering workflow.

## Core Pillars

- **Triangulation** — Architect + Executor pattern. One agent plans, another implements, with structured handoff payloads between them.
- **Context as Code** — Memory Bank protocol. Project context lives in version-controlled files (`.context/`), not ephemeral chat history.

## Commands

| Command | Description |
|---------|-------------|
| `tocket init` | Scaffold an agentic workspace with Memory Bank and triangulation config |
| `tocket generate` | Build payload XMLs interactively for Architect-Executor handoff |
| `tocket sync` | Update Memory Bank from git history and session artifacts |

## Installation

```bash
npx @pedrocivita/tocket
```

## Development

```bash
git clone https://github.com/pedrocivita/tocket.git
cd tocket
npm install
npm run build
node dist/index.js --help
```

## License

MIT
