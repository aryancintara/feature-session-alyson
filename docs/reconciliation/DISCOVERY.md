# Unified Reconciliation — evidence-grounded discovery

Date: 2026-10-21 UTC; Phase 1 requirements addendum reviewed 2026-10-23 UTC. Scope: documentation and read-only code/metadata investigation; **no application or business-record changes**.

## 1. Result and evidence boundary

Keep the existing Reconciliation screen. Its active code calls the supplied check URL for `homelight`, `uct`, or `phonexa`; the broader reconciliation architecture is not yet implementable from verified production metadata.

- The original investigation received only the discovery brief. On 2026-10-23 the Phase 1 UI Enhancements upload supplied the evidence/review/persistence/access-control workflow, now preserved in SPEC; ACCEPTANCE adds explicitly specification-derived checks. The original separate acceptance file remains missing, and no production service/access evidence was supplied. See PHASE1_GAPS.md.
- Standard connector listing returned no available connections. This does not prove sources do not exist or that permissions were denied. No new connection was linked.
- Workspace project metadata and four read-only code snapshots were inspected. Their source metadata/DDL is useful evidence, **not deployed-schema or access verification**.
- No source API/database requests, broad scans, ingestion jobs, writes, or credential reads were performed. Source access, RDS engine/version and network connectivity remain **untested**.
- Existing reconciliation tests passed: 13 period/parser tests and 4 attribution tests. Fixtures prove frontend behavior, not source completeness.
- Historical HomeLight success is recorded in `roadmap.md` (entry beginning “Connect the exact Reconciliation check URL…”); it was not independently repeated and cannot prove Phonexa/UCT or independent source access.

### Citation convention

Unprefixed paths refer to this Unified Data checkout. Other-project citations use these snapshot labels and repository-relative paths:

| Label | Workspace project | Snapshot commit reported by checkout |
| --- | --- | --- |
| SOURCES | Alyson Sources (`93bc52e1-eff8-4969-8ef5-4a237c85e386`) | `93787c3d` |
| TASKS | Alyson Projects & Tasks (`a3917ab4-2d3d-4a5e-bf56-6070a90a69eb`) | `5ffea0e9` |
| ML | Alyson ML Studio (`263ba024-bb4c-49ae-a988-a1abeebb45a7`) | `0ff6fb7b` |
| MARKET | Alyson MarketOS (`f0bc968c-0383-4111-af26-4a873a434b8e`) | `92a065fc` |

Snapshot commits are tool-reported, not verified through snapshot Git metadata. Cross-project shared tenancy and data connections are unresolved. Other accessible projects were listed, not inspected: Alyson PM version 2.0, Deployment and QA Agent, Acquire SEM. Further inspection is scoped by S10, not presumed integration.

Evidence classes: **CODE** = executable path/client contract; **DDL** = checked-in migration only; **MOCK** = sample/generated state; **REQUIREMENT** = supplied semantics awaiting schema proof; **BLOCKED** = unresolved production mapping. None implies tested source access.

## 2. Existing check: verified code contract

`src/routes/cost-revenue.reconciliation.tsx:1–666` preserves the prior UI as comments; active code begins at 668. Active metadata at 678–687 remains unchanged.

| Aspect | Code evidence |
| --- | --- |
| Sources and result fields | `:690–695`: three source identifiers; numeric source/loaded lead and revenue totals, `difference`, boolean `matched`, `missing[].lead_id/revenue`. |
| Dates | `:699–725`: UTC calendar dates; completed day, Monday–Sunday week or completed month; inclusive displayed range, exclusive request end; today rejected. |
| Endpoint | `:854–868`: POST `https://i4mf0v33aa.execute-api.us-west-2.amazonaws.com/reconcile/check`, JSON header/body; no credential/auth header in this handler. Backend authorization and tenant isolation are unresolved (S09). |
| Response | `:727–750`: shape validation and direct/Lambda `statusCode` plus string `body` parsing. Finite numbers required; currency precision and difference sign are not defined by this validator (S04). |
| Completion | `:696,798–807,810–813,869–877`: browser-local matched source/start/end result; no API write or revenue lock. Cache key is not account/tenant-qualified; do not extend to shared/account-aware completion without an approved identity model (S09). |
| UI | `:905–950`: source selector, returned totals/counts, unavailable/matched/not-matched state and missing list; intentional exclusions stated. |

