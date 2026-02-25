# Tocket Protocol Specification

> How any AI agent should operate in a Tocket-enabled repository.

This file is **agent-agnostic**. Whether you are Claude, Gemini, GPT, Cursor, Cline, Copilot, or any future AI — if you see this file, follow these rules.

Tocket is a **file convention**, not a framework. It adds markdown files to your repo — nothing else. No runtime dependencies, no build plugins, no code modifications.

### Core Principles

- **Zero runtime pollution** — Tocket is invisible to production code. It exists only as dev-time markdown files committed to git.
- **Minimally intrusive** — A `.context/` directory and a few root-level configs. No entries in `package.json`, no global state, no lock files.
- **Fully ejectable** — Run `tocket eject` (or delete the files manually) and your project is exactly as it was before.
- **Agent-agnostic** — Any AI that can read files can follow this protocol. No vendor lock-in.

---

## 1. Memory Bank

Project context lives in `.context/`, not in chat history. **Read it before doing anything.**

```
.context/
  activeContext.md    ← Start here. Current focus, recent changes, open decisions.
  systemPatterns.md   ← Architecture patterns, conventions, key decisions.
  techContext.md      ← Tech stack, build tools, critical rules.
  productContext.md   ← What the product is, who it's for, why it exists.
  progress.md         ← What's done, what's next.
```

### Rules

- **Read before acting** — Always read `activeContext.md` and `systemPatterns.md` before your first action in a session.
- **Write before leaving** — Update `activeContext.md` with what changed after completing significant work.
- **Trust the files** — If `.context/` says the project uses ESM, it uses ESM. Don't second-guess documented decisions.
- **Don't duplicate** — Context belongs in `.context/`, not scattered in code comments or chat summaries.

---

## 2. Triangulation

Tocket separates **planning** from **implementation** across two agent roles:

```
┌─────────────────┐          ┌─────────────────┐
│    ARCHITECT     │          │    EXECUTOR      │
│  (Planner)       │  payload │  (Implementer)   │
│                  │─────────►│                  │
│  Analyzes task   │          │  Receives plan   │
│  Designs approach│          │  Writes code     │
│  Generates XML   │          │  Runs tests      │
│  Updates patterns│          │  Updates context  │
└─────────────────┘          └─────────────────┘
```

### Architect

- Reads `.context/` to understand current state
- Produces structured payloads (see Section 3) with clear tasks
- Makes architectural decisions and records them in `systemPatterns.md`
- **Does not write code** — only specs and constraints
- Config file: `GEMINI.md` (or equivalent for your Architect agent)

### Executor

- Reads `.context/` and the Architect's payload
- Implements tasks exactly as specified
- Asks when the plan is unclear — does not improvise architecture
- Updates `activeContext.md` and `progress.md` after completing work
- Config file: `CLAUDE.md` (or equivalent for your Executor agent)

### Solo Mode

Not every task needs triangulation. For simple, well-defined changes (typo fixes, single-file edits), a single agent can act as both Architect and Executor. The Memory Bank rules still apply.

---

## 3. Payloads

A payload is the structured handoff from Architect to Executor. It uses XML to be parseable, version-tagged, and unambiguous.

### Minimal Example

```xml
<payload version="2.0">
  <meta>
    <intent>Add input validation to the sync command</intent>
    <scope>src/commands/sync.cmd.ts</scope>
    <priority>medium</priority>
  </meta>

  <tasks>
    <task id="1" type="edit">
      <target>src/commands/sync.cmd.ts</target>
      <action>Validate that .context/ exists before prompting</action>
      <spec>Check for directory existence, exit with helpful error if missing</spec>
      <done>sync command fails gracefully without .context/</done>
    </task>
  </tasks>

  <validate>
    <check>Run sync in a directory without .context/ — should show error</check>
  </validate>
</payload>
```

### Full Format

```xml
<payload version="2.0">
  <meta>
    <intent>Goal in one line</intent>
    <scope>Files and modules affected</scope>
    <skills>Required skills or plugins (comma-separated)</skills>
    <priority>high | medium | low</priority>
  </meta>

  <context>
    <summary>Background, reasoning, and any relevant history</summary>
  </context>

  <tasks>
    <task id="1" type="create | edit | delete" skill="skill-name">
      <target>file/path</target>
      <action>What to do (imperative)</action>
      <spec>Detailed specification — the "how"</spec>
      <done>Definition of done — how to know this task is complete</done>
    </task>
    <!-- More tasks... -->
  </tasks>

  <validate>
    <check>Human-readable verification step</check>
    <test>Command to run (e.g., npm run build)</test>
  </validate>
</payload>
```

### Payload Rules

- **One payload per logical unit of work** — Don't cram unrelated changes into one payload.
- **Tasks are ordered** — The Executor processes them sequentially.
- **`<validate>` is mandatory** — Every payload must define how to verify success.
- **Version tag is required** — Currently `2.0`. The Executor may warn on version mismatches.

---

## Quick Start

If you're an AI agent encountering a Tocket repository for the first time:

1. Read this file (`TOCKET.md`)
2. Read `.context/activeContext.md` for current state
3. Read your role-specific config (`CLAUDE.md` or `GEMINI.md`)
4. Proceed with your task, following the Memory Bank rules above
