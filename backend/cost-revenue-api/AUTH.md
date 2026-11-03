# Cognito auth (Cost & Revenue + Session Explorer)

Protected routes require a Cognito **ID token** (same pool/client as Alyson) and `x-workspace-id`.

## Headers
- `x-auth-token: <id token>` (or `Authorization: Bearer <id token>`)
- `x-workspace-id: 253`

## Env
See `.env.example`. Values must match Alyson: `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `AWS_REGION=us-west-2`.

## Errors
JSON `{ "code", "message" }`:
- 401 `AUTHENTICATION_REQUIRED` — Please sign in.
- 401 `INVALID_TOKEN` — Your session has expired. Please sign in again.
- 400 `WORKSPACE_REQUIRED` — A workspace is required.
- 403 `NOT_A_MEMBER` — You are not a member of this workspace.
- 503 `AUTH_UNAVAILABLE` — Sign-in is temporarily unavailable. Please try again in a moment.

## Manual check
1. Omit token → 401 AUTHENTICATION_REQUIRED
2. Live Alyson `x-auth-token` + `x-workspace-id: 253` → 200 on GET /rules and GET /sessions

## Delete rule
`POST /rules/delete` with `{ "rule_id", "rule_version" }`:
1. Event rows that used that rule stay in `revenue_events` / `cost_events`
2. Their amount/revenue is set to the latest source value
3. The rule version is removed from `unified.rule`
