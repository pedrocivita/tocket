# AppMaps

Index, last-run history, and a Memory Bank copy of the mapper AppMap.

`tocket suite loop` copies `<app>.appmap.json` here so status and triage
can read what Oficina wrote. Runners stay outside this directory.
`.context/appmaps/` is file-first: `tocket suite` does not execute maps.

| File | Purpose |
| --- | --- |
| `goals.md` | Suite goals and coverage intent |
| `<app>.appmap.json` | Mapper (or hand) map copy |
| `last-run.json` | Last run (`schema`: `tocket.appmaps.last-run/v0`) |
| `last-run.md` | Human-readable last-run table |
| `<app>.triage.json` | Optional Jev/heuristic triage (`tocket.appmaps.triage/v0`) |

## Tempestivita loop (Oficina)

Mapper lives in the sibling repo [pedrocivita/appmap-mapper](https://github.com/pedrocivita/appmap-mapper). Tocket does not vendor it.

1. In appmap-mapper: `npx tsx src/cli.ts all --url https://tempestivita.civita.dev --smoke`
   (writes `out/tempestivita.appmap.json`; optional live last-run from the suite runner)
2. In the workspace: `tocket suite loop --app tempestivita --mapper-out <mapper>/out --last-run <last-run.json> [--dry-run]`
3. `tocket suite status` (then open `<app>.triage.json` if the run had failures)

`--dry-run` uses the heuristic stub when `TYPESAFE_API_KEY` is missing. Writes stay under `.context/appmaps/`.