The active API does **not** return account identity, event-time column, source physical-row count, business-event definition, currency, watermark, query revision, evidence identifier, or join lineage. These cannot be reconstructed in the browser. Preserve this contract; any richer interface is a separate additive proposal.

## 3. Domain mapping register

### Source registry and connections

- Current app Sources is MOCK: `src/routes/sources.tsx:4,30–43,86–110` consumes sample `DATA_SOURCES`. Unified Revenue source metadata at `src/lib/unifiedRevenueData.ts:39–43` is likewise MOCK, not a production registry.
- SOURCES DDL `supabase/migrations/20260609204214_8617ee06-6f2f-4921-bc8d-cb4addfecf45.sql:29–62` declares `public.sources` identity/type/ownership/status/flow metadata, counts, `pipeline_raw`, `pipeline_optimized`, `pipeline_unified`, and `oauth_connected`. Grain is one declared source-registry entity, not a business event. `:64–134` declares related daily metrics/issues/alerts/tasks/insights metadata.
- SOURCES `src/lib/sources.functions.ts:67–89` reads registry/metric/issue data; `:183–203` contains update paths, not executed. `src/lib/seed.server.ts:33–60` supplies example connected Google Ads metadata. An `oauth_connected` boolean is **not a credential reference or successful provider test**.
- Account identifiers, physical provider connection IDs, metric/grouping capabilities, deployed registry mapping to this app and source-specific freshness: BLOCKED S02/S03.

### Revenue sources, business events and summaries

- CODE constants `src/lib/rulesApi.ts:19–27` reference `sampledb.revenue_leads_plus` and `raw.raw_tune_clicks` plus rule fields. These are API/wizard references, not introspected tables.
- REQUIREMENT from existing reconciliation knowledge: HomeLight totals use `revenue_leads_plus.expected_revenue` with positive `revenue`; UCT uses `uct_revenue.expected_revenue_vendor` with `connector_id = 37` and positive `revenue`; loaded totals use `cost_revenue.revenue_events`. Missing-lead exclusions involve `our_session = no` or blank `utm_content`. These physical names/columns are **unresolved as deployed schema**; S02/S04 must cite backend SQL/DDL. The active check only sends source aliases, not these queries.
- Phonexa source alias is CODE (`reconciliation.tsx:691,907–909`), but its physical relation, revenue metric, connector/account and eligibility rules are BLOCKED S04. Its displayed “expected vendor revenue” label at `:920` is not proof of the Lambda formula.
- `cost_revenue.click_session_observations` is a prior requested relation, **unresolved production mapping** S05. The display helper consumes optional response `utm_content`, `session_id`, `session_id_source`, `our_session`, and observation session IDs (`reconciliation.tsx:753–785`); it does not query that relation.
- MOCK summary model `src/lib/unifiedTablesData.ts:43–76` has `tenant_id`, `revenue_summary_id`, object/source/source-row IDs, `session_id`, `lead_id`, order/customer/conversation/transaction IDs, lifecycle money, predictions and timestamps. `:180–227` generates 120 examples. Grain in this sample is one generated revenue-summary row; production summary cardinality and deduplication are BLOCKED S04/S05.
- Distinguish three quantities in later comparisons: **physical source rows** (may be snapshots/duplicates), **eligible business events** (requires event identity and exclusion definition), and **Unified summary rows** (may aggregate events). Neither returned `source_leads` nor `loaded_leads` establishes which count definition the backend uses. Do not equate the three.

### Actual revenue versus predictions

