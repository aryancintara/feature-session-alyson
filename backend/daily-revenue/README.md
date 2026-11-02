# Daily revenue (rule-driven)

**Runner:** Lambda `daily-revenue`
**Reads:** ACTIVE `REVENUE` rows in `unified.rule`
**Writes:** `unified.revenue_events` (MERGE on source_id + lead_id)

If a bridged session is missing from summary or click ids, this job adds the missing row first (from `unified_leads`), then writes revenue for amount > 0.

**When:** EventBridge `cron(5 0 * * ? *)` — 00:05 UTC, after `daily-bridge-sessions` at 23:55. Schedule stays **DISABLED**. `ENABLED` env is `false`.

One write run without flipping the schedule:

```
{"enabled": true}
```

Dry-run:

```
{"dry_run": true}
```

Cost stays on `cost-revenue-daily-cost`. This job does not write `cost_events`.
