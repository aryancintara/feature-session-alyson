# Unified Reconciliation — supplied discovery brief

Status: **original discovery brief plus supplied Phase 1 specification**. The original separate specification/acceptance attachments remain unavailable; the Phase 1 requirements below are now supplied.
Source: `user-uploads://We_are_adding_Unified_Reconciliation_to_the_pasted.txt`, lines 1–11, received 2026-10-21.

The upload refers to an attached specification and an acceptance file, but neither separate attachment was present in the available upload inventory. This document preserves the supplied brief; it is **not a fabricated replacement specification**. Setup task S01 in DISCOVERY covers obtaining and incorporating both originals.

## Supplied brief (verbatim)

> We are adding Unified Reconciliation to the existing Unified Data app. Use the attached specification as the intended design. Do not build a substitute app or redesign the revenue/cost/session model.
>
> Inspect actual schemas, source registry, connection references, ingestion/transform code, session-key namespaces, revenue summaries, cost grain/allocation, experiment assignments, reporting views/API queries, model feature inputs, auth/tenant policies, jobs, errors, projects, and tasks. Read metadata and code; do not expose credentials or launch broad source scans.
>
> The Reconciliation screen already exists. It calls POST https://i4mf0v33aa.execute-api.us-west-2.amazonaws.com/reconcile/check for source_id homelight, uct, or phonexa, with a past start and end date. Keep that screen. Do not replace it.
>
> Create docs/reconciliation/SPEC.md from the supplied specification, docs/reconciliation/ACCEPTANCE.md from the acceptance file, and docs/reconciliation/DISCOVERY.md. In DISCOVERY, map each domain to actual relations/fields, business grain, independent evidence, event dates/timezones, keys, metric definitions, freshness, and production join paths. Identify actual RDS engines, network access, and missing dependencies. Record ingestion/download capabilities separately from evidence capabilities per source/account/metric/grouping, including UI-only reports, manual exports, screenshots, and unavailable day/hour/row detail. Do not infer reporting-query support from a functioning ingestion API. Distinguish source physical rows, expected business events, and Unified summary rows. Trace actual revenue versus predictions.
>
> List unknown mappings as blocked, with a setup task rather than a guessed answer. Propose the smallest additive architecture and a reusable query interface. Preserve current project knowledge when adding the supplied reconciliation constraints.
>
> Acceptance: every proposed source/table/column reference has a code/schema citation or is explicitly unresolved. No source access is claimed unless tested. No business records were changed. Return the discovery document and implementation plan grounded in the actual project.

## Existing-screen invariants, not a new design

- Existing route, source choices, completed UTC periods, and exclusive request end date remain intact.
- Direct and Lambda-wrapped responses remain supported.
- Mark done is a browser reminder only; no locking, rule picker, or final amount field.
- Source totals and missing leads are service results, not frontend reconstructed joins.
- No other screen, source connection, policy, service or business record is changed by this discovery.

Code evidence and unresolved production semantics are catalogued in DISCOVERY.

## Phase 1 specification — received 2026-10-23

Source: `user-uploads://Unified_Reconciliation_-_Phase_1_UI_Enhancements_pasted.md`. The following is the supplied Phase 1 specification, not inferred production capabilities.

### In-place changes

Update the existing Reconciliation UI in place. Preserve its current styling, navigation, source selectors, date selection, Check Period action, Source and Loaded comparison cards, mismatch display, and missing-record tables wherever possible. Do not rebuild the page from scratch.

### Source evidence collection

Add a source evidence method and evidence status. Support automated source queries, verified raw/export evidence, and manual source reports.

When a source cannot provide the required aggregate query, allow users to request a report, upload CSV/XLSX/PDF files, paste screenshots, or paste report tables. Provide report instructions that specify account, metrics, date range, timezone, filters, and required precision.

Show extracted values beside the original evidence. Require approval of screenshot-derived and pasted values before using them as confirmed reconciliation evidence.

### Reconciliation correctness

Keep aggregate comparisons at the top. Display source values, Unified values, absolute differences, percentage differences, count comparisons, and evidence provenance.

Separate aggregate checks from session ID coverage, missing/duplicate record checks, timestamp/timezone checks, and actual joined-query validation. Matching aggregate totals alone must not certify join integrity.

### Status and error handling

Distinguish Reconciled, Warning, Failed, Awaiting Evidence, and Not Checked. Do not treat missing evidence, unavailable queries, or unreviewed screenshots as confirmed data mismatches.

Confirmed failures should create or link investigation projects and tasks. Missing evidence should create or link source-report collection tasks.

### Persistence and reconciliation-once behavior

Persist results, evidence revisions, approval history, and task links. Do not repeatedly reconcile identical successful scope by default. Support targeted revalidation when approved evidence, relevant transformations, or source definitions change.

### Scope

Implement the UI, backend logic, data persistence, access control, and acceptance tests needed for this workflow. Reuse existing project conventions and services. Do not present mock comparisons as production verification.

Keep autonomous code changes, advanced anomaly detection, and fully autonomous troubleshooting outside the initial release.

Before modifying code, inspect the existing implementation and identify which requirements are already satisfied. Report the actual gaps and implement only the necessary changes.

### Relationship to the legacy screen

The new durable workflow supersedes browser-only persistence for Phase 1, but existing browser reminders are not approved shared results and must not be imported as production verification. Preserve the legacy endpoint and controls; richer evidence, authorization and validation require additive, approved service contracts. The original independent acceptance attachment is still missing; Phase 1 acceptance checks are derived from this upload and labelled accordingly.