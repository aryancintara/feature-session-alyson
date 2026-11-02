"""Daily step 1: put bridged sessions into summary AND click ids.

A lead_id_bridge.alyson_session_id is done only when it exists in both
unified.unified_session_summary and unified.session_click_ids.

Lookup: bridge.unified_lead_id = unified.unified_leads.id
session_id = alyson_session_id
workspace_id = lead.workspace_id or 253

Event:
  {} or EventBridge schedule  — insert missing rows
  {"dry_run": true}           — counts only
  {"enabled": true}           — override ENABLED=false for one run

Schedule: EventBridge cron(55 23 * * ? *) — 23:55 UTC, end of the UTC day.

Revenue insert is a later step. This job does not write revenue_events.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

WORKGROUP = os.environ.get("ATHENA_WORKGROUP", "ipintel_etl")
OUTPUT = os.environ.get(
    "ATHENA_OUTPUT_LOCATION",
    "s3://aws-athena-query-results-221490242148-us-west-2/daily-bridge-sessions/",
)
ENABLED = os.environ.get("ENABLED", "true").lower() == "true"
WORKSPACE = os.environ.get("WORKSPACE_ID", "253")

athena = boto3.client("athena")


def run(sql):
    qid = athena.start_query_execution(
        QueryString=sql,
        WorkGroup=WORKGROUP,
        ResultConfiguration={"OutputLocation": OUTPUT},
    )["QueryExecutionId"]
    delay = 1
    while True:
        status = athena.get_query_execution(QueryExecutionId=qid)["QueryExecution"]["Status"]
        state = status["State"]
        if state == "SUCCEEDED":
            return qid
        if state in ("FAILED", "CANCELLED"):
            raise RuntimeError(status.get("StateChangeReason", state))
        time.sleep(delay)
        delay = min(delay * 2, 8)


def rows(qid):
    out, first = [], True
    for page in athena.get_paginator("get_query_results").paginate(QueryExecutionId=qid):
        for row in page["ResultSet"]["Rows"]:
            if first:
                first = False
                continue
            out.append([c.get("VarCharValue") for c in row["Data"]])
    return out


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


def count_sql():
    return FILLED_CTE + """
SELECT
  CAST(count(*) AS varchar) AS missing_sessions,
  CAST(sum(CASE WHEN NOT in_summary THEN 1 ELSE 0 END) AS varchar) AS need_summary,
  CAST(sum(CASE WHEN NOT in_clicks THEN 1 ELSE 0 END) AS varchar) AS need_clicks
FROM filled
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


def counts():
    data = rows(run(count_sql()))
    row = data[0] if data else ["0", "0", "0"]
    return {
        "missing_sessions": int(row[0] or 0),
        "need_summary": int(row[1] or 0),
        "need_clicks": int(row[2] or 0),
    }


def handler(event, context):
    event = event or {}
    dry = bool(event.get("dry_run"))
    on = ENABLED or bool(event.get("enabled"))
    started = datetime.now(timezone.utc).isoformat()
    before = counts()
    result = {"ok": True, "dry_run": dry, "enabled": on, "started": started, "before": before}
    if dry or not on:
        result["wrote"] = False
        logger.info(json.dumps(result))
        return result
    if before["need_summary"]:
        run(insert_summary_sql())
    if before["need_clicks"]:
        run(insert_clicks_sql())
    after = counts()
    result["after"] = after
    result["wrote"] = True
    result["inserted_summary"] = before["need_summary"]
    result["inserted_clicks"] = before["need_clicks"]
    logger.info(json.dumps(result))
    return result
