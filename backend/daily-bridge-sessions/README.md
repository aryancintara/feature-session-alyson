# Daily bridge sessions (step 1)

**Runner:** daily Lambda `daily-bridge-sessions`.
**When:** EventBridge `cron(55 23 * * ? *)` — 23:55 UTC (end of the UTC day). Schedule stays **DISABLED** until you say to start.
Athena workgroup `ipintel_etl`. Same pattern as `cost-revenue-daily-cost`.

Not deployed yet. `ENABLED` defaults to `false`. Dry-run:

```
{"dry_run": true}
```

One write run without flipping the env flag:

```
{"enabled": true}
```

Step 2 (daily revenue into `revenue_events`) is separate and runs only after this job finishes.
