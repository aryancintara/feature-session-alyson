"""Daily revenue job. Applies ACTIVE REVENUE rules from unified.rule
and MERGEs into unified.revenue_events.

A lead is written when calculated amount > 0 and it has alyson_session_id
on unified.lead_id_bridge. If that session is missing from summary and/or
click ids, this job adds the missing row first (lookup unified_leads), then
writes revenue.

Sources:
  homelight  sampledb.revenue_leads_plus   match buyer_lead_id
  uct        unified.uct_revenue           match utm_content = client_lead_id
  phonexa    raw.phonexa_ref_raw           match routing / client / buyer lead id

Schedule: EventBridge cron(5 0 * * ? *) — 00:05 UTC, after daily-bridge-sessions.
Schedule stays DISABLED until you say start. ENABLED env defaults to false.

Event:
  {} or schedule           — no-op while ENABLED=false
  {"dry_run": true}        — plan only
  {"enabled": true}        — one write run
  {"start","end"}          — window (end inclusive)
"""

import json
import logging
import os
import re
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

WORKGROUP = os.environ.get("ATHENA_WORKGROUP", "ipintel_etl")
OUTPUT = os.environ.get(
    "ATHENA_OUTPUT_LOCATION",
    "s3://aws-athena-query-results-221490242148-us-west-2/daily-revenue/",
)
LOOKBACK_DAYS = int(os.environ.get("LOOKBACK_DAYS", "3"))
ENABLED = os.environ.get("ENABLED", "false").lower() == "true"
WORKSPACE = os.environ.get("WORKSPACE_ID", "253")

COLUMN_RE = re.compile(r"^[A-Za-z0-9_]{1,128}$")
NUMBER_RE = re.compile(r"^-?\d+(\.\d+)?$")
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TEXT_OPS = {"equals", "not_equals", "in", "not_in", "contains", "not_contains"}
NUMBER_OPS = {"greater_than": ">", "gte": ">=", "gte_cents": ">=", "less_than": "<", "lte": "<="}
MONEY_FIELDS = {"buyer_bid", "publisher_payout", "post_price"}
HL_EXTRA = {"vendor_id", "offer_id"}
SOURCES = {
    "homelight": "sampledb.revenue_leads_plus",
    "uct": "unified.uct_revenue",
    "phonexa": "raw.phonexa_ref_raw",
}

athena = boto3.client("athena")


def run(sql):
    qid = athena.start_query_execution(
        QueryString=sql, WorkGroup=WORKGROUP, ResultConfiguration={"OutputLocation": OUTPUT}
    )["QueryExecutionId"]
    delay = 1
    while True:
        status = athena.get_query_execution(QueryExecutionId=qid)["QueryExecution"]["Status"]
        if status["State"] == "SUCCEEDED":
            return qid
        if status["State"] in ("FAILED", "CANCELLED"):
            raise RuntimeError(status.get("StateChangeReason", status["State"]))
        time.sleep(delay)
        delay = min(delay * 2, 5)


def rows(qid):
    out, first = [], True
    for page in athena.get_paginator("get_query_results").paginate(QueryExecutionId=qid):
        for row in page["ResultSet"]["Rows"]:
            if first:
                first = False
                continue
            out.append([c.get("VarCharValue") for c in row["Data"]])
    return out


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def numeric_expr(field):
    if field in MONEY_FIELDS:
        return f"try_cast(replace(replace(CAST(\"{field}\" AS varchar), '$', ''), ',', '') AS double)"
    return f'try_cast("{field}" AS double)'


