"""Daily cost job. Applies COST rules from unified.rule and MERGEs into unified.cost_events.

Sources:
  tune     raw.raw_tune_clicks       session via unified.session_click_ids (Tune click id)
  phonexa  raw.phonexa_ref_raw       session via the Phonexa row in unified.revenue_events
  sms      unified.uct_events        session_id on the event; sent SMS only, priced per 1,000

Rule dates come from calculation.start_date / calculation.end_date. No end date means the rule keeps
applying until a newer version or a newer rule for the same connector takes over. Where versions overlap,
the newest wins for those days. INACTIVE rules are skipped.

Event: {} processes the last LOOKBACK_DAYS days. {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"} reprocesses
that range (end inclusive). {"dry_run": true} returns the plan without writing.
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
OUTPUT = os.environ["ATHENA_OUTPUT_LOCATION"]
LOOKBACK_DAYS = int(os.environ.get("LOOKBACK_DAYS", "3"))
ENABLED = os.environ.get("ENABLED", "false").lower() == "true"

SMS_SENT_STATUS = {"57": ["SENT"], "77": ["SMS SEND"]}
COLUMN_RE = re.compile(r"^[A-Za-z0-9_]{1,128}$")
NUMBER_RE = re.compile(r"^-?\d+(\.\d+)?$")
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TEXT_OPS = {"equals", "not_equals", "in", "not_in", "contains", "not_contains"}
NUMBER_OPS = {"greater_than": ">", "gte": ">=", "gte_cents": ">=", "less_than": "<", "lte": "<="}

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


def filter_sql(items):
    parts = []
    for item in items or []:
        field, op, value = item.get("field"), item.get("op"), item.get("value")
        if not isinstance(field, str) or not COLUMN_RE.match(field):
            raise ValueError(f"bad column {field}")
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
    value = f'try_cast("{field}" AS double)'
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
    SELECT rule_id, CAST(rule_version AS varchar), source_id, conditions, calculation, status,
           CAST(effective_from AS varchar), CAST(effective_to AS varchar), CAST(created_at AS varchar)
    FROM unified.rule
    WHERE type = 'COST' AND status <> 'INACTIVE' AND source_id IN ('tune', 'phonexa', 'sms')
    """
    out = []
    for rule_id, version, source, cond, calc, status, eff_from, eff_to, created in rows(run(sql)):
        try:
            calc_j = json.loads(calc or "{}")
            cond_j = json.loads(cond or "[]")
        except ValueError:
            logger.warning("skip %s v%s: bad JSON", rule_id, version)
            continue
        start = to_day(calc_j.get("start_date")) or to_day(eff_from)
        end = to_day(calc_j.get("end_date")) or to_day(eff_to)
        rule = {
            "rule_id": rule_id, "version": int(version), "source": source, "conditions": cond_j,
            "calc": calc_j, "start": start, "end": end, "created": created or "",
        }
        if source == "sms":
            rule["connector"] = sms_connector(cond_j)
            if rule["connector"] not in SMS_SENT_STATUS:
                logger.warning("skip %s v%s: SMS connector not supported", rule_id, version)
                continue
            rule["key"] = "sms|" + rule["connector"]
            rule["rank"] = (rule["created"], rule["version"])
        else:
            rule["key"] = rule_id
            rule["rank"] = (rule["version"], rule["created"])
        out.append(rule)
    return out


def sms_connector(conditions):
    for item in conditions or []:
        if item.get("field") == "connector_id" and item.get("op") in ("equals", "in"):
            value = item.get("value")
            values = value if isinstance(value, list) else [value]
            if len(values) == 1:
                return str(values[0]).strip()
    return None


def segments(rules, win_start, win_end):
    """Split each key's days so every day is priced by exactly one rule (newest wins)."""
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
            if rule["start"] is not None or rule["end"] is not None:
                taken.append((rule["start"] or date.min, rule["end"] or date.max))
            else:
                taken.append((date.min, date.max))
    return plan


INSERT_COLS = (
    "event_id, session_id, amount, currency, rule_id, rule_version, source_id, source_record_id, "
    "source_table, event_time, status, inputs, processed_at, processing_run_id, session_id_source, "
    "client_id, workspace_id, date, lead_id, unified_lead_id"
)


