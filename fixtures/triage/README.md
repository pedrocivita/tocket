# POC C — suite triage fixtures

Small fixture set synthesized from a real Tempestivita `tocket.appmaps.last-run/v0` 8/8 pass snapshot. Some results were mutated to fail with timeout, missing locator, assertion, flake, and low-confidence-pass flavors.

| File | Purpose |
| --- | --- |
| `last-run.json` | Mutated 16-goal last-run used by the CLI and eval |
| `tempestivita-pass.last-run.json` | Unmodified 8/8 pass snapshot (object `evidence`) |
| `../triage-expected.json` | Human labels for the 15 triaged cases |
| `results.md` | Latest `npm run eval:triage` verdict |

```bash
npm run eval:triage
tocket suite triage --from fixtures/triage/last-run.json --include-low-confidence --dry-run
```

`--dry-run` and a missing `TYPESAFE_API_KEY` both use the deterministic heuristic stub and still write `.context/appmaps/<app>.triage.json`.
