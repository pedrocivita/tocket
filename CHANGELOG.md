# Changelog

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
