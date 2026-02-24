# Product Context - Tocket

## What is Tocket?

**The Context Engineering Framework for Multi-Agent Workspaces.**

Tocket structures how AI agents share context, hand off work, and build on each other's output. It turns ad-hoc prompting into a repeatable engineering workflow.

## Problem

When multiple AI agents (Gemini, Claude, GPT, etc.) work on the same codebase, context is lost between sessions and between agents. Each agent starts from scratch, re-reads files, and makes decisions that conflict with previous ones. There is no shared memory, no structured handoff, and no accountability for architectural decisions.

## Solution

Tocket provides two core primitives:

1. **Memory Bank** (`.context/`) — Version-controlled project context that persists across sessions and agents. Any agent reads the same ground truth.
2. **Triangulation** (Architect + Executor) — One agent plans (Gemini as Architect), another implements (Claude as Executor), with structured XML payloads as the handoff mechanism.

## Target Users

- Developers using multi-agent workflows (Antigravity, Cursor + Claude, etc.)
- Teams that want reproducible AI-assisted development
- Open-source maintainers who want contributors' AI agents to follow project conventions

## Design Principles

- **Convention over configuration** — Sensible defaults, minimal setup
- **Agent-agnostic** — Works with any LLM that can read markdown files
- **Version-controlled context** — `.context/` is committed to git, not ephemeral
- **Dogfooding** — Tocket uses its own protocol for development
