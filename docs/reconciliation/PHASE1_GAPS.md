# Reconciliation Phase 1 — current implementation and gaps

Reviewed 2026-10-23 UTC against the supplied Phase 1 upload. This is a code/service assessment, not independent source-data validation. No app code, source requests, business records, service configuration or credentials changed.

## Already present

| Requirement | Actual code evidence |
| --- | --- |
| Existing screen and navigation | `src/routes/cost-revenue.reconciliation.tsx:678–688,888–950`; current screen can be extended without rebuilding. |
| Three sources and period controls | `:690–725,891–916`; HomeLight, Non-HomeLight, Phonexa, completed UTC day/week/month and exclusive request end. |
| Automated aggregate comparison call | `:854–868`; exact supplied POST check URL with JSON body; does not prove independent reporting capability or provenance. |
| Response validation | `:727–750`; finite totals/counts, boolean match, missing lead IDs/revenue, direct or Lambda-wrapped string body. |
| Source/Loaded totals, counts and mismatch table | `:919–950`; API values displayed without guessed joins or amounts. |
| Failed request leaves totals blank | `:814,857–866`; result reset before request, error shown without fabricated zero totals. |
| Limited reconciliation-once reminder | `:696,798–813,869–877,911`; matched results remembered only after Mark done, keyed by source/start/end in this browser. Not durable shared audit or revision-aware reuse. |
| Regression tests | `src/lib/reconciliationPeriod.test.ts` and `reconciliationSessionDisplay.test.ts`; 17 tests passed on 2026-10-23. They do not prove backend eligibility, tenant isolation or join integrity. |

## Necessary additions

| Area | Gap | Safe implementation boundary |
| --- | --- | --- |
| Scope and provenance | Check response lacks account/tenant, currency, metric/count semantics, evidence ID, timezone provenance, query revision or freshness. Workspace selector is not authorization proof. | Establish a service-owned, authorized scope registry before persisting production results. Preserve the legacy endpoint; add explicit metadata through an approved additive contract. |
| Evidence collection | No report-request workflow, uploads, screenshot/table paste, extraction review, evidence methods or evidence status. | Private originals with immutable revisions and extracted values; screenshot/paste approval required. Unsupported or untested capability stays explicit. |
| Aggregate details | Revenue/count totals and signed service difference exist; absolute/percentage differences and independently traceable provenance do not. | Compute display-only differences from returned values with approved precision/tolerance and undefined percentages when source is zero. Do not reinterpret expected revenue as actual settlement. |
| Integrity checks | Missing IDs are returned, but session coverage, duplicates, timezone assertions and actual joined-query checks are absent. Optional old attribution helper is not join validation. | Service supplies separate typed, provenance-backed checks. Missing capability remains Not Checked/blocked, never green because revenue matches. |
| Status model | Current UI uses Matched, Not matched and Comparison unavailable. Request errors have separate text but no evidence-aware overall status. | Add the five required states; confirmed mismatch requires valid confirmed evidence. Unavailable queries or missing approvals are Awaiting Evidence/Warning, not confirmed failure. |
| Projects/tasks | No live task integration verified. The current TASKS snapshot has implemented Supabase-backed database operations and OAuth App MCP tools; its AWS HTTP provider remains gated inactive. App MCP is advertised but not connected or tested. See the follow-up below. | Reuse a tested task/project service with scope/issue idempotency. Do not invent an endpoint or claim a local link creates a production task. |
| Persistence and revalidation | Browser-local reminder lacks approvals, revisions, task links, account scope, transformation/source fingerprints and concurrency protection. | Durable service storage, append-only history and atomic scope/revision idempotency. Legacy reminders retain their old meaning and cannot certify Phase 1. |
| Access control | Existing check has no auth header; Cognito helpers explicitly apply to Unified Leads (`src/lib/unifiedLeadsAuth.ts:1,103–111`). No connected app database or evidence-review identity is configured. | Keep navigation usable signed out. Establish authenticated upload/review/history actions without extending the Leads guard or trusting browser tenant/account claims. |
| Full acceptance | Existing tests cover the legacy contract only. | Add workflow tests from ACCEPTANCE P01–P14 plus authorized end-to-end verification; distinguish fixtures from production evidence. |

