# work fixtures

Static `tocket.decide/v0` records for `tocket work`. No live Jev.

```bash
tocket work --from fixtures/work/handoff.json
tocket work --from fixtures/work/handoff.json --apply
tocket work --from fixtures/work/shadow.json
tocket work --from fixtures/work/shadow.json --apply
tocket work --from fixtures/work/shadow.json --apply --force
tocket work --from fixtures/work/gate-allow.json --apply
tocket work --from fixtures/work/gate-block.json --apply
tocket work --from fixtures/work/gate-ask.json --apply
```

`handoff.json` is an active queued write. `shadow.json` is log-only: dry-run is
OK, `--apply` needs `--force`. `gate-allow.json` applies; `gate-block.json` and
`gate-ask.json` refuse `--apply` (exit 2) unless `--force`. The worker never
calls TypeSafe.
