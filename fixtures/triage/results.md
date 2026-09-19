# POC C — suite triage eval

## Verdict

| Surface | Verdict | Why |
| --- | --- | --- |
| Dry-run heuristic stub | **PASS** | 15/15 (100.0%) vs ≥80%; unstable 0.0% |
| Live Jev Choice | **GRAY** | TYPESAFE_API_KEY unset; System One was not scored |
| Hypothesis as stated (Jev ≥80%) | **GRAY** | Needs a live key run on the same fixtures |

Kill not triggered on the stub: agreement is above chance (25.0%) and naive if-else (40.0%); instability is below 30%.

Hypothesis: a Jev Choice among {retry, escalate, ignore, rewrite-locator} agrees with a human-labeled judgment ≥80% on a small fixture set.

| Metric | Value |
| --- | --- |
| Cases | 15 |
| Heuristic agreement | 15/15 (100.0%) |
| Naive if-else agreement | 6/15 (40.0%) |
| Chance (4-way) | 25.0% |
| Unstable (2 identical runs) | 0/15 (0.0%) |
| Live Jev | not scored (TYPESAFE_API_KEY unset) |

## Reasons

- Dry-run heuristic agrees with human labels on 15/15 (100.0%), beats chance (25.0%) and naive if-else (40.0%), unstable 0.0%.
- Live Jev Choice was not scored (no TYPESAFE_API_KEY in this eval). Hypothesis for live Jev remains GRAY.

## Sample disagreements

| ID | Expected | Got | Flavor |
| --- | --- | --- | --- |
| _none_ | | | |

## How to reproduce

```bash
npm run eval:triage
tocket suite triage --from fixtures/triage/last-run.json --include-low-confidence --dry-run
```