- MOCK fields in `unifiedTablesData.ts:60–70,209–219`: gross, refund, credit, adjustments, net, estimated, earned, invoiced, received, `best_current_order_prediction`, `best_lifetime_prediction`. The generator computes each separately; it is not accounting policy or model lineage.
- Current check labels expected revenue and loaded revenue, not recognized/received actual revenue (`reconciliation.tsx:920–926`). Equal expected/loaded totals do **not** establish actual accounting settlement or prediction accuracy.
- Production actual amount, predicted amount, observation/settlement date, prediction as-of/horizon, currencies, rounding, reversals and model/version lineage: BLOCKED S04/S08. No forecast-versus-actual comparison is proposed as verified.

### Costs and allocation

- `src/lib/costRevenueData.ts:1–28,34–49,131–161` explicitly provides MOCK processed events with session/source-record/rule/version/amount/inputs. Tune illustrative inputs include click/session counts and payout; this does not prove production cost grain, unit conversion or allocation conservation.
- MARKET `src/routes/_app.agent-coverage.tsx:109–165` calculates market cost/revenue/profit and budget assignments in frontend code. MARKET `src/lib/store.ts:175–185` persists local state; neither is a production allocation feed.
- Cost source physical row, click/campaign/day/hour/account grain, `payout_cents` unit conversion (a rules contract reference), allocation weights, denominator, unattributed remainder and revenue/cost join path: BLOCKED S06. Never divide or duplicate cost across sessions based on sample behavior.

### Session namespaces and production joins

- CODE Athena SQL targets `"unified"."unified_session_summary"` and filters/orders `session_start`: `src/lib/athenaSessions.server.ts:126–138`. This is an existing query path, **not a successful query test or verified catalog**. Server validation bounds inputs and results to 1–1000 (`src/lib/athenaSessions.functions.ts:4–35`).
- MOCK/session models expose `session_id`, timing, entry UTM including `entry_utm_content`, and click IDs: `src/lib/sessionData.ts:35–72,110–151`; `src/lib/sessionMockRows.ts:1–7,109–145` explicitly models sample Athena-shaped rows.
- Attribution helper at `reconciliation.tsx:763–785` treats click ID as lookup, deduplicates other observed sessions and never changes amounts. It does not prove the bridge SQL or canonical session namespace.
- Production source click → observation/bridge → canonical session → revenue summary joins, key collision rules, tenant/account scoping, 1:many handling, new-session creation and temporal stitching window: BLOCKED S05. Similar field names are not approved joins.

### Leads and properties reporting

- CODE `src/lib/unifiedLeadsApi.ts:1–5,16–28,59–60,103–119,150–155`: dedicated browser UI API, Cognito bearer plus username `client_id`, PST-named date fields, lead IDs and optional stage provenance, pipeline timestamps. Backend physical relations/views and count/deduplication semantics are BLOCKED S02/S07.
- CODE `src/lib/unifiedPropertiesApi.ts:1–4,15–23,67,87–136`: separate API, conditional `x-api-key`, property/source/event fields including `observed_at`, `updated_at`, `event_date`, pipeline metadata. Property source IDs/listing/MLS relationships shown in `src/routes/unified-properties.index.tsx:181–182,211–212,246–259` do not establish cross-domain joins.
- Leads reports use Pacific/PST-labelled fields; properties client formats Los Angeles time. Confirm daylight-saving and naive timestamp handling per backend; do not apply the Reconciliation UTC day to these reports without a specified conversion (S07).

### Identity reports and freshness

- `src/lib/identityApi.ts:1–3,260–279` declares dummy query factories. Separate `src/lib/identityLiveApi.ts:1–12,76–85` documents live API/open CORS and process-date/freshness fields. Both implementations coexist; current route imports must determine the actual report path, not file names alone (S07).
- Reporting/API-health contracts expose requested reporting grain and pipeline timestamps, not independent freshness proof. `src/lib/identityReportingCache.ts` provides a client reporting cache; a cached display must not become a source watermark (S07).
- Raw provider freshness, ingest/download completion, transform watermark, reporting materialization time and evidence as-of must be independently identified. Current UI health labels do not prove all stages complete.

### Experiments and model inputs

