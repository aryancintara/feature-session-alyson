# Unified Reconciliation — Phase 1 in-place enhancements

## Existing functionality and actual gaps

The existing screen already has HomeLight, Non-HomeLight and Phonexa; completed day/week/month selection; the exact Check period request; Source/Loaded revenue and counts; mismatch/missing-lead display; error handling; and a browser-only Mark done reminder. Its 17 period/parser/session tests pass.

Missing: source evidence collection and approval, evidence provenance, percentage/count differences, separate integrity checks, the five-state workflow, live task/project linking, durable history, account-aware authorization and revision-aware reuse/revalidation. The current check response cannot prove account identity, source reporting capability, freshness or join correctness.

The supplied Phase 1 specification is incorporated in SPEC, with derived checks in ACCEPTANCE. The detailed code-cited gap register is in PHASE1_GAPS.md. The app remains unchanged during this assessment.

## 1. Verify the existing service dependencies

- Obtain the service-owning repository and approved additive contracts for evidence/results, authorization and integrity checks; do not invent endpoints or production table mappings.
- Establish the real source-account/tenant mapping and authorized uploaders, reviewers and revalidation users. Keep other navigation usable signed out; do not reuse or expand the Leads-only sign-in guard.
- Confirm existing private file/result storage and a live Projects & Tasks service. Earlier snapshots contain mock providers, not verified integrations.
- Confirm metric/count definitions, currency, precision/tolerance, timezone/filter scope, source/report capabilities and source/transform revisions with bounded, authorized evidence.

These dependencies gate production implementation. Do not provision a substitute app/backend or display simulated production results while they remain unresolved.

## 2. Add source evidence below the existing comparison

- Retain the page, styling, navigation, selectors, dates, Check period action, Source/Loaded cards and missing-record tables.
- Add automated query, verified raw/export and manual-report evidence methods with explicit evidence status.
- Generate report instructions from authorized account, metric definitions, selected period, timezone, filters and precision. Request/link a collection task where evidence is missing.
- Support private CSV/XLSX/PDF uploads, screenshot paste and pasted report tables. Keep the original beside extracted values and flag extraction errors or ambiguous fields.
- Require authorized approval for screenshot-derived/pasted values before confirmation. Approval identifies reviewer, evidence revision, scope and time; editing evidence creates a new revision requiring review.

## 3. Add independent correctness and status checks

- Keep aggregate values at the top; show absolute and percentage revenue differences, count comparisons and provenance without changing the existing revenue model.
- Track aggregate checks, session coverage, missing records, duplicates, timestamp/timezone assertions and actual joined-query validation separately.
- Untested/unsupported integrity checks remain explicit; matching revenue never certifies joins.
- Introduce Reconciled, Warning, Failed, Awaiting Evidence and Not Checked. Missing evidence, unavailable queries and pending approval do not become confirmed mismatches. Request errors remain distinguishable from failed business checks.
- Create/link investigation projects and tasks only for confirmed failures; deduplicate links by authorized scope and issue. Missing evidence links collection tasks instead.

## 4. Persist history and targeted revalidation

- Persist immutable original evidence, revisions, extracted values, approvals, check results, independent statuses and task links using the verified existing services.
- Reuse identical successful scope by default. Scope includes tenant/account, source, metric/count meaning, UTC range, currency/timezone/filters and applicable revisions.
- Changes to approved evidence, relevant transformation or source definitions enable targeted revalidation; preserve prior history and leave unrelated scopes untouched.
- Enforce idempotency/concurrency server-side. Existing browser reminders remain labelled legacy reminders and are never silently imported as approved durable results or revenue locks.

## 5. Acceptance and real-flow verification

- Keep the existing 17 regression tests; implement the upload-derived ACCEPTANCE P01–P14 with concrete behavior tests.
- Test approval gating, revision invalidation, undefined zero-source percentages, count/revenue disagreement, untested joins, unsupported evidence, collection vs investigation task selection, duplicate prevention and cross-tenant/unauthorized-review denial.
- Verify the authorized end-to-end request/upload/review/check/history/task/revalidation flow with bounded approved input and read back the saved result from another session.
- Fixtures demonstrate logic only; claim production evidence verification only after the corresponding authorized service/source flow is tested.

## Technical boundaries

- Preserve POST `https://i4mf0v33aa.execute-api.us-west-2.amazonaws.com/reconcile/check`, its source identifiers, JSON request, exclusive end and direct/Lambda parser. Richer metadata and integrity results are additive service contracts, not inferred legacy fields.
- Keep credentials and parsing/integrity authorization in the service-owning environment. Never trust browser-supplied tenant/role claims or accept arbitrary SQL.
- Private evidence access and review require server-side authorization; original file retention, validation/limits and extraction processing must match the verified service conventions.
- No model redesign, revenue edits/locks, advanced anomaly detection, autonomous code changes or autonomous troubleshooting.

## Blockers and next step

Production work needs verified service contracts/ownership, authorized source-account and reviewer mappings, private storage, live task access and provenance/integrity definitions. The new upload supplies the intended Phase 1 workflow, but not these dependencies. Original separate acceptance files are still absent; the Phase 1 checks are explicitly derived from the supplied specification.

Approve this additive approach, then resolve the service/access gates before implementing production-backed workflow changes; no mock-only replacement is proposed.