def filter_sql(items, extra_alias=None):
    parts = []
    for item in items or []:
        field, op, value = item.get("field"), item.get("op"), item.get("value")
        if not isinstance(field, str) or not COLUMN_RE.match(field):
            raise ValueError(f"bad column {field}")
        if extra_alias and field in HL_EXTRA:
            col = f"{extra_alias}.{field}"
        else:
            col = f'"{field}"'
        text = f"lower(trim(COALESCE(CAST({col} AS varchar), '')))"
        if op in ("is_empty", "is_not_empty"):
            empty = f"nullif(trim(CAST({col} AS varchar)), '') IS NULL"
            parts.append(empty if op == "is_empty" else f"NOT ({empty})")
        elif op in NUMBER_OPS or op == "between":
            values = value if op == "between" else [value]
            if not all(NUMBER_RE.match(str(v)) for v in values):
                raise ValueError(f"bad number for {field}")
            number = f"try_cast({col} AS double)"
            if op == "between":
                parts.append(f"{number} BETWEEN {values[0]} AND {values[1]}")
            else:
                parts.append(f"{number} {NUMBER_OPS[op]} {values[0]}")
        elif op in TEXT_OPS:
            values = [str(v).strip().lower() for v in (value if isinstance(value, list) else [value])]
            if op in ("contains", "not_contains"):
                pattern = values[0].replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                like = f"{text} LIKE {q('%' + pattern + '%')} ESCAPE '\\'"
                parts.append(like if op == "contains" else f"NOT ({like})")
            else:
                listed = ", ".join(q(v) for v in values)
                parts.append(f"{text} {'NOT IN' if op in ('not_equals', 'not_in') else 'IN'} ({listed})")
        else:
            raise ValueError(f"bad operator {op}")
    return " AND ".join(parts) if parts else "1 = 1"


def amount_sql(calc):
    kind = calc.get("kind")
    if kind == "event_based":
        if not NUMBER_RE.match(str(calc.get("amount", ""))):
            raise ValueError("event_based needs amount")
        return str(calc["amount"])
    field = calc.get("field")
    if not isinstance(field, str) or not COLUMN_RE.match(field):
        raise ValueError(f"bad field {field}")
    value = numeric_expr(field)
    if kind == "cents":
        return f"{value} / 100.0"
    if kind == "money":
        return value
    pct = str(calc.get("percent", ""))
    if not NUMBER_RE.match(pct) or float(pct) <= 0:
        raise ValueError("percent must be above 0")
    if kind == "revenue_share":
        return f"{value} * {pct} / 100.0"
    if kind == "roas":
        return f"{value} / ({pct} / 100.0)"
    raise ValueError(f"unsupported calculation {kind}")


def to_day(value):
    if not value:
        return None
    return date.fromisoformat(str(value)[:10])


def load_rules():
    sql = """
    SELECT rule_id, CAST(rule_version AS varchar), source_id, conditions, calculation,
           CAST(effective_from AS varchar), CAST(effective_to AS varchar), CAST(created_at AS varchar)
    FROM unified.rule
    WHERE type = 'REVENUE' AND status = 'ACTIVE'
      AND source_id IN ('homelight', 'uct', 'phonexa')
    """
    out = []
    for rule_id, version, source, cond, calc, eff_from, eff_to, created in rows(run(sql)):
        try:
            calc_j = json.loads(calc or "{}")
            cond_j = json.loads(cond or "[]")
        except ValueError:
            logger.warning("skip %s v%s: bad JSON", rule_id, version)
            continue
        out.append({
            "rule_id": rule_id,
            "version": int(version),
            "source": source,
            "conditions": cond_j,
            "calc": calc_j,
            "start": to_day(calc_j.get("start_date")) or to_day(eff_from),
            "end": to_day(calc_j.get("end_date")) or to_day(eff_to),
            "created": created or "",
            "key": rule_id,
            "rank": (int(version), created or ""),
        })
    return out


def segments(rules, win_start, win_end):
    by_key = {}
    for rule in rules:
        by_key.setdefault(rule["key"], []).append(rule)
    plan = []
    for group in by_key.values():
        taken = []
        for rule in sorted(group, key=lambda r: r["rank"], reverse=True):
            lo = max(rule["start"] or win_start, win_start)
            hi = min(rule["end"] or win_end, win_end)
            pieces = [(lo, hi)] if lo <= hi else []
            for t_lo, t_hi in taken:
                nxt = []
                for p_lo, p_hi in pieces:
                    if t_hi < p_lo or t_lo > p_hi:
                        nxt.append((p_lo, p_hi))
                        continue
                    if p_lo < t_lo:
                        nxt.append((p_lo, t_lo - timedelta(days=1)))
                    if p_hi > t_hi:
                        nxt.append((t_hi + timedelta(days=1), p_hi))
                pieces = nxt
            plan.extend((rule, a, b) for a, b in pieces)
            taken.append((rule["start"] or date.min, rule["end"] or date.max))
    return plan


