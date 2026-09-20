# decide fixtures

Optional stub labels for `tocket decide`. No live Jev.

```bash
tocket decide --from fixtures/decide/state.json \
  --choice next:research,write,review \
  --noul needs_human_review \
  --dry-run
```

`--dry-run` and a missing `TYPESAFE_API_KEY` both use the deterministic stub
and still write a handoff under `.context/decisions/`. Stub confidence for
this fixture is below 0.85, so `destination` is `review` (Codila gate).
Optional `--score` batches in the same request. Jev does not write or execute.
