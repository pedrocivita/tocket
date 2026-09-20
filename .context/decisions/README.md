# Decisions

Generic Choice/Noul records from `tocket decide`.

`decide` is generic (any state). `tocket suite triage` is suite-specific
(last-run failures). Suite loop still calls triage, not decide.

Writes stay under `.context/decisions/`. No app hooks, no runtime pollution.

| File | Purpose |
| --- | --- |
| `<timestamp>-<id>.json` | Decision record (`schema`: `tocket.decide/v0`) |

`--dry-run` uses the deterministic stub. `--shadow` may call Jev when
`TYPESAFE_API_KEY` is set but marks `mode: shadow` (does not claim execution).