SESSIONED = """
bridged AS (
  SELECT
    trim(alyson_session_id) AS session_id,
    nullif(trim(unified_lead_id), '') AS unified_lead_id,
    nullif(trim(client_lead_id), '') AS client_lead_id,
    nullif(trim(buyer_lead_id), '') AS buyer_lead_id,
    nullif(trim(routing_platform_lead_id), '') AS routing_platform_lead_id
  FROM unified.lead_id_bridge
  WHERE nullif(trim(alyson_session_id), '') IS NOT NULL
),
ready AS (
  SELECT b.*
  FROM bridged b
  JOIN (
    SELECT session_id FROM unified.unified_session_summary
    WHERE nullif(trim(session_id), '') IS NOT NULL GROUP BY 1
  ) s ON s.session_id = b.session_id
  JOIN (
    SELECT session_id FROM unified.session_click_ids
    WHERE nullif(trim(session_id), '') IS NOT NULL GROUP BY 1
  ) c ON c.session_id = b.session_id
)
"""


def homelight_sql(rule, a, b):
    src_filters = [x for x in (rule["conditions"] or []) if x.get("field") not in HL_EXTRA]
    extra_filters = [x for x in (rule["conditions"] or []) if x.get("field") in HL_EXTRA]
    return f"""
WITH src AS (
  SELECT * FROM (
    SELECT
      CAST(id AS varchar) AS lead_id,
      {amount_sql(rule['calc'])} AS amount,
      CAST(COALESCE(TRY_CAST(date_pst AS date), TRY_CAST(updated_at AS date), TRY_CAST(created_at AS date)) AS date) AS d,
      CAST(COALESCE(
        try_cast(updated_at AS timestamp),
        try_cast(datetime_pst AS timestamp),
        CAST(TRY_CAST(date_pst AS date) AS timestamp)
      ) AS timestamp) AS event_time,
      nullif(trim(CAST(client_id AS varchar)), '') AS client_id,
      concat('{{"expected_revenue":"', CAST(CAST(TRY_CAST(expected_revenue AS decimal(18,2)) AS decimal(18,2)) AS varchar), '"}}') AS inputs,
      row_number() OVER (PARTITION BY id ORDER BY TRY_CAST(updated_at AS timestamp) DESC NULLS LAST) AS rn
    FROM sampledb.revenue_leads_plus
    WHERE TRY_CAST(date_pst AS date) >= DATE '{a}'
      AND TRY_CAST(date_pst AS date) <= DATE '{b}'
      AND ({filter_sql(src_filters)})
  ) x
  WHERE rn = 1 AND amount > 0
),
vo AS (
  SELECT trim(lead_id) AS lead_id,
         min(nullif(trim(vendor_id), '')) AS vendor_id,
         min(nullif(trim(offer_id), '')) AS offer_id
  FROM unified.revenue_events
  WHERE source_id = 'homelight' AND nullif(trim(lead_id), '') IS NOT NULL
  GROUP BY 1
),
{SESSIONED}
SELECT
  lower(to_hex(md5(to_utf8(concat('sampledb.revenue_leads_plus|', r.session_id, '|', src.lead_id))))) AS event_id,
  r.session_id,
  CAST(round(src.amount, 2) AS decimal(18,2)) AS revenue,
  src.event_time,
  src.inputs,
  src.d,
  src.lead_id,
  r.unified_lead_id,
  src.client_id,
  coalesce(vo.vendor_id, 'VD001') AS vendor_id,
  vo.offer_id AS offer_id
FROM src
JOIN ready r ON r.buyer_lead_id = src.lead_id
LEFT JOIN vo ON vo.lead_id = src.lead_id
WHERE ({filter_sql(extra_filters, extra_alias='vo')})
"""