## Dependencies that must be resolved

1. The existing service-owning repository/deployed contract for authorized scope metadata, richer check/provenance/integrity results and approved bounded fixtures. Frontend types and other-project snapshots are not substitutes.
2. The actual team identity, tenant/account mapping and who may upload, approve, view history and revalidate. The upload requests access control but does not define authorized users/roles; existing sign-in was intentionally limited to Leads.
3. Tested production evidence/result persistence and private-file storage under the existing service conventions, including retention, allowed file sizes/types and extraction processing. Do not create a substitute backend while ownership is unresolved.
4. Live project/task service contract, approved access and account mapping, including safe idempotent create/link operations.
5. Source-specific metric/count definitions, currency/precision/tolerance, timezone/filter mapping, evidence capabilities and relevant source/transform revision identifiers.

The Phase 1 upload now supplies intended workflow requirements. It resolves that portion of the missing-design blocker, but does not supply original separate acceptance files or production service/access evidence. No new source capability is claimed tested.

## Post-approval dependency verification — 2026-10-23

- Workspace standard connections list is empty. This is not a permission denial and does not prove no external services exist.
- App MCP catalogue advertises Alyson Projects & Tasks at `https://alyson-flow-craft.lovable.app`, connector `app_mcp_a3917ab4-2d3d-4a5e-bf56-6070a90a69eb`, with 14 tools including project creation/listing, task completion/listing and outcome recording. It is **not connected**; catalogue metadata is not a successful access test. No records were created.
- A fresh read-only TASKS snapshot at tool-reported commit `1c85351e` was inspected. `src/lib/mcp/index.ts:1–19` implements an OAuth authenticated MCP surface. `src/lib/mcp/tools/projects.ts:13–29` passes the caller database/tenant into project handlers; `src/lib/mcp/tools/execution.ts:37–64` supports task listing/completion with structured output and note. This improves on the earlier mock-only assessment but does not prove deployment/access or reconciliation account mapping.
- TASKS `src/services/backend/providers/supabase/SupabaseBackend.ts:276–346` reads tenant memberships/effective role, and its task-attempt read/insert paths around `:1528,1593` implement database persistence. `src/lib/access.ts:10–23,45–82,110–142,156–175` declares role normalization and permission rules, while distinguishing UI gating from enforced database policy. These are code evidence, not approved cross-app reviewer identities.
- TASKS `docs/aws-api-contract.md:1–6`, `src/services/backend/config.ts:33–46` and `src/services/backend/factory.ts:43–46` still mark the AWS HTTP provider inactive unless explicitly enabled. No HTTP service test was performed.
- TASKS task completion accepts JSON output/note, not private evidence upload. `src/lib/api/schemas.ts:1–7,31–35,64–72` declares artifact DTOs, not storage/upload authorization. Snapshot inspection found no implemented upload or signed-upload flow in the source/migration directories; artifact references alone cannot establish private evidence persistence.
- The unchanged local Reconciliation page opens signed out at `/cost-revenue/reconciliation`, retains Source/Loaded cards and unavailable comparison, and reports zero browser page errors. No Check period/source call or business write was performed. Build telemetry remains clean. This is baseline UI verification only, not Phase 1 workflow or live source verification.

### Required input before production changes

Provide the existing reconciliation/evidence service repository or approved deployed contracts (including private storage and scope/provenance/integrity responses), and the team-approved tenant/account plus uploader/reviewer identity/access mapping. Task integration can then be connected and tested through its real supported surface; source metadata and private-upload ownership are still separate unresolved gates. The approved plan prohibits provisioning a substitute backend while these dependencies remain unresolved.