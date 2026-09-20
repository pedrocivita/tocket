# Decisions

Generic Choice/Noul handoff records from `tocket decide`.

This is Tocket's file-handoff cousin of Codila's `chief.py` queues
(https://x.com/0xCodila/status/2100984487802708306). State + Choice
(optional Noul) via TypeSafe; the CLI writes a JSON the worker reads later.
Tocket does not run the workers.

`decide` is generic (any state). `tocket suite triage` is suite-specific
(last-run failures). Suite loop still calls triage, not decide.

Writes stay under `.context/decisions/` (optional `research|write|review`
subfolder when the Choice maps cleanly). No app hooks, no runtime pollution.

| File | Purpose |
| --- | --- |
| `<destination>/<timestamp>-<id>.json` | Handoff record (`schema`: `tocket.decide/v0`) |

Research/write route only when confidence >= 0.85 (configurable).
Below that, `destination` is `review` (`gated: true`).

`--dry-run` uses the deterministic stub. `--shadow` may call Jev when
`TYPESAFE_API_KEY` is set but marks `semantics: log-only` (does not claim execution).