def uct_sql(rule, a, b):
    return f"""
WITH src AS (
  SELECT * FROM (
    SELECT
      nullif(trim(utm_content), '') AS lead_id,
      {amount_sql(rule['calc'])} AS amount,
      CAST(COALESCE(try(date(date)), try(date(session_date)), try(date(created_at))) AS date) AS d,
      CAST(COALESCE(try_cast(created_at AS timestamp), CAST(try(date(date)) AS timestamp)) AS timestamp) AS event_time,
      concat('{{"expected_revenue_vendor":"', CAST(CAST(TRY_CAST(expected_revenue_vendor AS decimal(18,2)) AS decimal(18,2)) AS varchar), '"}}') AS inputs,
      nullif(trim(vendor_id), '') AS vendor_id,
      nullif(trim(offer_id), '') AS offer_id,
      row_number() OVER (
        PARTITION BY nullif(trim(utm_content), '')
        ORDER BY try_cast(created_at AS timestamp) DESC NULLS LAST
      ) AS rn
    FROM unified.uct_revenue
    WHERE nullif(trim(utm_content), '') IS NOT NULL
      AND COALESCE(try(date(date)), try(date(session_date))) >= DATE '{a}'
      AND COALESCE(try(date(date)), try(date(session_date))) <= DATE '{b}'
      AND ({filter_sql(rule['conditions'])})
  ) x
  WHERE rn = 1 AND amount > 0
),
{SESSIONED}
SELECT
  lower(to_hex(md5(to_utf8(concat('unified.uct_revenue|', r.session_id, '|', src.lead_id))))) AS event_id,
  r.session_id,
  CAST(round(src.amount, 2) AS decimal(18,2)) AS revenue,
  src.event_time,
  src.inputs,
  src.d,
  src.lead_id,
  r.unified_lead_id,
  CAST(NULL AS varchar) AS client_id,
  src.vendor_id,
  src.offer_id
FROM src
JOIN ready r ON r.client_lead_id = src.lead_id
"""


def phonexa_sql(rule, a, b):
    return f"""
WITH src AS (
  SELECT * FROM (
    SELECT
      trim(CAST(lead_id AS varchar)) AS lead_id,
      {amount_sql(rule['calc'])} AS amount,
      try_cast(substr(date_pst, 1, 10) AS date) AS d,
      try_cast(datetime_pst AS timestamp) AS event_time,
      concat('{{"buyer_bid":"', coalesce(CAST(buyer_bid AS varchar), ''), '"}}') AS inputs,
      row_number() OVER (
        PARTITION BY trim(CAST(lead_id AS varchar))
        ORDER BY datetime_pst DESC
      ) AS rn
    FROM raw.phonexa_ref_raw
    WHERE nullif(trim(CAST(lead_id AS varchar)), '') IS NOT NULL
      AND substr(date_pst, 1, 10) >= '{a}'
      AND substr(date_pst, 1, 10) <= '{b}'
      AND ({filter_sql(rule['conditions'])})
  ) x
  WHERE rn = 1 AND amount > 0
),
{SESSIONED}
SELECT
  lower(to_hex(md5(to_utf8(concat('raw.phonexa_ref_raw|', r.session_id, '|', src.lead_id))))) AS event_id,
  r.session_id,
  CAST(round(src.amount, 2) AS decimal(18,2)) AS revenue,
  src.event_time,
  src.inputs,
  src.d,
  src.lead_id,
  r.unified_lead_id,
  CAST(NULL AS varchar) AS client_id,
  CAST(NULL AS varchar) AS vendor_id,
  CAST(NULL AS varchar) AS offer_id
FROM src
JOIN ready r
  ON r.routing_platform_lead_id = src.lead_id
  OR r.client_lead_id = src.lead_id
  OR r.buyer_lead_id = src.lead_id
"""


BUILDERS = {
    "homelight": homelight_sql,
    "uct": uct_sql,
    "phonexa": phonexa_sql,
}

INSERT_COLS = (
    "event_id, session_id, revenue, currency, rule_id, rule_version, source_id, source_table, "
    "event_time, status, inputs, processed_at, processing_run_id, session_id_source, "
    "client_id, workspace_id, date, offer_id, vendor_id, lead_id, unified_lead_id"
)


