"""Read-only Session Explorer API. Athena only. No credentials in responses."""
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3

from auth import AuthError, authenticate_request, auth_response, cors_headers

ATHENA = boto3.client("athena")
WORKGROUP = os.environ.get("ATHENA_WORKGROUP", "ipintel_etl")
DATABASE = os.environ.get("ATHENA_DATABASE", "unified")
MAX_WAIT = float(os.environ.get("ATHENA_MAX_WAIT_SECONDS", "24"))

SORTS = {
    "session_start": "session_start",
    "expected_revenue": "expected_revenue",
    "event_count": "event_count",
}
ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$")
SESSION_RE = re.compile(r"^[A-Za-z0-9-]{8,80}$")

HL_STAGE_SQL = """
CASE lower(trim(cast(r.furthest_stage AS varchar)))
  WHEN 'introduced' THEN 6
  WHEN 'agent_left_vm' THEN 6
  WHEN 'connected' THEN 6
  WHEN 'meeting_scheduled' THEN 7
  WHEN 'met_in_person' THEN 7
  WHEN 'coming_soon' THEN 7
  WHEN 'listing' THEN 8
  WHEN 'in_escrow' THEN 8
  ELSE 0
END
"""


_workspace = None


def _headers(origin):
    headers = cors_headers("GET,OPTIONS")
    headers["access-control-allow-headers"] = "content-type,authorization,x-auth-token,x-workspace-id,x-api-key"
    if origin:
        headers["access-control-allow-origin"] = origin
        headers["vary"] = "Origin"
    return headers


def _resp(status, body, origin):
    return {"statusCode": status, "headers": _headers(origin), "body": json.dumps(body, default=_json_default)}


def _err(status, message, origin):
    return _resp(status, {"error": message}, origin)


def _json_default(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, datetime):
        return v.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return str(v)


def _nullish(v):
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        if s == "" or s.lower() == "null":
            return None
        return s
    return v


def _bool(v):
    s = _nullish(v)
    if isinstance(s, bool):
        return s
    if s is None:
        return False
    return str(s).lower() in ("true", "1", "on", "t", "yes")


def _num(v):
    s = _nullish(v)
    if s is None:
        return None
    try:
        n = float(s)
    except (TypeError, ValueError):
        return None
    if n.is_integer():
        return int(n)
    return n


def _iso(v):
    s = _nullish(v)
    if s is None:
        return None
    s = str(s).replace(" ", "T")
    if s.endswith("+00:00"):
        s = s[:-6] + "Z"
    if not s.endswith("Z") and "T" in s:
        s = s + "Z"
    return s


