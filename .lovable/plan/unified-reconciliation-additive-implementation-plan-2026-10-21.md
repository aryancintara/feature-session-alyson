# Unified Reconciliation — additive implementation plan

## Current result

The existing Reconciliation screen remains unchanged. Discovery documents now map code and read-only workspace snapshots, separating sample data, checked-in schema declarations, service contracts and unresolved production evidence.

The full specification and separate acceptance attachment were not supplied. The available brief is preserved without inventing missing requirements.

## 1. Resolve inputs and evidence

- Obtain the full specification and acceptance file; reconcile them with the existing screen requirements.
- Obtain authoritative source schemas, service/ingestion repositories, source-account registry, RDS engine/network metadata and approved bounded read-only access.
- Document ingestion/download separately from independent evidence for each account, metric and grouping, including UI-only/manual/screenshot evidence and unsupported detail.
- Resolve the discovery setup tasks for revenue/count definitions, session namespaces/joins, cost grain/allocation, experiments/features, freshness, auth/tenancy and jobs/tasks.

## 2. Approve the smallest first slice

- Keep the existing HomeLight/UCT/Phonexa check and browser-only Mark done unchanged.
- Select one fully evidenced source/account/metric/period; do not expand into unverified domains.
- Approve independent evidence and the physical-row/business-event/summary-row count definitions before comparing totals.

## 3. Add a reusable read-only interface

- Implement capability description and bounded evidence queries in the existing service-owning environment, only after ownership/runtime/auth review.
- Keep ingestion and evidence adapters separate; unsupported or blocked evidence remains explicit rather than synthesized.
- Return approved metric/count/date semantics and provenance without redesigning the revenue/cost/session model.
- Add service storage, shared completion or orchestration only if the missing full specification explicitly requires it; never treat browser completion as a revenue lock.

## 4. Validate before connecting new functionality

- Cite every production object/field and test source access without broad scans or record changes.
- Verify timezone/DST boundaries, currency/rounding, exclusions, ambiguity, deduplication, allocation conservation and tenant denial with approved fixtures.
- Confirm independent evidence support at each requested grain; ingestion success is not proof of reporting support.
- Preserve existing route/API behavior and re-run its tests and workflow after any approved implementation change.

## Technical details

The proposed interface is documented in `docs/reconciliation/DISCOVERY.md`, section 6. It is not a new endpoint or schema yet. No production relation, join, credential path, RDS engine or cross-project integration is assumed from frontend models or code snapshots.

## Blockers

Full specification/acceptance files, authoritative production metadata/service code, approved read-only source access, and source-account/metric/grain/auth mappings. Setup tasks S01–S11 in DISCOVERY identify the corresponding completion gates.