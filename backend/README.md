# Backend the Cost & Revenue and Session Explorer UI calls

These Lambdas are already live in AWS account `221490242148`, region `us-west-2`. The UI talks to them over HTTP; it does not run this Python itself.

| Folder | AWS name | UI use |
|---|---|---|
| `cost-revenue-api` | `cost-revenue-api` · HTTP API `i4mf0v33aa` | Rules list/save, Check, Load missing, reconciliation log, vendor/offer options |
| `daily-revenue` | `daily-revenue` | Writes `unified.revenue_events` from ACTIVE revenue rules. Schedule **off** |
| `daily-bridge-sessions` | `daily-bridge-sessions` | Fills summary and click ids for bridge sessions. Schedule **off** |
| `daily-cost` | `cost-revenue-daily-cost` | Daily cost load. Schedule on |
| `session-explorer-api` | Session Explorer API | Session Explorer pages |

`sql/` is the Iceberg `unified.reconciliation_log` table used by Check.

## Auth

UI APIs require a Cognito **ID token** (same pool/client as Alyson) and `x-workspace-id`. Data is filtered by that workspace.

Headers:
- `x-auth-token: <id token>` (or `Authorization: Bearer <id token>`)
- `x-workspace-id: 253`

Lambda env: `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`. See `cost-revenue-api/AUTH.md`.
