---
name: tocket
description: Shared .context/ notebook. Before expensive tools, run tocket decide --dry-run or read .context/decisions/. Workers execute; Tocket does not.
---

# Tocket

Tocket is the shared project notebook (`.context/`). Agents read and write those files. `tocket decide` writes the next move as JSON. Workers (Cursor, Claude, GrokBot, CI) execute. Tocket does not.

**Before expensive tools: tocket decide --dry-run, or read .context/decisions/.**

Harness your context. Jev is the judge, not the writer. Meta-attention handoff: Jev judges chunks; workers read the filtered handoff.

## When to use

- Read `AGENTS.md` and `.context/` before expensive tools.
- If `.context/decisions/` already has a handoff, honor it. Do not re-ask Jev.
- `tocket decide` = judge (Jev or stub). `tocket work` = plan. `tocket work --apply` = receipt.
- Honor `tool_gate` (`allow|block|ask`). Before bash/deploy/browser: `--choice tool_gate:allow,block,ask`, then `tocket work`.
- `tocket handoff --aware --query "..."` filters `.context/` chunks. Receipt: `.context/attention/`. Filtered handoff: `.context/handoffs/`.
- Gotcha packs live in `.context/gotchas/`. `tocket packs load --query "..."` writes `.context/active/packs.md`.
- After work: update `.context/activeContext.md`.

## Setup

```bash
npx @pedrocivita/tocket init
npx skills add pedrocivita/tocket --skill tocket
tocket doctor
tocket decide --dry-run --state '{"goal":"docs"}' --choice next:research,write,review
```

- Optional `TYPESAFE_API_KEY` for live Jev. Never paste API keys into chat.
- Prefer `--dry-run` or `--shadow` first.
- Run `tocket doctor` for green/yellow/red setup checks.

## Do not

- Do not ask Tocket to write prose, do math, or run workers.
- Do not rebuild the app around Jev. Swap this decision node in.
