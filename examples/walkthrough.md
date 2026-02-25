# Tocket Payload Exchange Walkthrough

A practical example showing how **Architect** (Gemini) and **Executor** (Claude Code) collaborate using Tocket's XML v2.0 payload protocol.

---

## Scenario

Adding a `--dry-run` flag to the `tocket init` command that previews which files would be created without writing them.

## Phase 1: Architect Analysis (Gemini)

The Architect reads the Memory Bank to understand current state:

- `.context/activeContext.md` — current version, open decisions
- `.context/systemPatterns.md` — Commander.js patterns, option registration
- `.context/techContext.md` — TypeScript ESM, Node.js 20+

Based on the user request and codebase analysis, the Architect generates a payload:

```xml
<payload version="2.0">
  <meta>
    <intent>Add --dry-run flag to tocket init for previewing file creation</intent>
    <scope>src/commands/init.cmd.ts</scope>
    <skills>core</skills>
    <priority>low</priority>
  </meta>

  <context>
    <read reason="Understand init command structure">src/commands/init.cmd.ts</read>
    <summary>
      The init command scaffolds 9 files into .context/ and project root.
      Adding --dry-run will list files that would be created without writing them.
      Follows existing Commander.js option pattern.
    </summary>
  </context>

  <tasks>
    <task id="1" type="edit" skill="core">
      <target>src/commands/init.cmd.ts</target>
      <action>Add --dry-run option to init command</action>
      <spec>
        1. Register option `-d, --dry-run` in the command chain
        2. Extract option in action handler
        3. When active: log each file path with "[dry-run]" prefix, skip writeFile
        4. When inactive: normal file creation behavior
      </spec>
      <done>
        - `tocket init --dry-run` lists all 9 files without creating them
        - `tocket init` without flag creates files normally
        - `tocket init --help` shows the --dry-run option
      </done>
    </task>
  </tasks>

  <validate>
    <check>npm run build succeeds</check>
    <check>tocket init --help shows --dry-run option</check>
    <check>tocket init --dry-run in empty dir creates no files</check>
    <check>npm test passes (38+ tests)</check>
  </validate>
</payload>
```

The Architect copies this XML and pastes it into the Claude Code session.

---

## Phase 2: Executor Implementation (Claude Code)

Claude Code receives the payload and follows the Tocket Protocol:

1. **Reads Memory Bank** — `.context/activeContext.md` for current state
2. **Reads target file** — `src/commands/init.cmd.ts` for implementation context
3. **Executes tasks** — makes surgical edits following the spec

### Implementation

```typescript
// In src/commands/init.cmd.ts

// 1. Add option to command chain (after .description, before .action)
.option("-d, --dry-run", "Preview files without creating them")

// 2. Extract in action handler
.action(async (options: { dryRun?: boolean }) => {
  const dryRun = options.dryRun ?? false;

  // ... (stack detection and prompts remain unchanged)

  // 3. Conditional file creation
  for (const [filePath, content] of files) {
    if (dryRun) {
      console.log(`  [dry-run] would create ${filePath}`);
    } else {
      const fullPath = join(cwd, filePath);
      await writeFile(fullPath, content, "utf-8");
      console.log(`  created ${filePath}`);
    }
  }
});
```

### Validation

```bash
npm run build                          # TypeScript compiles
node dist/index.js init --help         # Shows --dry-run option
node dist/index.js init --dry-run      # Lists files, creates nothing
npm test                               # 38+ tests pass
```

---

## Phase 3: Human Review

Pedro reviews the changes:

```bash
git diff                               # Review code changes
node dist/index.js init --dry-run      # Manual verification
```

If approved, Claude Code commits:

```bash
git add src/commands/init.cmd.ts
git commit -m "feat: add --dry-run flag to tocket init

Previews file creation without writing to disk.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Key Takeaways

1. **Architect thinks, Executor implements** — clear separation of concerns
2. **Payload XML is precise** — no ambiguity, includes definition of done
3. **Memory Bank informs both** — shared source of truth across agents
4. **Validation built in** — Architect specifies how to verify
5. **Atomic commits** — one logical change per commit