def merge(source_sql, rule, source_id, source_table, run_id, session_source):
    return f"""
MERGE INTO unified.cost_events t
USING (
    SELECT src.*,
           CASE WHEN {q(source_id)} = 'phonexa' THEN '253' ELSE ws.workspace_id END AS workspace_id,
           src.lead_id AS cost_lead_id
    FROM ({source_sql}) src
    LEFT JOIN (
        SELECT session_id, '253' AS workspace_id
        FROM unified.unified_session_summary
        WHERE workspace_id = '253'
        GROUP BY session_id
    ) ws ON ws.session_id = src.session_id
) s
ON t.event_id = s.event_id
WHEN MATCHED AND (
    t.amount <> s.amount OR t.rule_version <> {rule['version']} OR t.rule_id <> {q(rule['rule_id'])}
    OR t.workspace_id IS DISTINCT FROM s.workspace_id
    OR t.lead_id IS DISTINCT FROM s.cost_lead_id
    OR t.unified_lead_id IS DISTINCT FROM s.unified_lead_id
) THEN UPDATE SET
    amount = s.amount, rule_id = {q(rule['rule_id'])}, rule_version = {rule['version']},
    session_id = s.session_id, workspace_id = s.workspace_id,
    lead_id = s.cost_lead_id, unified_lead_id = s.unified_lead_id,
    processed_at = current_timestamp, processing_run_id = {q(run_id)}
WHEN NOT MATCHED THEN INSERT ({INSERT_COLS}) VALUES (
    s.event_id, s.session_id, s.amount, 'USD', {q(rule['rule_id'])}, {rule['version']}, {q(source_id)},
    s.source_record_id, {q(source_table)}, s.event_time, 'PROCESSED', s.inputs, current_timestamp,
    {q(run_id)}, {q(session_source)}, CAST(NULL AS varchar), s.workspace_id, s.d,
    s.cost_lead_id, s.unified_lead_id
)"""


def tune_sql(rule, a, b):
    rid = rule["rule_id"]
    event_id = (
        "lower(to_hex(md5(to_utf8(concat('tune|', b.session_id, '|', c.txn)))))"
        if rid == "tune_payout_cost"
        else f"lower(to_hex(md5(to_utf8(concat('tune|', {q(rid)}, '|', c.txn)))))"
    )
    return f"""
WITH clicks AS (
    SELECT txn, amount, event_time FROM (
        SELECT nullif(trim(transaction_id), '') AS txn,
               {amount_sql(rule['calc'])} AS amount,
               CAST(datetime AS timestamp(3)) AS event_time,
               row_number() OVER (PARTITION BY nullif(trim(transaction_id), '') ORDER BY datetime DESC) AS rn
        FROM raw.raw_tune_clicks
        WHERE date_pst >= DATE '{a}' AND date_pst <= DATE '{b}'
          AND nullif(trim(transaction_id), '') IS NOT NULL
          AND ({filter_sql(rule['conditions'])})
    ) x
    WHERE rn = 1 AND amount > 0
),
bridge AS (
    SELECT split_part(trim(clickid_tune_click_id), '|', 1) AS txn,
           min(session_id) AS session_id, min(session_date) AS session_date
    FROM unified.session_click_ids
    WHERE nullif(trim(clickid_tune_click_id), '') IS NOT NULL
    GROUP BY 1
    HAVING count(DISTINCT session_id) = 1
)
SELECT {event_id} AS event_id, b.session_id,
       CAST(round(c.amount, 2) AS decimal(18,2)) AS amount,
       c.txn AS source_record_id, c.event_time, CAST(NULL AS varchar) AS inputs,
       CAST(b.session_date AS date) AS d,
       CAST(NULL AS varchar) AS lead_id,
       CAST(NULL AS varchar) AS unified_lead_id
FROM clicks c
JOIN bridge b ON b.txn = c.txn"""


def phonexa_sql(rule, a, b):
    rid = rule["rule_id"]
    return f"""
WITH leads AS (
    SELECT lead_id, amount, event_time, d FROM (
        SELECT trim(lead_id) AS lead_id,
               {amount_sql(rule['calc'])} AS amount,
               try_cast(datetime_pst AS timestamp(3)) AS event_time,
               try_cast(substr(date_pst, 1, 10) AS date) AS d,
               row_number() OVER (PARTITION BY trim(lead_id) ORDER BY datetime_pst DESC) AS rn
        FROM raw.phonexa_ref_raw
        WHERE substr(date_pst, 1, 10) >= '{a}' AND substr(date_pst, 1, 10) <= '{b}'
          AND nullif(trim(lead_id), '') IS NOT NULL
          AND ({filter_sql(rule['conditions'])})
    ) x
    WHERE rn = 1 AND amount > 0
),
sessions AS (
    SELECT lead_id, min(session_id) AS session_id
    FROM unified.revenue_events
    WHERE source_id = 'phonexa' AND session_id IS NOT NULL AND lead_id IS NOT NULL
    GROUP BY 1
)
SELECT lower(to_hex(md5(to_utf8(concat('phonexa|', l.lead_id, '|', {q(rid)}))))) AS event_id,
       s.session_id, CAST(round(l.amount, 2) AS decimal(18,2)) AS amount,
       l.lead_id AS source_record_id, l.event_time, CAST(NULL AS varchar) AS inputs, l.d,
       l.lead_id AS lead_id,
       CAST(NULL AS varchar) AS unified_lead_id
FROM leads l
JOIN sessions s ON s.lead_id = l.lead_id"""


