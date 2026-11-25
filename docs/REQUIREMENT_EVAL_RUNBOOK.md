# Requirement evaluation runbook

Run these commands from the Course Radar root with the local PostgreSQL datasets, Python requirements (`scripts/requirements-import.txt`) and npm dependencies installed.

## Requirement records

`api/prisma/data/requirements/2026-2027/checked.json` holds the checked requirement records for the ten in-scope majors and the campus-wide requirements. The API reads it at startup (`api/src/requirement-records.ts`; override the path with `REQUIREMENT_RECORDS_PATH`). Each record quotes its SJSU source verbatim. The cited source pages are committed under `data/sjsu/2026-2027/programs/sources/`; the rest of `data/` stays ignored.

```powershell
python -B -m scripts.requirement_records --check-tracked   # every cited page is committed, and nothing extra
python -B -m scripts.requirement_records                   # validate records against the schema and saved sources
python -B -m scripts.planner_parity                        # assistant lists match the Planner for all ten programs
```

After changing a record or a source page, rerun all three, then restart the backend (`npm run dev:backend:restart`) so the API reloads the snapshot.

## Practice evaluation

```powershell
$base = 'http://localhost:5175'
$run = 'tmp/req10-runs/practice-next'
python -B -m agent_service.evals.req10_runner --split practice --concurrency 1 --base $base --out $run
python -B -m agent_service.evals.req10_score --run $run
```

Use a new output directory per run, and run only the cases you need (`--help` lists the filters). A full 155-case practice pass costs about $1.30–$1.50. Check the case count and `term_snapshot_drift` in `report.json` before comparing runs.

## Private test sets

Held-out and hidden test sets are kept outside this repository by the evaluator. Never commit them, and never give their location or contents to an agent that changes code. Agents receive only aggregate results.

## Labels

| Label | Meaning |
| --- | --- |
| `correct` | The answer matches the frozen evidence. An appropriate clarification or schedule gap can also be correct. |
| `wrong` | A material claim, course set, scope, or conflict disclosure differs from the frozen expectation. |
| `no_answer` | The question was answerable and the reply failed to give the substantive result. |
| `unverified` | The result appears plausible or correct, but the supplied citations do not establish it. |
| `system_error` | Transport, timeout, or service failure prevented a usable reply. |
| `unscored` | The scorer produced no label. Include it in coverage reporting. |

Known limits: exact course lists are scored by code, other claims by an LLM judge. About half of the label changes between identical runs came from judge disagreement, so compare course-list results first.