FILLED_CTE = f"""
WITH bridge AS (
  SELECT
    trim(alyson_session_id) AS session_id,
    min(nullif(trim(unified_lead_id), '')) AS unified_lead_id,
    min(nullif(trim(client_lead_id), '')) AS client_lead_id,
    min(nullif(trim(buyer_lead_id), '')) AS buyer_lead_id,
    min(nullif(trim(routing_platform_lead_id), '')) AS routing_platform_lead_id
  FROM unified.lead_id_bridge
  WHERE nullif(trim(alyson_session_id), '') IS NOT NULL
    AND nullif(trim(unified_lead_id), '') IS NOT NULL
  GROUP BY 1
),
present AS (
  SELECT
    b.*,
    (s.session_id IS NOT NULL) AS in_summary,
    (c.session_id IS NOT NULL) AS in_clicks
  FROM bridge b
  LEFT JOIN (
    SELECT session_id FROM unified.unified_session_summary
    WHERE nullif(trim(session_id), '') IS NOT NULL
    GROUP BY 1
  ) s ON s.session_id = b.session_id
  LEFT JOIN (
    SELECT session_id FROM unified.session_click_ids
    WHERE nullif(trim(session_id), '') IS NOT NULL
    GROUP BY 1
  ) c ON c.session_id = b.session_id
),
needed AS (
  SELECT p.*
  FROM present p
  WHERE NOT (p.in_summary AND p.in_clicks)
),
filled AS (
  SELECT
    n.session_id,
    n.unified_lead_id,
    n.client_lead_id,
    n.buyer_lead_id,
    n.routing_platform_lead_id,
    n.in_summary,
    n.in_clicks,
    coalesce(nullif(trim(l.workspace_id), ''), '{WORKSPACE}') AS workspace_id,
    nullif(trim(l.person_id), '') AS person_id,
    nullif(trim(l.channel), '') AS channel,
    nullif(trim(l.utm_source), '') AS utm_source,
    nullif(trim(l.utm_medium), '') AS utm_medium,
    nullif(trim(l.utm_campaign), '') AS utm_campaign,
    nullif(trim(l.utm_term), '') AS utm_term,
    nullif(trim(l.utm_content), '') AS utm_content,
    nullif(trim(l.referrer), '') AS referrer,
    nullif(trim(l.email), '') AS email,
    nullif(trim(l.phone_number), '') AS phone,
    nullif(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name,
    nullif(trim(l.first_name), '') AS first_name,
    nullif(trim(l.last_name), '') AS last_name,
    nullif(trim(l.address_line_1), '') AS street,
    nullif(trim(l.city), '') AS city,
    nullif(trim(l.state), '') AS state,
    nullif(trim(l.zip), '') AS zip,
    coalesce(
      l.date_pst,
      CAST(l.datetime_pst AS date),
      CAST(l.created_at AS date),
      current_date
    ) AS session_date,
    coalesce(l.datetime_pst, l.created_at) AS session_ts,
    coalesce(nullif(trim(l.utm_content), ''), n.client_lead_id) AS click_id
  FROM needed n
  INNER JOIN unified.unified_leads l
    ON trim(l.id) = n.unified_lead_id
)
"""


def insert_summary_sql():
    return """
INSERT INTO unified.unified_session_summary (
  session_id, session_id_method, source_id, workspace_id,
  session_date, session_start, session_end, session_status, revision,
  close_reason, shape, our_session,
  has_visit, has_quiz_start, has_partial_lead, has_lead, has_otp_verified, has_consent,
  journey_stage_number, journey_stage,
  channel,
  utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  page_url, entry_referrer,
  user_id, revcloud_person_id,
  email, phone, name, quiz_first_name, quiz_last_name,
  street, city, state, zip_code, address,
  event_count
)
""" + FILLED_CTE + """
SELECT
  f.session_id,
  'lead_bridge',
  'lead_id_bridge',
  f.workspace_id,
  f.session_date,
  f.session_ts,
  f.session_ts,
  'closed',
  1,
  'lead_bridge_backfill',
  'S',
  'yes',
  false, false, false, true, false, false,
  4,
  'Lead',
  f.channel,
  f.utm_source, f.utm_medium, f.utm_campaign, f.utm_content, f.utm_term,
  f.referrer, f.referrer,
  f.person_id, f.person_id,
  f.email, f.phone, f.name, f.first_name, f.last_name,
  f.street, f.city, f.state, f.zip, f.street,
  1
FROM filled f
WHERE NOT f.in_summary
"""


