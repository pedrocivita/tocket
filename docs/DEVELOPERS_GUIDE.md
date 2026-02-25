# Developer Guide

How to run the Tocket protocol in your project — safely, on a branch, without touching your main codebase until you're ready.

> Visit **[tocket.ai](https://tocket.ai)** for an overview of the framework.

---

## What Tocket adds to your repo

Tocket is a file convention. Running `tocket init` creates these files:

```
your-project/
  .context/                   # Memory Bank (5 markdown files)
    activeContext.md          # Current focus, recent changes, open decisions
    systemPatterns.md         # Architecture patterns and conventions
    techContext.md            # Stack, build tools, critical rules
    productContext.md         # What the product is and why
    progress.md              # Milestones and completed work
  TOCKET.md                   # Protocol spec (any AI reads this)
  CLAUDE.md                   # Executor agent config (Claude Code)
  GEMINI.md                   # Architect agent config (Gemini)
  .cursorrules                # Cursor IDE agent config
```

That's it — 9 markdown files. No config in `package.json`, no build plugins, no runtime dependencies. Everything is plain text committed to git.

### Minimal mode

If 9 files feels like too much, use `--minimal` to scaffold only the essentials:

```bash
npx @pedrocivita/tocket init --minimal
```

This creates just 3 files: `.context/activeContext.md`, `.context/systemPatterns.md`, and `TOCKET.md`. You can always add the remaining files later by running `init` again.

---

## Setting up safely with branches

Tocket is designed to be tested without risk to your existing repo. The recommended approach is to scaffold on a branch, try it with a few AI sessions, and merge only when you're confident.

### Step 1: Create a test branch

```bash
cd your-project
git checkout -b setup/tocket
```

### Step 2: Initialize the workspace

```bash
# Interactive (asks for name and description)
npx @pedrocivita/tocket init

# Or fully non-interactive (CI-friendly)
npx @pedrocivita/tocket init --name myproject --description "My app" --force

# Or minimal (3 files instead of 9)
npx @pedrocivita/tocket init --minimal --name myproject --description "My app" --force
```

The CLI will:
1. **Auto-detect your stack** from `package.json` (language, runtime, build tool, framework, notable dependencies)
2. **Ask for a project name** and short description (pre-filled from package.json if available) — or use `--name` and `--description` to skip prompts
3. **Create `.context/`** with markdown files pre-populated with your stack info
4. **Create agent configs** (`TOCKET.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`) at the repo root — unless `--minimal` is used

If any of these files already exist (e.g., you already have a `CLAUDE.md`), the CLI will ask before overwriting. Use `--force` to skip the prompts.

### Step 3: Commit the scaffolding

```bash
git add .context/ TOCKET.md CLAUDE.md GEMINI.md .cursorrules
git commit -m "chore: scaffold Tocket workspace"
```

### Step 4: Run a few AI sessions

Open your AI tool (Claude Code, Cursor, Gemini, etc.) and work on your project normally. The agent will read `.context/activeContext.md` at the start and update it at the end.

After a couple sessions, check whether context is actually being preserved:

```bash
# See workspace health
npx @pedrocivita/tocket status

# See what the Memory Bank contains
cat .context/activeContext.md
```

### Step 5: Merge or discard

**If you like it** — merge into main:

```bash
git checkout main
git merge setup/tocket
```

**If you don't** — clean up with zero impact:

```bash
# Option A: Eject (removes Tocket files, keeps the branch)
npx @pedrocivita/tocket eject

# Option B: Delete the branch entirely
git checkout main
git branch -D setup/tocket
```

Either way, your main branch is untouched.

---

## Day-to-day workflow

Once Tocket is set up, here's how a typical development session works.

### Solo mode (one agent, simple tasks)

Most tasks don't need two agents. A single AI reads the Memory Bank, does the work, and updates the context:

```
1. Agent reads .context/activeContext.md
2. You give it a task
3. It implements the task
4. It updates activeContext.md with what changed
```

### Triangulated mode (two agents, complex tasks)

For multi-file features, refactors, or architectural changes, split planning from implementation:

```
1. Architect (e.g., Gemini) reads .context/ and analyzes the task
2. Architect generates a <payload> XML — a structured plan
3. You copy the payload to the Executor (e.g., Claude Code)
4. Executor reads .context/ + the payload
5. Executor implements each task in order
6. Executor updates .context/ with results
```

The payload XML is the contract. It includes what files to touch, what to do, and how to verify the result.

### Generating payloads

```bash
npx @pedrocivita/tocket generate

# Or output to stdout/file instead of clipboard
npx @pedrocivita/tocket generate --to stdout
npx @pedrocivita/tocket generate --to payload.xml
```

This interactive command:
- Auto-fills the scope from your current git diff (staged + modified files)
- Includes the last commit message as default intent
- Walks you through intent, priority, and tasks
- Generates valid payload XML
- Copies it to your clipboard (or outputs to `--to` target)

### Updating focus

When you switch to a different task:

```bash
npx @pedrocivita/tocket focus "Migrating auth to OAuth2"
```

This updates the "Current Focus" section in `activeContext.md` so the next AI session knows what you're working on.

### Syncing progress

After a work session:

```bash
npx @pedrocivita/tocket sync

# Or non-interactive
npx @pedrocivita/tocket sync --summary "Fixed auth bug and added tests"
```

This appends a timestamped summary with your recent git commits to `.context/progress.md`.

---

## What each Memory Bank file does

### `activeContext.md` — The starting point

Every AI session begins here. It contains:

- **Current Focus** — One sentence describing the active task
- **Recent Changes** — A table of what happened and which agent did it
- **Open Decisions** — Anything unresolved that needs attention

Update this file at the end of every session. Replace (don't append) — it should reflect the current state, not a log.

### `systemPatterns.md` — How the code is organized

Architecture decisions, naming conventions, and established patterns. Agents read this to follow your project's style instead of guessing.

Example entries:
- "Commands follow the registration pattern: one file per command"
- "All API routes are in `src/routes/` with `*.route.ts` suffix"
- "State management uses Zustand with slices in `src/store/`"

Update when architecture changes. The Architect role owns this file.

### `techContext.md` — Stack and build details

Hard facts about your project: language, runtime, build tool, framework, critical rules. `tocket init` auto-populates this from `package.json`.

Example:
```markdown
| Layer     | Technology    | Notes                    |
|-----------|--------------|--------------------------|
| Language  | TypeScript   | strict: true             |
| Runtime   | Node.js 20+  | ESM                      |
| Build     | Vite         | SPA mode                 |
| Framework | React 19     | With React Router v7     |
```

### `productContext.md` — What and why

Business context: what the product does, who it's for, and why it exists. Rarely changes. Useful for agents making UX or naming decisions.

### `progress.md` — Done and next

Milestone tracking. `tocket sync` appends session blocks here automatically. Useful for onboarding new agents or resuming after a break.

---

## Working with branches — advanced patterns

### Feature branches with Tocket context

When you start a feature branch, the `.context/` files come along. Update `activeContext.md` on the branch to reflect the feature work:

```bash
git checkout -b feature/new-dashboard
npx @pedrocivita/tocket focus "Building new dashboard with chart components"

# ... do your work ...

npx @pedrocivita/tocket sync
git add .context/
git commit -m "chore: update context after dashboard work"
```

When you merge, the context updates merge too. If there are conflicts in `.context/` files, resolve them like any other merge conflict — pick the more current state.

### Isolated experiments

Want to test a big refactor with AI assistance without affecting anything?

```bash
git checkout -b experiment/refactor-api
npx @pedrocivita/tocket focus "Experiment: refactoring API layer to use tRPC"

# Let the AI go wild
# If it works, merge. If not, delete the branch.
```

The Memory Bank on the experiment branch tracks that experiment's context independently.

### Team branches

On a team, each developer can have their own Tocket context on feature branches. The `activeContext.md` on `main` reflects the project-wide state, while feature branches reflect individual work.

When merging, the developer updates `activeContext.md` on main to reflect what landed.

---

## Validating your workspace

Check that your Memory Bank is healthy:

```bash
npx @pedrocivita/tocket validate
```

This checks for:
- Required files exist in `.context/`
- `TOCKET.md` is present
- Agent config files are in place
- Files aren't stale (warns if `activeContext.md` hasn't been updated in over 7 days)

### Quick status check

```bash
npx @pedrocivita/tocket status
```

Shows a one-line summary: workspace health, current focus, git branch, and which agent configs are present.

### Deep diagnostics

```bash
npx @pedrocivita/tocket doctor
```

Runs a thorough check: file existence, content health (is the focus populated? are conventions documented?), git tracking (is `.context/` committed?), and staleness detection.

### Context quality audit

```bash
npx @pedrocivita/tocket lint
```

Audits the content quality of your Memory Bank files and provides actionable suggestions: missing sections, placeholder content, empty conventions, orphan agent configs, uncommitted changes.

---

## Ejecting

If you decide Tocket isn't for you, remove everything cleanly:

```bash
npx @pedrocivita/tocket eject
```

This removes:
- `.context/` (the entire directory)
- `TOCKET.md`
- `CLAUDE.md`
- `GEMINI.md`
- `.cursorrules`

It does **not** touch:
- Your global config (`~/.tocketrc.json`)
- Any other files in your repo
- Git history (the files were committed, so they're in history)

Use `--force` to skip the confirmation prompt.

---

## Global configuration

Set defaults that apply to all your Tocket workspaces:

```bash
# Interactive setup
npx @pedrocivita/tocket config

# Or set values directly (CI-friendly)
npx @pedrocivita/tocket config --author "Your Name" --priority medium --skills "core,api"

# See current config
npx @pedrocivita/tocket config --show
```

Config is stored at `~/.tocketrc.json` and pre-fills author, priority, and skills when generating payloads.

---

## Payload format reference

Payloads are XML documents that the Architect generates for the Executor. Here's the structure:

```xml
<payload version="2.0">
  <meta>
    <intent>One-line goal</intent>
    <scope>Files and modules affected</scope>
    <priority>high | medium | low</priority>
    <skills>Optional: comma-separated skill names</skills>
  </meta>

  <context>
    <summary>Background and reasoning (optional)</summary>
  </context>

  <tasks>
    <task id="1" type="create | edit | delete">
      <target>file/path</target>
      <action>What to do (imperative)</action>
      <spec>Detailed specification (optional)</spec>
      <done>How to know this task is complete</done>
    </task>
  </tasks>

  <validate>
    <check>Human-readable verification step</check>
    <test>Command to run (e.g., npm test)</test>
  </validate>
</payload>
```

Rules:
- One payload per logical unit of work
- Tasks are processed sequentially by `id`
- `<validate>` is mandatory — every payload must define how to verify success
- Version tag (`2.0`) is required

See [examples/walkthrough.md](../examples/walkthrough.md) for a complete end-to-end example.

---

## Troubleshooting

### "No Tocket workspace found"

You're in a directory without `.context/`. Either `cd` to the right directory or run `tocket init`.

### Agent ignores the Memory Bank

Make sure the agent's instructions tell it to read `.context/` before acting. The generated `CLAUDE.md`, `GEMINI.md`, and `.cursorrules` files already include this instruction. If you're using a different agent, add it manually.

### Merge conflicts in `.context/` files

These are normal, especially in `activeContext.md` and `progress.md`. Resolve them the same way you'd resolve any markdown conflict: keep the more recent state. For `progress.md`, keep both session blocks.

### `tocket init` doesn't detect my stack

Auto-detection reads `package.json`. If your project doesn't have one (e.g., Python, Go, Rust), the CLI will still work — you'll just fill in the project name and description manually. The generated `techContext.md` will have placeholder rows for you to fill in.

### Files already exist

If you already have a `CLAUDE.md` or `.cursorrules`, `tocket init` will ask before overwriting. You can skip specific files or use `--force` to overwrite everything.

---

## Contributing to Tocket itself

If you want to contribute to the Tocket CLI codebase (not just use the protocol), see the [Contributing Guide](../CONTRIBUTING.md) for setup instructions, code conventions, and the PR workflow.

The CLI is built with TypeScript, Commander.js, and Node.js 20+. The project uses its own protocol — `.context/` in the Tocket repo is a live example of the Memory Bank in action.

---

## Next steps

- [Getting Started](GETTING_STARTED.md) — 5-minute setup walkthrough
- [Tocket Rules](TOCKET_RULES.md) — Complete protocol reference
- [Protocol Spec](../TOCKET.md) — The agent-agnostic specification
- [Walkthrough](../examples/walkthrough.md) — Full payload exchange example
