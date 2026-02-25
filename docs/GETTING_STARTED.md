# Getting Started with Tocket

Set up your first multi-agent workspace in 5 minutes.

## What you'll get

After setup, your project will have:

```
your-project/
  .context/
    activeContext.md      # Current session focus
    systemPatterns.md     # Architecture decisions
  TOCKET.md               # Protocol spec (for any AI)
  CLAUDE.md               # Executor instructions (for Claude Code)
  GEMINI.md               # Architect instructions (for Gemini)
```

## Option A: Using the CLI (recommended)

```bash
npx @pedrocivita/tocket
```

This opens the interactive dashboard. Select "Initialize workspace" and follow the prompts.

Or run the init command directly:

```bash
npx @pedrocivita/tocket init
```

## Option B: Manual setup

You don't need the CLI. Tocket is just a file convention.

### Step 1: Create the Memory Bank

```bash
mkdir .context
```

Create `.context/activeContext.md`:

```markdown
# Active Context - YourProject

## Current Focus

_Describe what you're working on right now._

## Recent Changes

| Date | Change | Agent |
|------|--------|-------|
| 2026-02-24 | Project initialized | Human |

## Open Decisions

_List anything unresolved._
```

Create `.context/systemPatterns.md`:

```markdown
# System Patterns - YourProject

## Tech Stack

_List your technologies here._

## Conventions

- Code language: `en-US`
- Commit language: `en-US`

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
```

### Step 2: Add TOCKET.md

Copy the [protocol spec template](../TOCKET.md) to your project root. This tells any AI agent how to behave in your repo.

### Step 3: Add agent config files (optional)

If you use specific agents, create their config files:

- `CLAUDE.md` — Instructions for Claude Code (Executor role)
- `GEMINI.md` — Instructions for Gemini (Architect role)

These are optional. The `TOCKET.md` spec alone is enough for any agent to follow the protocol.

## Your first workflow

### Solo (one agent, simple tasks)

1. Your AI reads `.context/activeContext.md`
2. You give it a task
3. It implements the task
4. It updates `activeContext.md` with what changed

### Triangulated (two agents, complex tasks)

1. **Architect** reads `.context/` and analyzes the task
2. **Architect** generates a `<payload>` XML with structured tasks
3. **Executor** reads `.context/` + the payload
4. **Executor** implements each task in order
5. **Executor** updates `.context/` with results

### Generating payloads

```bash
npx @pedrocivita/tocket generate
```

This walks you through building a payload interactively. It auto-fills the scope from your git status, supports multiple tasks, shows a preview, and copies the XML to your clipboard.

### Configuring defaults

Set your name and preferences once:

```bash
npx @pedrocivita/tocket config
```

This saves to `~/.tocketrc.json` and pre-fills author, priority, and skills in future commands.

### Syncing progress

After a work session:

```bash
npx @pedrocivita/tocket sync
```

This appends a summary of what was done (plus recent git commits) to `.context/progress.md`.

## Adding more context files

The Memory Bank supports 5 files. Start with `activeContext.md` and `systemPatterns.md`, then add more as needed:

| File | When to add it |
|------|---------------|
| `techContext.md` | When your stack is complex enough to document |
| `productContext.md` | When you need to capture business goals or personas |
| `progress.md` | After your first few sessions (or use `tocket sync`) |

## Next steps

- Read the [Tocket Rules](TOCKET_RULES.md) for the full protocol reference
- Read the [Developer Guide](DEVELOPERS_GUIDE.md) if you want to contribute to the CLI
- Check [TOCKET.md](../TOCKET.md) for the agent-facing protocol spec
