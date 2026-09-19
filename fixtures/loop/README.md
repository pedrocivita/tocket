# Tempestivita suite loop fixtures

Minimal mapper-shaped AppMap plus a last-run with two failures (locator + timeout). Used by `tocket suite loop` tests.

```bash
tocket suite loop --app tempestivita \
  --map fixtures/loop/tempestivita.appmap.json \
  --last-run fixtures/loop/last-run.json \
  --dry-run
```