def sms_sql(rule, a, b):
    calc = rule["calc"]
    per = str(calc.get("per_count", 1000))
    price = str(calc.get("amount", ""))
    if not NUMBER_RE.match(per) or float(per) <= 0 or not NUMBER_RE.match(price):
        raise ValueError("sms_per_count needs per_count > 0 and amount")
    conn = rule["connector"]
    statuses = ", ".join(q(s) for s in SMS_SENT_STATUS[conn])
    return f"""
WITH sent AS (
    SELECT nullif(trim(session_id), '') AS session_id,
           CAST(substr(CAST(event_date AS varchar), 1, 10) AS date) AS d,
           count(*) AS n
    FROM unified.uct_events
    WHERE connector_id = {q(conn)} AND event_type = 'SMS' AND status IN ({statuses})
      AND substr(CAST(event_date AS varchar), 1, 10) >= '{a}'
      AND substr(CAST(event_date AS varchar), 1, 10) <= '{b}'
      AND ({filter_sql(rule['conditions'])})
    GROUP BY 1, 2
)
SELECT lower(to_hex(md5(to_utf8(concat('sms|', {q(conn)}, '|', COALESCE(session_id, 'none'), '|', CAST(d AS varchar)))))) AS event_id,
       session_id,
       CAST(round(n * {price} / {per}, 2) AS decimal(18,2)) AS amount,
       concat({q(conn)}, '|', COALESCE(session_id, 'none'), '|', CAST(d AS varchar)) AS source_record_id,
       CAST(d AS timestamp(3)) AS event_time,
       CAST(n AS varchar) AS inputs,
       d,
       CAST(NULL AS varchar) AS lead_id,
       CAST(NULL AS varchar) AS unified_lead_id
FROM sent"""


BUILDERS = {
    "tune": (tune_sql, "raw.raw_tune_clicks", "unified.session_click_ids"),
    "phonexa": (phonexa_sql, "raw.phonexa_ref_raw", "revenue_events"),
    "sms": (sms_sql, "unified.uct_events", "uct_events"),
}


def lambda_handler(event, context):
    event = event or {}
    dry = bool(event.get("dry_run"))
    if not ENABLED and not dry and not event.get("force"):
        return {"ok": True, "ran": False, "reason": "ENABLED is false"}
    today = datetime.now(ZoneInfo("America/Los_Angeles")).date()
    if event.get("start"):
        if not DAY_RE.match(str(event["start"])) or not DAY_RE.match(str(event.get("end", ""))):
            raise ValueError("start and end must be YYYY-MM-DD")
        win_start, win_end = date.fromisoformat(event["start"]), date.fromisoformat(event["end"])
    else:
        win_start, win_end = today - timedelta(days=LOOKBACK_DAYS), today
    run_id = "daily-cost-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:6]
    plan = segments(load_rules(), win_start, win_end)
    results = []
    for rule, a, b in plan:
        item = {"rule_id": rule["rule_id"], "version": rule["version"], "source": rule["source"],
                "from": a.isoformat(), "to": b.isoformat()}
        try:
            builder, table, session_source = BUILDERS[rule["source"]]
            sql = merge(builder(rule, a.isoformat(), b.isoformat()), rule, rule["source"], table, run_id, session_source)
            if not dry:
                run(sql)
            item["ok"] = True
        except Exception as exc:
            logger.exception("rule %s failed", rule["rule_id"])
            item["ok"] = False
            item["error"] = str(exc)[:500]
        results.append(item)
    return {
        "ok": all(r["ok"] for r in results), "ran": not dry, "run_id": run_id,
        "window": [win_start.isoformat(), win_end.isoformat()], "rules": results,
    }
