# AGENTS.md — Tocket

Single source any AI agent should read first. Cursor, Claude, Gemini, Copilot, Windsurf, Codex, and anyone else that can read files.

Tocket is the **project notebook**. Agents work. Tocket remembers. Jev only chooses the next step.

## What Tocket is

- A file convention (`.context/`) plus a small CLI.
- Not a chatbot, not a computer-use runtime, not codegen.
- Jev (or the stub) is the **judge**, not the writer. Workers (you) execute.

## Read before expensive tools

1. This file.
2. `.context/activeContext.md` and `.context/systemPatterns.md`.
3. The latest file under `.context/decisions/` if one exists.

Phrase: `Before expensive tools: tocket decide --dry-run, or read .context/decisions/.`

## Decide vs work

| Command | Who | What |
| --- | --- | --- |
| `tocket decide` | Jev or stub | Writes the next move as JSON. Does not run tools. |
| `tocket work` | Reference worker | Dry-run plan (default). Never calls Jev. |
| `tocket work --apply` | Reference worker | Notebook receipt only. Honors `tool_gate`. |

If a decision file already exists, **honor it**. Do not call `tocket decide` again. Do not re-ask Jev.

## Tool-risk gate

Before bash, deploy, or browser:

```bash
tocket decide --from state.json --choice tool_gate:allow,block,ask --shadow
tocket work --from <decision>
tocket work --from <decision> --apply
```

- `allow` or no `tool_gate` field: apply as usual.
- `block`: stop (exit 2).
- `ask`: escalate to a human (exit 2).
- `--force` overrides the gate.
- Shadow / log-only apply still needs `--force`.

## Meta-attention and packs

Harness your context. Jev is the judge, not the writer. Meta-attention handoff: Jev judges chunks; workers read the filtered handoff. `tocket handoff --aware` scores `.context/` chunks (batched Noul `relevant` and Score `relevance`) and writes `.context/handoffs/` plus a receipt under `.context/attention/`. `--dry-run` or no `TYPESAFE_API_KEY` uses the stub; a key plus `--shadow` is live and log-only. Conditional packs live in `.context/gotchas/` (`frontend.md`, `path-src-api.md`, or `##` sections). `tocket packs load --query` asks Noul "load this pack?" and writes `.context/active/packs.md`. Without `--aware`, `tocket handoff` stays the full session summary. The flow is still decide, then work, then `tool_gate`. Agent auto-config is unchanged.

## Shadow-first

- `--dry-run` or no `TYPESAFE_API_KEY`: deterministic stub.
- `--shadow`: may call live Jev, but `semantics: log-only`.
- Optional `TYPESAFE_API_KEY`. Never paste API keys into chat.

## Model fork

`--fork agent|model|tool|action|human` (default `action`). `--fork model` is the cheap model-router hook. `--fork human` always reviews.

## After work

Update `.context/activeContext.md`. Do not ask Tocket to write prose, do math, or run workers.

## Setup (installers)

```bash
npx @pedrocivita/tocket init
npx skills add pedrocivita/tocket --skill tocket
tocket doctor
```

`tocket init` detects or asks once for preferred agents and writes `AGENTS.md` plus the matching instruction file (`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, …).
