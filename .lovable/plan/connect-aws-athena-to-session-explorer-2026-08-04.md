# Connect AWS Athena to Session Explorer

## Goal
Make the Last 24h / 7d / 30d / Custom date buttons in the Session Explorer run **real Athena queries** against `unified.unified_session_summary` and render live results in the existing UI, instead of filtering local mock rows.

## Current state
- `src/routes/sessions.tsx` line 130 calls `parseSessions(mockRowsInRange(range.from, range.to))` — purely local, no network.
- `src/lib/sessionMockRows.ts` builds rows that mirror the Athena `unified.unified_session_summary` schema exactly (all string-keyed), and `src/lib/sessionData.ts` `parseSessionRow()` parses `Record<string,string>` into the UI's `Session` type.
- **No AWS connection exists** in this workspace (`list_connections` returned empty). This is the only blocker.

## What you need to do (your side)
1. Approve the AWS Athena connect card I'll send — it creates the connection.
2. Provide AWS credentials with these IAM permissions:
   - `athena:StartQueryExecution`, `athena:GetQueryExecution`, `athena:GetQueryResults`, `athena:StopQueryExecution`, `athena:GetWorkGroup`
   - `glue:GetDatabase*`, `glue:GetTable*`, `glue:GetPartition*` (needed to read `AwsDataCatalog`)
   - S3 read access to the source data + read/write to the query **output location**
3. Tell me the Athena **workgroup** and **S3 output location** (e.g. `s3://your-bucket/athena-results/`). If you're using the default `primary` workgroup, I can omit it.

## What I'll build (after the connection is linked)
1. **Server function** `src/lib/athenaSessions.functions.ts`
   - `createServerFn` that runs `SELECT * FROM "unified"."unified_session_summary" WHERE session_start BETWEEN ? AND ? ORDER BY session_start DESC LIMIT 500`
   - Uses parameterized `ExecutionParameters` (not string interpolation) for the date bounds.
   - Calls the Lovable connector gateway at `https://connector-gateway.lovable.dev/aws_athena/` with `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${AWS_ATHENA_API_KEY}`.
   - Polls `GetQueryExecution` until `SUCCEEDED`, then `GetQueryResults`, maps rows to `Record<string,string>` (Athena returns everything as `VarCharValue` strings — matches `parseSessionRow` exactly).
   - Returns `{ rows, latestSessionAt, error }`.
2. **Wire the UI** in `src/routes/sessions.tsx`
   - Replace the `mockRowsInRange(range.from, range.to)` call with the server function, invoked through `useServerFn` + `useQuery` keyed on `[preset, customFrom, customTo]` so the 24h/7d/30d/custom buttons each fire a real query.
   - Add loading / error / empty states (the UI already has `isFetching` + `syncing` flags to reuse).
   - Keep mock data as a **fallback** if the Athena query fails or no connection is linked, so the page never goes blank.
3. **Refresh button** triggers a re-query (refetch), showing the new `lastSyncedAt` from the freshest `session_start` returned.

## Files I'll touch
- `src/lib/athenaSessions.functions.ts` (new) — server function + gateway call
- `src/routes/sessions.tsx` (edit) — swap mock call for live query, add loading/error states

## One open question
The mock data includes columns not shown above (`has_litigant`, `expected_revenue_source`, `device`, `source`, `exit_reason`) — I'll confirm against your real table with a `LIMIT 1` probe query before wiring the full SELECT, so missing columns don't break the UI.