def insert_clicks_sql():
    return """
INSERT INTO unified.session_click_ids (
  session_id, session_date, workspace_id,
  clickid_tune_click_id, clickids_json
)
""" + FILLED_CTE + """
SELECT
  f.session_id,
  f.session_date,
  f.workspace_id,
  f.click_id,
  json_format(CAST(MAP(
    ARRAY['tune_click_id', 'utm_content', 'unified_lead_id'],
    ARRAY[f.click_id, f.utm_content, f.unified_lead_id]
  ) AS JSON))
FROM filled f
WHERE NOT f.in_clicks
"""


def fill_missing_sessions():
    """Add bridge sessions that are not yet in both summary and click ids."""
    run(insert_summary_sql())
    run(insert_clicks_sql())


def merge_sql(source_sql, rule, source_id, run_id):
    table = SOURCES[source_id]
    return f"""
MERGE INTO unified.revenue_events t
USING (
  SELECT * FROM ({source_sql}) z
) s
ON t.source_id = {q(source_id)} AND trim(t.lead_id) = s.lead_id
WHEN MATCHED AND (
  t.revenue IS DISTINCT FROM s.revenue
  OR t.rule_id IS DISTINCT FROM {q(rule['rule_id'])}
  OR t.rule_version IS DISTINCT FROM {rule['version']}
  OR t.session_id IS DISTINCT FROM s.session_id
  OR t.unified_lead_id IS DISTINCT FROM s.unified_lead_id
) THEN UPDATE SET
  revenue = s.revenue,
  rule_id = {q(rule['rule_id'])},
  rule_version = {rule['version']},
  session_id = s.session_id,
  unified_lead_id = s.unified_lead_id,
  inputs = s.inputs,
  processed_at = current_timestamp,
  processing_run_id = {q(run_id)},
  vendor_id = coalesce(s.vendor_id, t.vendor_id),
  offer_id = coalesce(s.offer_id, t.offer_id)
WHEN NOT MATCHED THEN INSERT ({INSERT_COLS}) VALUES (
  s.event_id, s.session_id, s.revenue, 'USD', {q(rule['rule_id'])}, {rule['version']},
  {q(source_id)}, {q(table)}, s.event_time, 'PROCESSED', s.inputs, current_timestamp,
  {q(run_id)}, 'lead_id_bridge', s.client_id, '{WORKSPACE}', s.d,
  s.offer_id, s.vendor_id, s.lead_id, s.unified_lead_id
)
"""


def handler(event, context):
    event = event or {}
    dry = bool(event.get("dry_run"))
    on = ENABLED or bool(event.get("enabled")) or bool(event.get("force"))
    if not on and not dry:
        return {"ok": True, "ran": False, "reason": "ENABLED is false"}
    today = datetime.now(ZoneInfo("America/Los_Angeles")).date()
    if event.get("start"):
        if not DAY_RE.match(str(event["start"])) or not DAY_RE.match(str(event.get("end", ""))):
            raise ValueError("start and end must be YYYY-MM-DD")
        win_start, win_end = date.fromisoformat(event["start"]), date.fromisoformat(event["end"])
    else:
        win_start, win_end = today - timedelta(days=LOOKBACK_DAYS), today
    run_id = "daily-revenue-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:6]
    plan = segments(load_rules(), win_start, win_end)
    if not dry:
        fill_missing_sessions()
    results = []
    for rule, a, b in plan:
        item = {
            "rule_id": rule["rule_id"], "version": rule["version"], "source": rule["source"],
            "from": a.isoformat(), "to": b.isoformat(),
        }
        try:
            sql = merge_sql(BUILDERS[rule["source"]](rule, a.isoformat(), b.isoformat()), rule, rule["source"], run_id)
            if not dry:
                run(sql)
            item["ok"] = True
        except Exception as exc:
            logger.exception("rule %s failed", rule["rule_id"])
            item["ok"] = False
            item["error"] = str(exc)[:500]
        results.append(item)
    return {
        "ok": all(r.get("ok", False) for r in results) if results else True,
        "ran": on and not dry,
        "dry_run": dry,
        "run_id": run_id,
        "window": [win_start.isoformat(), win_end.isoformat()],
        "rules": results,
    }


lambda_handler = handler
