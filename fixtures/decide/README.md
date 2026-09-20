# decide fixtures

Optional stub labels for `tocket decide`. No live Jev.

```bash
tocket decide --from fixtures/decide/state.json \
  --choice next:research,write,review \
  --noul needs_human_review \
  --dry-run
```

`--dry-run` and a missing `TYPESAFE_API_KEY` both use the deterministic stub
and still write `.context/decisions/<timestamp>-<id>.json`.