- MARKET `src/components/marketos/mock.ts:1–18,35–70` contains deterministic sample KPIs and a shadow-test recommendation, not persisted randomized assignments.
- ML `src/lib/mock-data.ts:23–123` supplies datasets/columns/features/experiments with sample lineage/metrics. `src/lib/store.ts:1–8,42–60` holds seeded state. `src/routes/experiments.tsx:78–86` describes a Lead+Session join but supplies no reproducible join or input manifest.
- Production assignment relation/fields, randomization unit, eligibility, exposure time, variant, model feature inputs/as-of leakage rules, dataset/feature version and output lineage: BLOCKED S08. These snapshot labels are not evidence of a production experiment or feature-store join.

### Jobs, errors, projects and tasks

- TASKS DDL `supabase/migrations/20260811205510_13cd221a-5cf9-41bd-a3ff-55aa923f2ebd.sql:46–50` declares projects; `:519–520,544–551` declares project/task/attempt indexes. Index citations do **not** resolve complete task/attempt schemas.
- TASKS CODE `src/domain/execution.ts:145–192,198–242` defines tasks, retry attempts and attempt error `code/message/retryable/stack`; `src/domain/observability.ts:689` begins the distinct error-group contract. `src/domain/planning.ts:74–85` defines project interfaces.
- TASKS `docs/aws-api-contract.md:99–108,118–131` lists task/error-group API operations; `docs/architecture/current-state.md:6–21` says AWS API not yet live. `src/services/backend/providers/MockBackend.ts:17–24,288–293` is explicitly network-free fixtures. No real reconciliation project/task was created or observed.
- Follow-up on 2026-10-23: the current TASKS snapshot (tool-reported `1c85351e`) also implements OAuth App MCP and Supabase-backed operations; App MCP is advertised but not connected/tested. AWS HTTP remains gated inactive and private evidence upload remains unestablished. See PHASE1_GAPS.md for fresh code citations; the older snapshot above does not describe every current provider.
- SOURCES `pipeline_*` counters are metadata, not ingestion/transform code. Current Unified Revenue pipeline runs/issues are MOCK (`src/lib/unifiedRevenueData.ts:31–37,104–120`). Production schedules, watermarks, run IDs, retries, errors and task linkage: BLOCKED S10.

### Authorization, tenancy, engines and network

- Current Leads browser auth uses Cognito (`src/lib/unifiedLeadsAuth.ts:18–40`; client header/query at `unifiedLeadsApi.ts:16–28`). Properties key use and Identity open-access comments are client behavior, not backend tenant policy proof.
- TASKS DDL permission rules `supabase/migrations/20260811233721_d5de8353-08b1-4595-a3df-c9e02e79d9b0.sql:35–53,74–85` scope permissions by tenant role and operation/table groups. SOURCES DDL policy/grant declarations at its registry migration `:59–62,72–90` are checked-in policy evidence only, not authority to join tenants across projects.
- Current runtime is Cloudflare/TanStack (`wrangler.jsonc:1–7`); Athena helper gateway configuration at `athenaSessions.server.ts:5–25,56–69` is not an RDS connection.
- Supabase-oriented migrations in other snapshots are PostgreSQL-style schema evidence, **not evidence of an AWS RDS engine**. Actual RDS engine/version, instance/proxy, region/VPC/subnets/security groups/TLS/DNS and permitted network path are BLOCKED S02. No socket or service connectivity tested.

## 4. Ingestion versus independent evidence capability matrix

All account identities are unresolved. Groupings below describe what this code offers, not provider-supported reporting. No functioning ingestion API was tested; no reporting support is inferred from it.

