# Changelog

## 2.6.5 - 2026-09-21

Meta-attention handoff: Jev judges chunks; workers read the filtered handoff. `tocket handoff --aware` splits `.context/` into small chunks, asks batched Noul `relevant` and Score `relevance` (stub without a key, live Jev with `TYPESAFE_API_KEY` + `--shadow`), and writes only the chunks at or above the threshold (default 0.5). Receipt: `.context/attention/`. Filtered markdown: `.context/handoffs/`. Without `--aware`, handoff is unchanged.

Conditional packs: markdown under `.context/gotchas/` (for example `frontend.md`, `path-src-api.md`, or `##` sections inside a file). `tocket packs load --query` asks Noul "load this pack?" and writes the overlay `.context/active/packs.md`. Harness your context. Jev is the judge. The flow stays decide, then work, then `tool_gate`.

```bash
tocket handoff --query "fix auth midflight" --aware
tocket handoff --aware --dry-run --to stdout
tocket handoff --aware --threshold 0.6 --query "fix auth midflight" --to stdout
tocket packs load --query "frontend form" --dry-run
tocket packs load --query "frontend form" --to stdout
```

## 2.6.4 - 2026-09-21

Windows path/init follow-up after 2.6.3. `toRepoRelative` is the shared posix display helper for CLI `wrote …` / `from=` lines (suite loop/triage, doctor last-decision, init created paths, decide/work). Decide tests assert destinations with `includesPath` so raw `outPath` backslashes do not fail. `tocket init` detects Cursor via case-insensitive `CURSOR_*` env flags; init tests isolate `HOME`/`USERPROFILE` so `~/.tocketrc.json` cannot hide env detection.

## 2.6.3 - 2026-09-21

Windows test/path fixes (2.6.2 never published successfully). Skill/template equality tests normalize CRLF so a checkout with `core.autocrlf` still matches LF generators. `toRepoRelative` (CLI `from=` lines, decide/work summaries, receipt `decision_path`) uses posix-style forward slashes on every OS.

## 2.6.2 - 2026-09-21

Tool-risk gate (file-first AutoMode *pattern*, no LangChain middleware). `tocket decide` can record `tool_gate` / `action_gate` as `allow|block|ask`. `tocket work --apply` refuses `block` and `ask` (exit 2; `ask` says escalate/human) unless `--force`. Shadow / log-only apply still needs `--force`. Jev (or the stub) is the judge; workers execute; Tocket does not run tools.

Installer docs + auto-config so `npm i` / `npx` ships ready context: README how-it-works, root `AGENTS.md`, skill rules, `TOCKET.md` decide/work section. `tocket init` writes `AGENTS.md` by default and the matching instruction file (detect existing files/env, flags, `~/.tocketrc.json`, or ask once on a TTY). `tocket doctor` checks `AGENTS.md`. Optional `TYPESAFE_API_KEY` (stub without it).

```bash
tocket init --executor Cursor --architect Gemini
tocket decide --from state.json --choice tool_gate:allow,block,ask --shadow
tocket work --from <decision>
tocket work --from <decision> --apply
```

## 2.6.1 - 2026-09-20

`tocket work` is the first-party reference worker: it reads a Choice from `.context/decisions/` and plans or stamps a notebook receipt. It does not call Jev or re-decide. Default is dry-run. `--apply` writes `*.applied.json` plus a `worker applied:` line in `progress.md`. Shadow / log-only apply needs `--force` (exit 2 otherwise).

## 2.6.0 - 2026-09-20

Notebook thesis in the README. New file-handoff commands; no Laya / laya-mlx.

### Added

- `tocket decide`: shadow-first Choice/Noul (optional Score) into `.context/decisions/`. Workers execute. Tocket does not.
- Light `tocket doctor`: `.context/`, decisions/appmaps, skill path, `TYPESAFE_API_KEY` yes/no, last decision, npm/bin. Exit 1 only when `.context/` is missing.
- Official skill (`skills/tocket/SKILL.md` catalog + `.agents/skills/tocket/SKILL.md`). One-shot: `npx skills add pedrocivita/tocket --skill tocket`.

### Docs

- README hero: project notebook, not a chat. Jev only picks among options.
- Tagline: Agents work · Tocket remembers · Jev only chooses the next step.
- 5-minute path: init → doctor → decide --dry-run → agents read `.context/decisions/`.

## 2.5.0 - 2026-03-02

- `tocket diff`, `tocket handoff`, payload persist, XML parser.
