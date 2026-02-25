# Tocket Rules

Conventions for the Tocket file-based protocol. Tocket is a lightweight set of markdown files — these rules describe how agents should read, write, and hand off context. For the agent-facing spec, see [TOCKET.md](../TOCKET.md).

---

## Memory Bank Rules

### File Schema

The `.context/` directory follows a fixed schema. Files have defined owners and update frequencies.

| File | Purpose | Primary Owner | Update Frequency |
|------|---------|---------------|-----------------|
| `activeContext.md` | Current focus, recent changes, open decisions | Both agents | Every session |
| `systemPatterns.md` | Architecture patterns, conventions, key decisions | Architect | When patterns change |
| `techContext.md` | Tech stack, build tools, critical rules | Architect | When stack changes |
| `productContext.md` | Business goals, target users, design principles | Architect | Rarely |
| `progress.md` | Milestone tracking, completed work, roadmap | Executor / `tocket sync` | Per milestone |

### Reading Rules

1. **Read before acting.** At the start of every session, read `activeContext.md` and `systemPatterns.md` at minimum.
2. **Trust the files.** If `.context/` says the project uses a specific pattern, follow it. Don't second-guess documented decisions.
3. **Read role-specific config.** After `.context/`, read your agent config file (`CLAUDE.md`, `GEMINI.md`, or equivalent).

### Writing Rules

1. **Update before leaving.** After completing significant work, update `activeContext.md` with what changed.
2. **Don't duplicate.** Context belongs in `.context/`, not scattered in code comments, chat logs, or README.
3. **Append, don't overwrite** (for `progress.md`). Use `tocket sync` or append new session blocks.
4. **Replace, don't append** (for `activeContext.md`). The active context should reflect the *current* state, not a log.

### Git Rules

1. `.context/` files are **committed to git**. This is intentional — shared context must survive across clones.
2. Don't put `.context/` in `.gitignore`.
3. Treat `.context/` changes like any other code change — they should be part of commits.

---

## Triangulation Rules

### Roles

| Role | Responsibility | Does NOT do |
|------|---------------|-------------|
| **Architect** | Analyzes tasks, designs approach, generates payloads, records decisions | Write implementation code |
| **Executor** | Implements tasks from payloads, writes code, runs tests, updates context | Make architecture decisions |
| **Human** | Provides intent, reviews output, resolves conflicts, approves payloads | (Everything else is delegated) |

### When to triangulate

| Situation | Mode | Why |
|-----------|------|-----|
| Typo fix, single-line change | **Solo** | No planning needed |
| Add a function with clear requirements | **Solo** | Scope is obvious |
| New feature touching multiple files | **Triangulated** | Needs architecture decisions |
| Refactoring or migration | **Triangulated** | High impact, needs a plan |
| Bug with unclear root cause | **Solo first** | Investigate, then triangulate if complex |

### Communication flow

```
Human → Architect: "I need feature X"
Architect → Executor: <payload> XML
Executor → Human: Status report + updated .context/
```

The Architect and Executor do not talk to each other directly. The payload is the contract. The human mediates if needed.

---

## Payload Rules

### Required fields

Every payload must have:

```xml
<payload version="2.0">
  <meta>
    <intent>...</intent>     <!-- Required: one-line goal -->
    <scope>...</scope>       <!-- Required: affected files/modules -->
    <priority>...</priority> <!-- Required: high | medium | low -->
  </meta>
  <tasks>
    <task id="1" type="..."> <!-- Required: at least one task -->
      <target>...</target>   <!-- Required: file path -->
      <action>...</action>   <!-- Required: what to do -->
      <done>...</done>       <!-- Required: definition of done -->
    </task>
  </tasks>
  <validate>
    <check>...</check>       <!-- Required: at least one validation -->
  </validate>
</payload>
```

### Optional fields

```xml
<meta>
  <skills>...</skills>       <!-- Comma-separated skill/plugin names -->
</meta>
<context>
  <summary>...</summary>     <!-- Background and reasoning -->
</context>
<task>
  <spec>...</spec>           <!-- Detailed specification -->
</task>
<validate>
  <test>...</test>           <!-- Command to run for validation -->
</validate>
```

### Task types

| Type | Meaning |
|------|---------|
| `create` | Create a new file |
| `edit` | Modify an existing file |
| `delete` | Remove a file |

### Execution rules

1. **Tasks are ordered.** Process them sequentially by `id`.
2. **One payload per logical unit of work.** Don't mix unrelated changes.
3. **Validation is mandatory.** Every payload must define how to verify success.
4. **Version tag is required.** The Executor may warn on version mismatches.

---

## Agent Config Rules

### File naming

| File | Role | Content |
|------|------|---------|
| `TOCKET.md` | Any agent | Protocol spec — the universal rules |
| `CLAUDE.md` | Executor | Build commands, code style, implementation rules |
| `GEMINI.md` | Architect | Planning process, payload format, decision recording |

These names are conventions, not requirements. A team using GPT-4 as Architect could name it `GPT.md` — the protocol doesn't enforce vendor-specific naming.

### Priority order

When an agent starts a session, it should read files in this order:

1. `TOCKET.md` — Universal protocol rules
2. `.context/activeContext.md` — Current project state
3. `.context/systemPatterns.md` — Architecture and conventions
4. Role-specific config (`CLAUDE.md` or `GEMINI.md`)

---

## Summary of all rules

| # | Rule | Applies to |
|---|------|-----------|
| 1 | Read `.context/` before acting | All agents |
| 2 | Update `activeContext.md` after completing work | Executor |
| 3 | Record architecture decisions in `systemPatterns.md` | Architect |
| 4 | Don't duplicate context outside `.context/` | All agents |
| 5 | Commit `.context/` to git | All |
| 6 | One payload per logical unit of work | Architect |
| 7 | Process tasks sequentially | Executor |
| 8 | Always include validation in payloads | Architect |
| 9 | Don't improvise architecture — ask if unclear | Executor |
| 10 | Don't write code — produce specs | Architect |