| Source/account | Ingestion/download evidence | Independent evidence by metric/grouping | Day/hour/row detail, UI/manual/screenshots | Status/setup |
| --- | --- | --- | --- | --- |
| HomeLight / account unresolved | Relation references in rules contract; ingestion implementation absent | Existing period revenue/count check CODE, no independent upstream report path | UTC period check available in UI; upstream day/hour/row report, manual export and screenshot evidence unknown | Untested S03/S04 |
| UCT/non-HomeLight / account unresolved | Existing UCT semantics REQUIREMENT; Tune ingestion relation reference is not proof of UCT lineage | Period expected-vendor/loaded totals CODE; provider corroboration absent | Missing-lead list CODE; complete physical-row evidence, hourly report, manual/UI access unknown | Untested S03–S05 |
| Phonexa / account unresolved | Alias in check UI only; loader/download capability unknown | Period check CODE; metric formula and independent report unknown | Provider day/hour/row support, manual exports and screenshots unknown | Blocked S03/S04 |
| Tune cost / account unresolved | `raw.raw_tune_clicks` CODE reference; loader not present | No verified independent cost report, allocation grain or denominator | API/download/UI-only/manual/screenshots and hour/day/row support unknown | Blocked S03/S06 |
| Google Ads / account unresolved | SOURCES seeded connected flag; not an ingestion implementation | MARKET sample metrics are not independent Google Ads evidence | No report call or export implementation verified; UI-only/manual/screenshots unknown | Blocked S03 |
| Unified Leads / tenant unresolved | Dedicated list/detail/events/export client CODE; no underlying ingestion inspection | API report is downstream, not independent source corroboration | Client export/pagination code exists; no export executed; provider report access unknown | Untested S07/S09 |
| Unified Properties / account unresolved | Property/source/events client CODE; loader absent | Separate API/pipeline reports CODE, not independent property-source evidence | API fields shown; original source UI/manual/screenshots and hourly support unknown | Untested S07 |
| Sessions / tenant unresolved | Athena SELECT path CODE, not an ingestion/download test | No independent click/visit measurement established | Bounded row query exists in code; no query executed; day/hour aggregation unresolved | Untested S02/S05 |
| Identity / tenant unresolved | Dummy and live clients coexist | Report clients/code not proof of trusted reference data joins | Granular API contracts exist; current wiring/independent export evidence unresolved | S07 |
| ML / experiment account unresolved | Seeded datasets, no verified input loading | Mock metrics and experiments, no independent outcome evidence | Displayed rows/metrics only; reproducible input/export manifest absent | S08 |

Unsupported detail must not be filled by allocating a daily number to hours or multiplying summary rows. Unknown is not “unavailable at the provider”: mark **untested** until an authorized capability check proves supported, UI-only, manual export, screenshot-only, or unavailable. Screenshots may be retained as labelled human evidence, never represented as row-level query results.

## 5. Setup tasks and blockers

These are proposed setup tasks, not records created in Alyson Projects & Tasks.

| ID | Blocker / requested evidence | Completion gate |
| --- | --- | --- |
| S01 | Phase 1 workflow now supplied; original separate specification/acceptance attachments remain missing | Use the supplied Phase 1 workflow and labelled derived acceptance checks; obtain originals if they govern broader conformance. Production implementation still needs the relevant service/access gates. |
| S02 | Missing authoritative catalog, RDS engine/network metadata and approved read-only access | Owner supplies bounded schema/DDL, engine and network facts plus service repositories; verify relevant objects only, no broad scans or secrets in docs. |
| S03 | Source/account and ingestion-versus-evidence capabilities unresolved | Record each account/metric/grouping/grain, actual ingestion code, independent report/API/UI/manual evidence and one authorized bounded capability test. |
| S04 | Revenue/count definitions and physical-event-summary mapping unresolved, especially Phonexa | Cite actual check Lambda SQL/DDL, eligibility, event date/timezone, deduplication, currency, rounding/difference sign and expected versus actual meanings. |
| S05 | Canonical session namespaces, bridges and production joins absent | Cite service join code, key scope/cardinality, ambiguity/exclusions and bounded fixtures demonstrating conservation without duplicate revenue. |
| S06 | Cost grain/unit/allocation unresolved | Cite cost ingestion and allocation code plus conservation fixture and independent cost evidence. |
| S07 | Reporting materialization, identity wiring and freshness lineage unresolved | Cite active API handlers/views and watermark/cache/UTC-Pacfic conversion rules; verify date boundaries, DST and supported report/export grain. |
| S08 | Experiment assignments, actual/predicted outcome and feature-input lineage absent | Obtain assignment/exposure schema and versioned as-of feature/input/output manifests; prove approved join paths. |
| S09 | Backend auth/tenant/account mapping unresolved | Inspect API policies and approved read-only fixtures; verify cross-tenant denial; define account-aware query context without changing current browser reminder semantics. |
| S10 | Production jobs/errors/project-task linkage not located | Obtain orchestrator/repository/run metadata and error schemas; inspect remaining workspace projects only where needed; do not create tasks or trigger jobs during discovery. |
| S11 | Broader implementation approval depends on S01–S10 relevant to first slice | Approve minimal adapter scope and evidence gates; do not extend current check or add storage/UI until requirements and dependencies resolve. |