def _shift_iso(value, seconds):
    raw = _iso(value)
    if not raw or "T" not in raw:
        return None
    try:
        dt = datetime.strptime(raw[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return (dt + timedelta(seconds=seconds)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _plugin_list(value):
    raw = _nullish(value)
    if not raw:
        return []
    try:
        parsed = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return []
    if isinstance(parsed, dict):
        return [parsed]
    if isinstance(parsed, list):
        return [item for item in parsed if isinstance(item, dict)]
    return []


def _plugin_key(props):
    if not isinstance(props, dict):
        return ""
    return str(props.get("execution_id") or props.get("timestamp") or props.get("step_id") or "")


def _parse_when(value, name):
    if value is None or str(value).strip() == "":
        return None
    raw = str(value).strip()
    if not ISO_RE.match(raw):
        raise ValueError(f"{name} must be ISO UTC")
    if "T" not in raw:
        raw = raw + "T00:00:00Z"
    return datetime.strptime(raw[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)


def _bind(sql, params):
    parts = sql.split("?")
    if len(parts) != len(params) + 1:
        raise RuntimeError("Query failed")
    out = [parts[0]]
    for i, value in enumerate(params):
        if value is None:
            literal = "NULL"
        else:
            literal = "'" + str(value).replace("'", "''") + "'"
        out.append(literal)
        out.append(parts[i + 1])
    return "".join(out)


def _start(sql, params):
    return ATHENA.start_query_execution(
        QueryString=_bind(sql, params or []),
        QueryExecutionContext={"Database": DATABASE},
        WorkGroup=WORKGROUP,
    )["QueryExecutionId"]


def _wait(qid):
    deadline = time.time() + MAX_WAIT
    state = "RUNNING"
    while time.time() < deadline:
        state = ATHENA.get_query_execution(QueryExecutionId=qid)["QueryExecution"]["Status"]["State"]
        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
        time.sleep(0.4)
    if state != "SUCCEEDED":
        if state in ("RUNNING", "QUEUED"):
            try:
                ATHENA.stop_query_execution(QueryExecutionId=qid)
            except Exception:
                pass
            raise TimeoutError("The query took too long")
        raise RuntimeError("Query failed")
    rows = []
    token = None
    header = None
    while True:
        kw = {"QueryExecutionId": qid, "MaxResults": 1000}
        if token:
            kw["NextToken"] = token
        page = ATHENA.get_query_results(**kw)
        raw_rows = page["ResultSet"]["Rows"]
        start = 0
        if header is None:
            header = [c.get("VarCharValue", "") for c in raw_rows[0]["Data"]]
            start = 1
        for raw in raw_rows[start:]:
            vals = [c.get("VarCharValue") for c in raw["Data"]]
            rows.append(dict(zip(header, vals)))
        token = page.get("NextToken")
        if not token:
            break
    return rows


def _run(sql, params):
    return _wait(_start(sql, params))


def _click_map(raw, extra=None):
    found = {}
    text = _nullish(raw)
    if text:
        try:
            parsed = json.loads(text)
        except Exception:
            parsed = None
        if isinstance(parsed, dict):
            for key, value in parsed.items():
                clean = _nullish(value)
                if clean:
                    found[str(key)] = clean
    for key, value in (extra or {}).items():
        clean = _nullish(value)
        if clean:
            found[key] = clean
    return found


def _stage_label(n):
    return {
        0: None,
        1: "Visit",
        2: "Quiz Start",
        3: "Partial Lead",
        4: "Lead",
        5: "OTP Verified",
        6: "Qualified / Connected",
        7: "Meeting",
        8: "Listing",
        9: "Revenue",
    }.get(int(n or 0))


def _source(row):
    explicit = _nullish(row.get("session_id_source"))
    if explicit in ("native", "inherited", "synthetic"):
        return explicit
    method = (_nullish(row.get("session_id_method")) or "").lower()
    if method == "native":
        return "native"
    if "synthetic" in method:
        return "synthetic"
    if method:
        return "inherited"
    return None


def _session_row(row):
    event_stage = _num(row.get("event_stage")) or 0
    event_stage = max(0, min(int(event_stage), 5))
    hl = int(_num(row.get("hl_stage")) or 0)
    revenue = _num(row.get("expected_revenue")) or 0
    has_revenue = revenue > 0
    number = event_stage
    if hl in (6, 7, 8):
        number = max(number, hl)
    if has_revenue:
        number = 9
    return {
        "session_id": _nullish(row.get("session_id")),
        "raw_session_id": _nullish(row.get("source_session_id")),
        "session_id_source": _source(row),
        "anonymous_id": _nullish(row.get("anonymous_id")),
        "user_id": _nullish(row.get("user_id")),
        "revcloud_person_id": _nullish(row.get("revcloud_person_id")),
        "session_start": _iso(row.get("session_start")),
        "session_end": _iso(row.get("session_end")),
        "duration_seconds": _num(row.get("duration_seconds")),
        "session_date": _nullish(row.get("session_date")),
        "event_count": _num(row.get("event_count")) or 0,
        "entry_channel": _nullish(row.get("entry_channel")),
        "utm_source": _nullish(row.get("entry_utm_source")),
        "entry_utm_source": _nullish(row.get("entry_utm_source")),
        "utm_medium": _nullish(row.get("utm_medium")),
        "utm_campaign": _nullish(row.get("entry_utm_campaign")),
        "entry_utm_campaign": _nullish(row.get("entry_utm_campaign")),
        "utm_content": _nullish(row.get("entry_utm_content")),
        "entry_utm_content": _nullish(row.get("entry_utm_content")),
        "utm_term": _nullish(row.get("utm_term")),
        "entry_page_url": _nullish(row.get("entry_page_url")),
        "clickids": _click_map(row.get("clickids_json")),
        "website_metadata_id": None,
        "has_visit": _bool(row.get("has_visit")),
        "has_quiz_start": _bool(row.get("has_quiz_start")),
        "has_partial_lead": _bool(row.get("has_partial_lead")),
        "has_lead": _bool(row.get("has_lead")),
        "has_otp_verified": _bool(row.get("has_otp_verified")),
        "has_qualified_connected": hl == 6,
        "has_meeting": hl == 7,
        "has_listing": hl == 8,
        "has_revenue": has_revenue,
        "has_consent": _bool(row.get("has_consent")),
        "furthest_stage": _nullish(row.get("hl_furthest_stage")),
        "journey_stage": _stage_label(number),
        "journey_stage_number": number,
        "expected_revenue": revenue,
        "ip_address": _nullish(row.get("session_ip")),
        "session_ip": _nullish(row.get("session_ip")),
        "ip": ({"ip": _nullish(row.get("session_ip"))} if _nullish(row.get("session_ip")) else None),
    }


SELECT_CORE = f"""
SELECT
  s.session_id,
  s.session_id_method,
  s.anonymous_id,
  s.user_id,
  s.revcloud_person_id,
  s.session_start,
  s.session_end,
  s.duration_seconds,
  cast(s.session_date AS varchar) AS session_date,
  s.event_count,
  s.channel AS entry_channel,
  s.utm_source AS entry_utm_source,
  s.utm_medium,
  s.utm_campaign AS entry_utm_campaign,
  s.utm_content AS entry_utm_content,
  s.utm_term,
  s.page_url AS entry_page_url,
  c.clickids_json,
  s.has_visit, s.has_quiz_start, s.has_partial_lead, s.has_lead, s.has_otp_verified, s.has_consent,
  LEAST(COALESCE(s.journey_stage_number, 0), 5) AS event_stage,
  s.session_ip,
  COALESCE(rev.expected_revenue, 0) AS expected_revenue,
  COALESCE(hl.hl_stage, utm.hl_stage, 0) AS hl_stage,
  COALESCE(hl.furthest_stage, utm.furthest_stage) AS hl_furthest_stage
FROM filtered s
LEFT JOIN unified.session_click_ids c
  ON c.session_id = s.session_id AND c.session_date = s.session_date
LEFT JOIN rev ON rev.session_id = s.session_id
LEFT JOIN hl ON hl.session_id = s.session_id
LEFT JOIN utm ON utm.session_id = s.session_id AND hl.session_id IS NULL
"""

WITH_TAILS = f"""
rev AS (
  SELECT re.session_id, sum(re.revenue) AS expected_revenue
  FROM unified.revenue_events re
  INNER JOIN filtered f ON f.session_id = re.session_id
  GROUP BY re.session_id
),
hl AS (
  SELECT b.alyson_session_id AS session_id,
         max({HL_STAGE_SQL}) AS hl_stage,
         max_by(lower(trim(cast(r.furthest_stage AS varchar))), {HL_STAGE_SQL}) AS furthest_stage
  FROM unified.lead_id_bridge b
  INNER JOIN filtered f ON f.session_id = b.alyson_session_id
  INNER JOIN sampledb.revenue_leads_plus r ON cast(r.id AS varchar) = b.buyer_lead_id
  WHERE b.buyer_lead_id IS NOT NULL AND trim(b.buyer_lead_id) <> ''
  GROUP BY b.alyson_session_id
),
utm AS (
  SELECT f.session_id,
         max({HL_STAGE_SQL}) AS hl_stage,
         max_by(lower(trim(cast(r.furthest_stage AS varchar))), {HL_STAGE_SQL}) AS furthest_stage
  FROM filtered f
  INNER JOIN sampledb.revenue_leads_plus r
    ON lower(trim(f.utm_content)) = lower(trim(r.utm_content))
  WHERE NOT EXISTS (
    SELECT 1 FROM unified.lead_id_bridge b
    WHERE b.alyson_session_id = f.session_id
      AND b.buyer_lead_id IS NOT NULL AND trim(b.buyer_lead_id) <> ''
  )
  AND f.utm_content IS NOT NULL AND trim(f.utm_content) <> ''
  GROUP BY f.session_id
)
"""


STAGE_NAMES = {
    "visit": "Visit",
    "quiz": "Quiz Start",
    "quiz start": "Quiz Start",
    "quiz_start": "Quiz Start",
    "partial": "Partial Lead",
    "partial lead": "Partial Lead",
    "partial_lead": "Partial Lead",
    "lead": "Lead",
    "otp": "OTP Verified",
    "otp verified": "OTP Verified",
    "otp_verified": "OTP Verified",
    "qualified": "Qualified / Connected",
    "qualified / connected": "Qualified / Connected",
    "meeting": "Meeting",
    "listing": "Listing",
    "revenue": "Revenue",
}
FLAG_KEYS = (
    "has_visit", "has_quiz_start", "has_partial_lead",
    "has_lead", "has_otp_verified", "has_consent",
)
FLAG_ALIASES = {
    "quiz_start": "has_quiz_start",
    "partial_lead": "has_partial_lead",
    "otp_verified": "has_otp_verified",
    "consent": "has_consent",
}


def _bool_param(name, raw):
    val = _nullish(raw)
    if val is None:
        return None
    low = val.lower()
    if low not in ("true", "false", "1", "0"):
        raise ValueError(f"{name} must be true or false")
    return low in ("true", "1")


def _stage_name(raw):
    val = _nullish(raw)
    if not val:
        return None
    if len(val) > 80:
        raise ValueError("journey_stage is too long")
    key = val.lower().replace("-", " ").replace("_", " ")
    key = " ".join(key.split())
    named = STAGE_NAMES.get(key) or STAGE_NAMES.get(key.replace(" ", "_"))
    if named:
        return named
    for label in STAGE_NAMES.values():
        if label.lower() == val.lower():
            return label
    return val


def _filters(qs):
    now = datetime.now(timezone.utc)
    start = _parse_when(qs.get("from"), "from") or (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
    end = _parse_when(qs.get("to"), "to") or now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    if end <= start:
        raise ValueError("to must be after from")
    if (end - start).days > 31:
        raise ValueError("date range cannot exceed 31 days")
    params = [start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"), _workspace]
    where = [
        "s.session_date >= DATE ?",
        "s.session_date < DATE ?",
        "s.session_start IS NOT NULL",
        "cast(s.workspace_id AS varchar) = ?",
    ]
    applied = {}
    search = _nullish(qs.get("search"))
    if search:
        if not SESSION_RE.match(search) and len(search) > 200:
            raise ValueError("search is too long")
        where.append("(s.session_id = ? OR s.anonymous_id = ? OR s.user_id = ? OR s.revcloud_person_id = ?)")
        params.extend([search, search, search, search])
        applied["search"] = search
    for key, col in (("channel", "s.channel"), ("utm_source", "s.utm_source"), ("utm_campaign", "s.utm_campaign")):
        val = _nullish(qs.get(key))
        if val:
            if len(val) > 200:
                raise ValueError(f"{key} is too long")
            where.append(f"{col} = ?")
            params.append(val)
            applied[key] = val
    stage = _stage_name(qs.get("journey_stage"))
    if stage:
        applied["journey_stage"] = stage
    flags = {}
    for flag in FLAG_KEYS:
        raw = qs.get(flag)
        if raw is None:
            alias = next((a for a, dest in FLAG_ALIASES.items() if dest == flag), None)
            if alias:
                raw = qs.get(alias)
        parsed = _bool_param(flag, raw)
        if parsed is not None:
            flags[flag] = parsed
            where.append(f"COALESCE(s.{flag}, false) = " + ("true" if parsed else "false"))
            applied[flag] = parsed
    has_revenue = _bool_param("has_revenue", qs.get("has_revenue"))
    if has_revenue is not None:
        applied["has_revenue"] = has_revenue
    return where, params, stage, has_revenue, applied


def _filtered_sql(where, stage_filter):
    wh = list(where)
    if stage_filter:
        # journey_stage is computed after joins; filter in the outer query
        wh = [w for w in wh if "lower(?)" not in w]
    return "filtered AS (\n  SELECT s.* FROM unified.unified_session_summary s\n  WHERE " + " AND ".join(wh) + "\n),\n" + WITH_TAILS


def _list(qs, origin):
    try:
        page = int(qs.get("page") or "1")
        page_size = int(qs.get("page_size") or "50")
    except ValueError:
        return _err(400, "page and page_size must be integers", origin)
    if page < 1 or page_size < 1 or page_size > 200:
        return _err(400, "page_size must be from 1 to 200", origin)
    sort = SORTS.get(qs.get("sort") or "session_start")
    if sort is None:
        return _err(400, "sort must be session_start, expected_revenue, or event_count", origin)
    order = (qs.get("order") or "desc").lower()
    if order not in ("asc", "desc"):
        return _err(400, "order must be asc or desc", origin)
    try:
        where, params, stage, has_revenue, applied = _filters(qs)
    except ValueError as e:
        return _err(400, str(e), origin)
    outer = []
    outer_params = []
    if stage:
        outer.append("lower(journey_stage) = lower(?)")
        outer_params.append(stage)
    if has_revenue is not None:
        if has_revenue:
            outer.append("expected_revenue > 0")
        else:
            outer.append("expected_revenue <= 0")
    outer_sql = (" WHERE " + " AND ".join(outer)) if outer else ""
    offset = (page - 1) * page_size
    sql = f"""
WITH {_filtered_sql(where, stage)}
, base AS (
  {SELECT_CORE}
)
SELECT scored.*, count(*) OVER () AS total_count, max(session_start) OVER () AS latest_session_at,
  sum(CASE WHEN COALESCE(has_visit, false) THEN 1 ELSE 0 END) OVER () AS n_visit,
  sum(CASE WHEN COALESCE(has_quiz_start, false) THEN 1 ELSE 0 END) OVER () AS n_quiz_start,
  sum(CASE WHEN COALESCE(has_partial_lead, false) THEN 1 ELSE 0 END) OVER () AS n_partial_lead,
  sum(CASE WHEN COALESCE(has_lead, false) THEN 1 ELSE 0 END) OVER () AS n_lead,
  sum(CASE WHEN COALESCE(has_otp_verified, false) THEN 1 ELSE 0 END) OVER () AS n_otp_verified,
  sum(CASE WHEN COALESCE(has_consent, false) THEN 1 ELSE 0 END) OVER () AS n_consent,
  sum(COALESCE(event_count, 0)) OVER () AS n_events
FROM (
  SELECT
    session_id, session_id_method, anonymous_id, user_id,
    revcloud_person_id, session_start, session_end, duration_seconds, session_date, event_count,
    entry_channel, entry_utm_source, utm_medium, entry_utm_campaign, entry_utm_content, utm_term,
    entry_page_url, clickids_json,
    has_visit, has_quiz_start, has_partial_lead, has_lead, has_otp_verified, has_consent,
    event_stage, session_ip, expected_revenue, hl_stage, hl_furthest_stage,
    CASE
      WHEN expected_revenue > 0 THEN 'Revenue'
      WHEN hl_stage = 8 THEN 'Listing'
      WHEN hl_stage = 7 THEN 'Meeting'
      WHEN hl_stage = 6 THEN 'Qualified / Connected'
      WHEN event_stage = 5 THEN 'OTP Verified'
      WHEN event_stage = 4 THEN 'Lead'
      WHEN event_stage = 3 THEN 'Partial Lead'
      WHEN event_stage = 2 THEN 'Quiz Start'
      WHEN event_stage = 1 THEN 'Visit'
      ELSE NULL
    END AS journey_stage
  FROM base
) scored
{outer_sql}
ORDER BY {sort} {order}
OFFSET {offset} LIMIT {page_size}
"""
    try:
        rows = _run(sql, params + outer_params)
    except TimeoutError:
        return _err(504, "The query took too long", origin)
    except RuntimeError:
        return _err(500, "Could not load sessions", origin)
    total = int(_num(rows[0]["total_count"]) or 0) if rows else 0
    latest = _iso(rows[0].get("latest_session_at")) if rows else None
    if not rows:
        total = 0
    return _resp(200, {
        "rows": [_session_row(r) for r in rows],
        "page": page,
        "page_size": page_size,
        "total": total,
        "latest_session_at": latest,
        "applied_filters": applied,
        "counts": {
            "visit": int(_num(rows[0]["n_visit"]) or 0) if rows else 0,
            "quiz_start": int(_num(rows[0]["n_quiz_start"]) or 0) if rows else 0,
            "partial_lead": int(_num(rows[0]["n_partial_lead"]) or 0) if rows else 0,
            "lead": int(_num(rows[0]["n_lead"]) or 0) if rows else 0,
            "otp_verified": int(_num(rows[0]["n_otp_verified"]) or 0) if rows else 0,
            "consent": int(_num(rows[0]["n_consent"]) or 0) if rows else 0,
            "events": int(_num(rows[0]["n_events"]) or 0) if rows else 0,
        },
    }, origin)


def _params_for(qs):
    now = datetime.now(timezone.utc)
    start = _parse_when(qs.get("from"), "from") or (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
    end = _parse_when(qs.get("to"), "to") or now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    params = [start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"), _workspace]
    search = _nullish(qs.get("search"))
    if search:
        params.extend([search, search, search, search])
    for key in ("channel", "utm_source", "utm_campaign"):
        val = _nullish(qs.get(key))
        if val:
            params.append(val)
    return params


def _detail(session_id, origin):
    if not SESSION_RE.match(session_id):
        return _err(400, "session_id is invalid", origin)
    sql = f"""
WITH filtered AS (
  SELECT s.* FROM unified.unified_session_summary s
  WHERE s.session_id = ? AND cast(s.workspace_id AS varchar) = ?
),
{WITH_TAILS}
{SELECT_CORE.replace("  s.session_ip,", "  s.session_ip,\n  s.plugin_json,", 1)}
"""
    try:
        rows = _run(sql, [session_id, _workspace])
    except TimeoutError:
        return _err(504, "The query took too long", origin)
    except RuntimeError:
        return _err(500, "Could not load the session", origin)
    if not rows:
        return _err(404, "Session not found", origin)
    body = _session_row(rows[0])
    day = body.get("session_date") or "1970-01-01"
    try:
        click_qid = _start(
            """
            SELECT clickids_json, clickid_gclid, clickid_fbclid, clickid_pixel_id, clickid_txn_id, clickid_cid,
                   clickid_affid, clickid_clickid, clickid_router_event_id, clickid_task_event_id,
                   clickid_tune_click_id
            FROM unified.session_click_ids
            WHERE session_id = ? AND session_date = DATE ?
            """,
            [session_id, day],
        )
        ip_qid = _start(
            """
            SELECT ip, country_code, country_name, region_name, district, city_name,
                   cast(latitude AS varchar) AS latitude, cast(longitude AS varchar) AS longitude,
                   area_code, time_zone, zip_code,
                   cast(is_proxy AS varchar) AS is_proxy,
                   cast("proxy.is_vpn" AS varchar) AS is_vpn,
                   cast("proxy.proxy_type" AS varchar) AS proxy_type
            FROM raw.ip2locations_data
            WHERE ip = ?
            LIMIT 1
            """,
            [body.get("ip_address") or ""],
        ) if body.get("ip_address") else None
        rev_qid = _start(
            """
            SELECT event_id, source_id, lead_id, cast(revenue AS varchar) AS revenue,
                   cast(event_time AS varchar) AS event_time
            FROM unified.revenue_events
            WHERE session_id = ?
            ORDER BY event_time
            """,
            [session_id],
        )
        plugin_from = _shift_iso(body.get("session_start"), -5) or f"{day}T00:00:00Z"
        plugin_to = _shift_iso(body.get("session_end"), 10)
        if not plugin_to:
            try:
                plugin_to = (
                    datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
                ).strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                plugin_to = f"{day}T23:59:59Z"
        ev_qid = _start(
            """
            SELECT messageid, type, event, cast(timestamp AS varchar) AS timestamp, raw_payload_json
            FROM raw.segment_events
            WHERE ingest_date >= DATE ? - INTERVAL '2' DAY
              AND ingest_date < DATE ? + INTERVAL '21' DAY
              AND (
                canonical_session_id = ?
                OR context_sessionid = ?
                OR properties_sessionid = ?
                OR (
                  lower(trim(coalesce(event, ''))) = 'plugin_step_completed'
                  AND coalesce(trim(canonical_session_id), '') = ''
                  AND coalesce(trim(context_sessionid), '') = ''
                  AND coalesce(trim(properties_sessionid), '') = ''
                  AND from_iso8601_timestamp(timestamp) >= from_iso8601_timestamp(?)
                  AND from_iso8601_timestamp(timestamp) <= from_iso8601_timestamp(?)
                  AND (
                    anonymousid = ?
                    OR userid = ?
                  )
                )
              )
            ORDER BY timestamp
            LIMIT 500
            """,
            [day, day, session_id, session_id, session_id, plugin_from, plugin_to, body.get("anonymous_id"), body.get("user_id")],
        )
        click_rows = _wait(click_qid)
        ip_rows = _wait(ip_qid) if ip_qid else []
        rev_rows = _wait(rev_qid)
        ev_rows = _wait(ev_qid)
    except TimeoutError:
        return _err(504, "The query took too long", origin)
    except RuntimeError:
        return _err(500, "Could not load the session", origin)
    click = _click_map((click_rows[0].get("clickids_json") if click_rows else None), body.get("clickids"))
    names = {
        "clickid_gclid": "gclid", "clickid_fbclid": "fbclid", "clickid_pixel_id": "pixel_id",
        "clickid_txn_id": "txn_id", "clickid_cid": "cid", "clickid_affid": "affid",
        "clickid_clickid": "clickid", "clickid_router_event_id": "router_event_id",
        "clickid_task_event_id": "task_event_id", "clickid_tune_click_id": "tune_click_id",
    }
    for row in click_rows:
        for col, key in names.items():
            val = _nullish(row.get(col))
            if val:
                click[key] = val
    ip = None
    if ip_rows:
        r = ip_rows[0]
        ip = {
            "ip": _nullish(r.get("ip")),
            "country_code": _nullish(r.get("country_code")),
            "country_name": _nullish(r.get("country_name")),
            "region_name": _nullish(r.get("region_name")),
            "district": _nullish(r.get("district")),
            "city_name": _nullish(r.get("city_name")),
            "latitude": _num(r.get("latitude")),
            "longitude": _num(r.get("longitude")),
            "area_code": _nullish(r.get("area_code")),
            "time_zone": _nullish(r.get("time_zone")),
            "zip_code": _nullish(r.get("zip_code")),
            "is_proxy": _bool(r.get("is_proxy")) if _nullish(r.get("is_proxy")) is not None else None,
            "is_vpn": _bool(r.get("is_vpn")) if _nullish(r.get("is_vpn")) is not None else None,
            "is_bot_click": (str(_nullish(r.get("proxy_type")) or "").strip().upper() in {"DCH", "EPN", "PUB", "RES", "SES"}),
        }
    events_rev = []
    for r in rev_rows:
        events_rev.append({
            "revenue_event_id": _nullish(r.get("event_id")),
            "source_id": _nullish(r.get("source_id")),
            "client_lead_id": _nullish(r.get("lead_id")),
            "revenue": _num(r.get("revenue")) or 0,
            "event_at": _iso(r.get("event_time")),
        })
    timeline = []
    seen = set()
    for r in ev_rows:
        event_id = _nullish(r.get("messageid"))
        if event_id and event_id in seen:
            continue
        if event_id:
            seen.add(event_id)
        raw = _nullish(r.get("raw_payload_json"))
        parsed = raw
        if raw:
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = raw
        event_name = _nullish(r.get("event"))
        if not event_name and isinstance(parsed, dict):
            event_name = _nullish(parsed.get("event") or parsed.get("name"))
        timeline.append({
            "event_id": event_id,
            "type": _nullish(r.get("type")),
            "event_name": event_name,
            "timestamp": _iso(r.get("timestamp")),
            "raw": parsed,
            "payload": parsed,
            "raw_payload": parsed,
        })
    plugins = _plugin_list(rows[0].get("plugin_json"))
    seen_plugin = set()
    for event in timeline:
        if (event.get("event_name") or "").lower() != "plugin_step_completed":
            continue
        payload = event.get("raw") if isinstance(event.get("raw"), dict) else {}
        props = payload.get("properties") if isinstance(payload.get("properties"), dict) else payload
        key = _plugin_key(props)
        if key:
            seen_plugin.add(key)
    for props in plugins:
        key = _plugin_key(props)
        if key and key in seen_plugin:
            continue
        if key:
            seen_plugin.add(key)
        timeline.append({
            "event_id": _nullish(props.get("execution_id")),
            "type": "track",
            "event_name": "plugin_step_completed",
            "timestamp": _iso(props.get("timestamp")),
            "raw": props,
            "payload": props,
            "raw_payload": props,
        })
    timeline.sort(key=lambda event: event.get("timestamp") or "")
    body["plugin_json"] = plugins
    body["clickids"] = click or body.get("clickids") or {}
    if ip:
        if not ip.get("ip") and body.get("ip_address"):
            ip["ip"] = body["ip_address"]
        body["ip"] = ip
    elif body.get("ip_address"):
        body["ip"] = {"ip": body["ip_address"]}
    else:
        body["ip"] = None
    body["is_bot_click"] = bool(ip and ip.get("is_bot_click"))
    body["revenue"] = {"expected_revenue": body["expected_revenue"], "events": events_rev}
    body["events"] = timeline
    body["event_payloads"] = timeline
    return _resp(200, body, origin)


def _facets(qs, origin):
    try:
        where, params, stage, _has_rev, _applied = _filters(qs)
    except ValueError as e:
        return _err(400, str(e), origin)
    where = [w for w in where if "lower(?)" not in w]
    sql = f"""
WITH filtered AS (
  SELECT s.* FROM unified.unified_session_summary s
  WHERE {' AND '.join(where)}
)
SELECT
  array_join(slice(array_sort(array_distinct(filter(array_agg(channel), x -> x IS NOT NULL AND trim(x) <> ''))), 1, 200), '|') AS channels,
  array_join(slice(array_sort(array_distinct(filter(array_agg(utm_source), x -> x IS NOT NULL AND trim(x) <> ''))), 1, 200), '|') AS utm_sources,
  array_join(slice(array_sort(array_distinct(filter(array_agg(utm_campaign), x -> x IS NOT NULL AND trim(x) <> ''))), 1, 200), '|') AS utm_campaigns
FROM filtered
"""
    stage_sql = f"""
WITH {_filtered_sql(where, True)}
, base AS ( {SELECT_CORE} )
SELECT array_join(slice(array_sort(array_distinct(filter(array_agg(
  CASE
    WHEN expected_revenue > 0 THEN 'Revenue'
    WHEN hl_stage = 8 THEN 'Listing'
    WHEN hl_stage = 7 THEN 'Meeting'
    WHEN hl_stage = 6 THEN 'Qualified / Connected'
    WHEN event_stage = 5 THEN 'OTP Verified'
    WHEN event_stage = 4 THEN 'Lead'
    WHEN event_stage = 3 THEN 'Partial Lead'
    WHEN event_stage = 2 THEN 'Quiz Start'
    WHEN event_stage = 1 THEN 'Visit'
    ELSE NULL
  END
), x -> x IS NOT NULL))), 1, 20), '|') AS journey_stages
FROM base
"""
    try:
        simple = _run(sql, params)
        stages = _run(stage_sql, params)
    except TimeoutError:
        return _err(504, "The query took too long", origin)
    except RuntimeError:
        return _err(500, "Could not load facets", origin)

    def split(v):
        s = _nullish(v)
        return [] if not s else [p for p in s.split("|") if p]

    row = simple[0] if simple else {}
    st = stages[0] if stages else {}
    return _resp(200, {
        "channels": split(row.get("channels")),
        "utm_sources": split(row.get("utm_sources")),
        "utm_campaigns": split(row.get("utm_campaigns")),
        "journey_stages": split(st.get("journey_stages")),
    }, origin)


def handler(event, context):
    global _workspace
    _workspace = None
    origin = (event.get("headers") or {}).get("origin") or (event.get("headers") or {}).get("Origin")
    method = (event.get("requestContext") or {}).get("http", {}).get("method") or event.get("httpMethod") or "GET"
    if method == "OPTIONS":
        return _resp(200, {}, origin)
    try:
        _workspace = authenticate_request(event, require_workspace=True).workspace_id
    except AuthError as exc:
        return auth_response(exc, _headers(origin))
    path = event.get("rawPath") or event.get("path") or ""
    path = path.split("?")[0]
    if path.endswith("/"):
        path = path[:-1]
    qs = event.get("queryStringParameters") or {}
    multi = event.get("multiValueQueryStringParameters") or {}
    for key, values in multi.items():
        if key not in qs or qs.get(key) in (None, ""):
            qs[key] = values[0] if isinstance(values, list) and values else values
    try:
        if path.endswith("/sessions/facets"):
            return _facets(qs, origin)
        if path.endswith("/sessions"):
            return _list(qs, origin)
        marker = "/sessions/"
        if marker in path:
            session_id = path.rsplit("/", 1)[-1]
            return _detail(session_id, origin)
        return _err(404, "Not found", origin)
    except ValueError as e:
        return _err(400, str(e), origin)
    except Exception as exc:
        code = ""
        resp = getattr(exc, "response", None)
        if isinstance(resp, dict):
            code = str((resp.get("Error") or {}).get("Code") or "")
        print(type(exc).__name__, code)
        return _err(500, "Could not complete the request", origin)
