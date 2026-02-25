# Product Context - Tocket

## What is Tocket?

**A file convention and context scaffold for multi-agent workspaces.**

Tocket is a set of markdown files — committed to git, readable by any AI — that give agents shared memory across sessions. It is not a library, not a runtime dependency, and not a build plugin. It's a dev-time convention that structures how AI agents share context, hand off work, and build on each other's output.

## Problem

When multiple AI agents (Gemini, Claude, GPT, etc.) work on the same codebase, context is lost between sessions and between agents. Each agent starts from scratch, re-reads files, and makes decisions that conflict with previous ones. There is no shared memory, no structured handoff, and no accountability for architectural decisions.

## Solution

Tocket provides two core primitives:

1. **Memory Bank** (`.context/`) — Version-controlled project context that persists across sessions and agents. Any agent reads the same ground truth.
2. **Triangulation** (Architect + Executor) — One agent plans, another implements, with structured XML payloads as the handoff mechanism.

Both are **pure file conventions**. Tocket adds zero runtime dependencies, touches nothing in `package.json`, and is invisible to production code. You can adopt it on a branch, test it, and eject with one command if it doesn't fit.

## Target Users

- Developers using multi-agent workflows (Antigravity, Cursor + Claude, etc.)
- Teams that want reproducible AI-assisted development
- Open-source maintainers who want contributors' AI agents to follow project conventions
- Anyone who wants structured AI context without adding dependencies to their project

## Design Principles

- **Zero runtime pollution** — No dependencies, no build plugins, no `package.json` entries. Dev-time only.
- **Minimally intrusive** — Plain markdown files in `.context/` and a few root configs. Eject in one command.
- **Convention over configuration** — Sensible defaults, minimal setup
- **Agent-agnostic** — Works with any LLM that can read files
- **Version-controlled context** — `.context/` is committed to git, not ephemeral
- **Dogfooding** — Tocket uses its own protocol for development