## 6. Smallest additive architecture (proposal only)

1. **Preserve** the existing check screen/service contract. Phase 1 explicitly requires durable completion/history; existing browser reminders retain their legacy meaning and must not be promoted to approved shared results. No replacement route, lock, rule selector, amount override or model rewrite.
2. Start with documentation-backed capability entries and a single reusable read-only query interface in the existing service-owning environment. Do not introduce a new database, RDS client or credential path into this app merely for discovery.
3. One adapter wraps the already-owned check service; additional source-evidence/reporting adapters require S02/S03. Keep ingestion adapters separate from independent evidence adapters even when they share a provider.
4. Add optional provenance/capability metadata via an approved additive service contract, not by fabricating extra fields in current responses. No new production table/column is proposed as resolved here.
5. Shared results report physical/business/summary count kind, metric class, period/timezone/grain, evidence as-of and join/query revision. Unsupported queries return explicit capability outcomes; they never fall back to synthetic data.
6. Phase 1 now explicitly requires persistent results, evidence revisions, approvals and task links. Add these in the existing authorized service-owning environment after verifying authorization/storage ownership and contracts; no such deployed service is proven here. This is not equivalent to browser Mark done and cannot silently certify its legacy reminders.

### Reusable query interface — conceptual, not an implemented API

```text
describeCapabilities(authorizedContext, sourceAccountRef)
  -> ingestionCapabilities + independentEvidenceCapabilities
     [metricRef, groupingRefs, timeGrain, dateSemantics, evidenceMode,
      accessTestStatus, freshnessDefinition, citationRefs, blockerRefs]

queryEvidence(authorizedContext, {
  sourceAccountRef, registeredMetricRef, inclusiveStart, exclusiveEnd,
  timezone, grain, approvedGroupingRefs, approvedFilters, countKind,
  boundedLimit, cursor
})
  -> supported | unsupported | blocked | failed
     + typed totals/rows when supported
     + provenance { evidenceMode, asOf, sourceRevision, queryRevision,
                    metricClass, currency, countKind, citations }
```

The names above are proposed interface properties, **not physical schema columns or an existing service contract**. Authorized context is established by the service, never trusted from browser-supplied tenant IDs. Registered metric/grouping references resolve only to reviewed adapter definitions; no user-supplied arbitrary SQL/table names. Credentials stay in their existing authorized service boundary. Query bounds and deployment runtime requirements must be reviewed before implementation.

`sourceAccountRef` is unresolved for every current source; no placeholder account is a valid production mapping. `metricClass` distinguishes expected/predicted/actual/cost; `countKind` distinguishes physical rows/business events/summary rows. UI-only/manual/screenshot evidence can be described in capabilities but cannot impersonate queryable totals without a separately approved, provenance-preserving ingestion process.

## 7. Validation and handoff

- Created SPEC, ACCEPTANCE and this DISCOVERY in the requested project directory; current UI and API code untouched.
- Preserved prior project guidance and added evidence-first discovery guardrails.
- Passed `bunx vitest run src/lib/reconciliationPeriod.test.ts src/lib/reconciliationSessionDisplay.test.ts` (17 tests).
- No source access is claimed; no source records or live tasks changed. No app workflow re-test was needed for documentation-only changes, and no source calls were launched to manufacture validation.
- The Phase 1 gap assessment and plan can proceed from the new upload; production implementation remains gated by service ownership/contracts, account/role mappings, private storage, task access and provenance/validation evidence. Full original-design conformance remains unverified without the original separate attachments.