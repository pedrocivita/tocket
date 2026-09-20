# work fixtures

Static `tocket.decide/v0` records for `tocket work`. No live Jev.

```bash
tocket work --from fixtures/work/handoff.json
tocket work --from fixtures/work/handoff.json --apply
tocket work --from fixtures/work/shadow.json
tocket work --from fixtures/work/shadow.json --apply
tocket work --from fixtures/work/shadow.json --apply --force
```

`handoff.json` is an active queued write. `shadow.json` is log-only: dry-run is
OK, `--apply` needs `--force`. The worker never calls TypeSafe.
