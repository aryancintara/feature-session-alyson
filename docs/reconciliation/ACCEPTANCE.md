# Unified Reconciliation — acceptance register

Status: **original acceptance brief plus Phase 1 specification-derived checks; separate acceptance attachment not supplied**.
The only available acceptance text is in `user-uploads://We_are_adding_Unified_Reconciliation_to_the_pasted.txt:11`:

> Acceptance: every proposed source/table/column reference has a code/schema citation or is explicitly unresolved. No source access is claimed unless tested. No business records were changed. Return the discovery document and implementation plan grounded in the actual project.

## Brief-derived checks (not the missing acceptance file)

| Check | Evidence / status |
| --- | --- |
| Every domain mapping cites code/schema or is explicitly unresolved | DISCOVERY domain register, capability matrix and setup tasks; TypeScript models and snapshot migrations are not claimed as deployed schemas. |
| No source access is claimed without testing | No source data API or database was called in this pass. Connection/project metadata and code snapshots only; access and network remain untested. |
| No business records changed | Documentation, roadmap and guidance only; no schema, SQL writes, API writes, jobs, configuration or UI changes. |
| Existing Reconciliation retained | No edits to `src/routes/cost-revenue.reconciliation.tsx`; its two existing test files passed, 17 tests total. |
| Separate ingestion and independent evidence capability | DISCOVERY matrix explicitly tracks both and unavailable or untested detail. |
| Unknown mappings become setup tasks | DISCOVERY S01–S11; no guessed production relations, engines or joins. |
| Discovery and additive implementation plan returned | DISCOVERY plus the reviewable plan; implementation is gated on missing evidence. |
| Full intended design/acceptance faithfully captured | **Blocked S01:** full specification and acceptance attachments must be supplied before conformance can be assessed. |

## Proposed validation gates for later implementation

These are planning recommendations, not user-supplied acceptance criteria:

1. Approve a cited source/account/metric/grain mapping and a bounded read-only access test for each adapter.
2. Verify tenant authorization, timezone boundaries, currency/rounding and exclusion/deduplication semantics against service-owned fixtures.
3. Demonstrate independent evidence provenance; ingestion success alone never constitutes agreement.
4. Exercise each supported grain; unsupported/UI-only/manual/screenshot-only evidence must remain explicit, never silently synthesized.
5. Keep expected values, actual revenue, physical rows, business events and summary rows separate in comparisons.
6. Re-run current Reconciliation tests and its existing workflow after any approved future change.

## Phase 1 acceptance checks — derived from the 2026-10-23 upload

These checks translate `Unified_Reconciliation_-_Phase_1_UI_Enhancements_pasted.md` into testable behavior; they are not a separately supplied acceptance file. None is claimed implemented by this documentation update.

| ID | Required acceptance behavior |
| --- | --- |
| P01 | Existing route, navigation, three sources, completed UTC periods, exclusive request end, check action, cards and missing-record table remain in place. Existing direct/Lambda parsing tests pass. |
| P02 | Source evidence records distinguish automated queries, verified raw/export evidence and manual reports; unavailable capabilities do not produce synthetic totals. |
| P03 | Report requests carry an authorized source account, metric definitions, range, timezone, filters and precision; collection tasks can be created or linked through the actual task service. |
| P04 | CSV, XLSX and PDF upload, screenshot paste and table paste preserve the original evidence and present extracted values beside it. Parse failures retain the original and do not confirm values. |
| P05 | Screenshot-derived and pasted values cannot contribute confirmed evidence before authorized approval. Revisions retain their history and changing approved evidence invalidates the previous scope result. |
| P06 | Aggregate comparisons show source/Unified totals, counts, absolute differences, percentage differences and provenance. Zero-source percentage is explicitly undefined rather than fabricated or infinite; precision/tolerance definitions require service-owner approval. |
| P07 | Session coverage, missing records, duplicates, timestamp/timezone checks and joined-query validation have independent statuses. Equal aggregate totals cannot pass untested integrity checks. |
| P08 | Reconciled, Warning, Failed, Awaiting Evidence and Not Checked are distinct. Missing/unavailable/unreviewed evidence is never a confirmed mismatch; transport errors are distinct from failed reconciliation assertions. |
| P09 | Confirmed failures link investigation projects/tasks; missing evidence links collection tasks. Retries do not create duplicate tasks for identical scope and issue. |
| P10 | Results, original evidence, revisions, approvals and task links survive reload and authorized access from another browser. Browser Mark done data is not silently promoted to shared approved evidence. |
| P11 | Identical successful scope is reused by default. Approved evidence, transform or source-definition changes enable targeted revalidation; unrelated scope is unaffected. Concurrent requests do not duplicate successful runs. |
| P12 | Server-side access checks restrict reads, upload, approval, task creation and revalidation to authorized tenant/account/roles. Cross-tenant and unauthorized approval attempts are denied. No public file bucket or browser-asserted tenant identity. |
| P13 | Validate the authorized end-to-end report/upload/review/check/task/revalidation flow using approved bounded data. Fixtures prove behavior, not independent production verification. |
| P14 | No autonomous code changes, advanced anomaly detection, autonomous troubleshooting, amount edits, revenue locks, model redesign or guessed production schema is introduced. |

Current verification: the existing period/parser and attribution tests still pass (17 tests on 2026-10-23). P02–P13 require the additive workflow and verified dependencies; see PHASE1_GAPS.md.