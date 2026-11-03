"""Rules API for the UI. Reads and writes only unified.rule.

POST /rules inserts a new version. It does not edit the previous row.
POST /rules/inactive marks one version INACTIVE.
GET /rules lists every version.
GET /rules/columns?source= lists the source table columns a rule can filter on.
GET /rules/filter-options?source= lists distinct vendor_id / offer_id values
for HomeLight (from unified.revenue_events) and UCT (from unified.uct_revenue).
POST /reconcile/check compares source vs revenue_events and writes unified.reconciliation_log.
GET /reconcile/log returns those rows. A matched date is not checked again.

Not wired to the Lovable app in this step. tune-identifier is unchanged.
"""

import json
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone

import boto3

from auth import AuthError, authenticate_request, auth_response, cors_headers

logger = logging.getLogger()
logger.setLevel(logging.INFO)
_auth = None

RULES_TABLE = "unified.rule"
LOG_TABLE = "unified.reconciliation_log"
ATHENA_WORKGROUP = os.environ.get("ATHENA_WORKGROUP", "ipintel_etl")
ATHENA_OUTPUT_LOCATION = os.environ["ATHENA_OUTPUT_LOCATION"]
RULE_ID_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
SOURCE_ID_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
TABLE_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$")
ALLOWED_TYPES = {"COST", "REVENUE"}
NUMBER_RE = re.compile(r"^\d+(\.\d+)?$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9_]{1,64}$")
MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
DAY_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")
TUNE_FIELDS = {"status", "payout_cents", "revenue_cents"}
HOMELIGHT_FIELDS = {"expected_revenue", "is_closed", "is_deal"}
HL_UTM = "('aff-cc', 'cc', 'aff-bsm', 'aff-flu', 'aff-le', 'aff-cc,Klaviyo')"
HL_MARKETING = "('aff-cc', 'cc', 'aff-bsm', 'aff-flu', 'aff-le', 'aff-cc,Klaviyo', 'aff-flux2')"


def hl_affiliate_sql(alias=""):
    prefix = f"{alias}." if alias else ""
    return (
        f"(trim({prefix}utm_source) IN {HL_UTM} "
        f"OR trim({prefix}marketing_source) IN {HL_MARKETING})"
    )
RULE_SOURCES = {
    "homelight": "sampledb.revenue_leads_plus",
    "uct": "unified.uct_revenue",
    "phonexa": "raw.phonexa_ref_raw",
    "tune": "raw.raw_tune_clicks",
    "sms": "unified.uct_events",
}
SMS_CONNECTORS = {"57": "PitchPrfct SMS", "77": "Klaviyo FluxaLeads"}
# HomeLight's source table has no vendor_id / offer_id. Those ids live on
# unified.revenue_events and are still allowed as Other-filter conditions.
EXTRA_FILTER_COLUMNS = {
    "homelight": {"vendor_id": "string", "offer_id": "string"},
}
FILTER_OPTION_SOURCES = {
    "homelight": ("unified.revenue_events", "source_id = 'homelight'"),
    "uct": ("unified.uct_revenue", "1 = 1"),
}
COLUMN_RE = re.compile(r"^[A-Za-z0-9_]{1,128}$")
SIGNED_NUMBER_RE = re.compile(r"^-?\d+(\.\d+)?$")
TEXT_OPS = {"equals", "not_equals", "in", "not_in", "contains", "not_contains"}
NUMBER_OPS = {"greater_than", "gte", "less_than", "lte", "gte_cents"}
EMPTY_OPS = {"is_empty", "is_not_empty"}
CALC_KINDS = {"revenue_share", "roas", "event_based"}
MAX_FILTERS = 25
MAX_VALUES = 200
MAX_TEXT = 200

athena = boto3.client("athena")
glue = boto3.client("glue")
_columns_cache = {}
_filter_cache = {}
FILTER_CACHE_TTL = 300


class BadRequest(Exception):
    pass


def response(status, body):
    return {
        "statusCode": status,
        "headers": cors_headers(),
        "body": json.dumps(body, default=str),
    }


def workspace_id():
    if _auth is None or not _auth.workspace_id:
        raise BadRequest("workspace is required")
    return _auth.workspace_id


def actor_email():
    if _auth is None:
        return "system"
    return _auth.user.get("verifiedEmail") or _auth.user.get("email") or _auth.user.get("cognitoSub") or "system"


def sql_string(value):
    return "'" + str(value).replace("'", "''") + "'"


def start_and_wait(sql):
    query_id = athena.start_query_execution(
        QueryString=sql,
        WorkGroup=ATHENA_WORKGROUP,
        ResultConfiguration={"OutputLocation": ATHENA_OUTPUT_LOCATION},
    )["QueryExecutionId"]
    delay = 0.5
    while True:
        status = athena.get_query_execution(QueryExecutionId=query_id)["QueryExecution"]["Status"]
        state = status["State"]
        if state == "SUCCEEDED":
            return query_id
        if state in ("FAILED", "CANCELLED"):
            raise RuntimeError(status.get("StateChangeReason", state))
        time.sleep(delay)
        delay = min(delay * 2, 3)


def read_rows(query_id):
    paginator = athena.get_paginator("get_query_results")
    first = True
    for page in paginator.paginate(QueryExecutionId=query_id):
        for row in page["ResultSet"]["Rows"]:
            if first:
                first = False
                continue
            yield [col.get("VarCharValue") for col in row["Data"]]


def list_rules():
    query_id = start_and_wait(
        f"""
        SELECT rule_id, CAST(rule_version AS varchar), name, description, type, source_id,
               source_table, conditions, calculation, status,
               CAST(effective_from AS varchar), CAST(effective_to AS varchar),
               created_by, CAST(created_at AS varchar), workspace_id
        FROM {RULES_TABLE}
        WHERE workspace_id = {sql_string(workspace_id())}
        ORDER BY rule_id, rule_version
        """
    )
    columns = (
        "rule_id", "rule_version", "name", "description", "type", "source_id",
        "source_table", "conditions", "calculation", "status",
        "effective_from", "effective_to", "created_by", "created_at", "workspace_id",
    )
    return response(200, {"rules": [dict(zip(columns, row)) for row in read_rows(query_id)]})


def parse_rule(body):
    if not isinstance(body, dict):
        raise BadRequest("body must be a JSON object")
    rule_id = body.get("rule_id", "")
    if not isinstance(rule_id, str) or not RULE_ID_RE.match(rule_id):
        raise BadRequest("rule_id must be lowercase letters, numbers, and underscores")
    rule_type = body.get("type")
    if rule_type not in ALLOWED_TYPES:
        raise BadRequest("type must be COST or REVENUE")
    source_id = body.get("source_id", "")
    if not isinstance(source_id, str) or not SOURCE_ID_RE.match(source_id):
        raise BadRequest("source_id is invalid")
    source_table = body.get("source_table", "")
    if not isinstance(source_table, str) or not TABLE_RE.match(source_table):
        raise BadRequest("source_table must look like database.table")
    if source_table == "unified.unified_revenue":
        raise BadRequest("unified.unified_revenue is not a rule source")
    name = body.get("name") or rule_id
    description = body.get("description") or ""
    if not isinstance(name, str) or not isinstance(description, str):
        raise BadRequest("name and description must be text")
    if len(name) > 200 or len(description) > 2000:
        raise BadRequest("name or description is too long")
    conditions = body.get("conditions")
    calculation = body.get("calculation")
    if not isinstance(conditions, (dict, list)) or not isinstance(calculation, dict):
        raise BadRequest("conditions must be a JSON array or object, calculation a JSON object")
    created_by = body.get("created_by") or "ui"
    if not isinstance(created_by, str) or len(created_by) > 100:
        raise BadRequest("created_by is invalid")
    if source_id in RULE_SOURCES:
        if source_table != RULE_SOURCES[source_id]:
            raise BadRequest(f"source_table for {source_id} must be {RULE_SOURCES[source_id]}")
        columns = source_columns(source_id)
        filter_sql(conditions, filter_columns(source_id))
        if source_id == "sms":
            if rule_type != "COST":
                raise BadRequest("SMS rules are COST rules")
            check_sms(conditions, calculation)
        else:
            check_calculation(calculation, columns)
    check_dates(body, calculation)
    return {
        "rule_id": rule_id,
        "type": rule_type,
        "source_id": source_id,
        "source_table": source_table,
        "name": name,
        "description": description,
        "conditions": json.dumps(conditions, separators=(",", ":")),
        "calculation": json.dumps(calculation, separators=(",", ":")),
        "created_by": created_by,
    }


def save_rule(body):
    rule = parse_rule(body)
    version_id = start_and_wait(
        f"""
        SELECT COALESCE(CAST(MAX(rule_version) AS varchar), '0')
        FROM {RULES_TABLE}
        WHERE rule_id = {sql_string(rule['rule_id'])}
        """
    )
    versions = list(read_rows(version_id))
    next_version = int(versions[0][0]) + 1 if versions else 1
    start_and_wait(
        f"""
        UPDATE {RULES_TABLE}
        SET status = 'INACTIVE', effective_to = current_timestamp
        WHERE rule_id = {sql_string(rule['rule_id'])}
          AND status = 'ACTIVE'
          AND workspace_id = {sql_string(workspace_id())}
        """
    )
    start_and_wait(
        f"""
        INSERT INTO {RULES_TABLE}
        (rule_id, rule_version, name, description, type, source_id, source_table,
         conditions, calculation, status, effective_from, effective_to, created_by, created_at, workspace_id)
        SELECT {sql_string(rule['rule_id'])}, {next_version}, {sql_string(rule['name'])},
               {sql_string(rule['description'])}, {sql_string(rule['type'])},
               {sql_string(rule['source_id'])}, {sql_string(rule['source_table'])},
               {sql_string(rule['conditions'])}, {sql_string(rule['calculation'])},
               'ACTIVE', current_timestamp, CAST(NULL AS timestamp),
               {sql_string(actor_email())}, current_timestamp, {sql_string(workspace_id())}
        """
    )
    return response(201, {"rule_id": rule["rule_id"], "rule_version": next_version, "status": "ACTIVE"})


def deactivate(body):
    if not isinstance(body, dict):
        raise BadRequest("body must be a JSON object")
    rule_id = body.get("rule_id", "")
    version = body.get("rule_version")
    if not isinstance(rule_id, str) or not RULE_ID_RE.match(rule_id):
        raise BadRequest("rule_id is invalid")
    if isinstance(version, bool) or not isinstance(version, int):
        raise BadRequest("rule_version must be an integer")
    start_and_wait(
        f"""
        UPDATE {RULES_TABLE}
        SET status = 'INACTIVE', effective_to = current_timestamp
        WHERE rule_id = {sql_string(rule_id)}
          AND rule_version = {version}
          AND workspace_id = {sql_string(workspace_id())}
        """
    )
    return response(200, {"rule_id": rule_id, "rule_version": version, "status": "INACTIVE"})


def source_columns(source_id):
    if source_id not in RULE_SOURCES:
        raise BadRequest("source must be one of " + ", ".join(sorted(RULE_SOURCES)))
    if source_id not in _columns_cache:
        database, table = RULE_SOURCES[source_id].split(".")
        cols = glue.get_table(DatabaseName=database, Name=table)["Table"]["StorageDescriptor"]["Columns"]
        _columns_cache[source_id] = {c["Name"]: c["Type"] for c in cols}
    return _columns_cache[source_id]


def filter_columns(source_id):
    columns = dict(source_columns(source_id))
    columns.update(EXTRA_FILTER_COLUMNS.get(source_id, {}))
    return columns


def list_columns(params):
    source_id = (params or {}).get("source", "")
    columns = filter_columns(source_id)
    return response(200, {
        "source": source_id,
        "table": RULE_SOURCES[source_id],
        "columns": [{"name": name, "type": col_type} for name, col_type in columns.items()],
        "operators": sorted(TEXT_OPS | NUMBER_OPS | EMPTY_OPS | {"between"}),
        **({"connectors": [{"id": k, "name": v} for k, v in SMS_CONNECTORS.items()]} if source_id == "sms" else {}),
    })


def list_filter_options(params):
    source_id = (params or {}).get("source", "")
    if source_id not in FILTER_OPTION_SOURCES:
        raise BadRequest("source must be homelight or uct")
    cached = _filter_cache.get(source_id)
    now = time.time()
    if cached and now - cached[0] < FILTER_CACHE_TTL:
        vendors, offers = cached[1]
        return response(200, {"source": source_id, "vendors": vendors, "offers": offers})
    table, extra = FILTER_OPTION_SOURCES[source_id]
    query_id = start_and_wait(
        f"""
        SELECT kind, id
        FROM (
          SELECT 'vendor' AS kind, trim(CAST(vendor_id AS varchar)) AS id
          FROM {table}
          WHERE {extra} AND nullif(trim(CAST(vendor_id AS varchar)), '') IS NOT NULL
          GROUP BY 2
          UNION ALL
          SELECT 'offer' AS kind, trim(CAST(offer_id AS varchar)) AS id
          FROM {table}
          WHERE {extra} AND nullif(trim(CAST(offer_id AS varchar)), '') IS NOT NULL
          GROUP BY 2
        )
        ORDER BY kind, id
        """
    )
    vendors, offers = [], []
    for kind, option_id in read_rows(query_id):
        if not option_id:
            continue
        (vendors if kind == "vendor" else offers).append({"id": option_id})
    _filter_cache[source_id] = (now, (vendors, offers))
    return response(200, {"source": source_id, "vendors": vendors, "offers": offers})


def filter_sql(items, columns):
    """Build a WHERE clause from UI filters. Raises BadRequest on anything not allowed."""
    if not isinstance(items, list):
        raise BadRequest("conditions must be a JSON array")
    if len(items) > MAX_FILTERS:
        raise BadRequest(f"at most {MAX_FILTERS} filters")
    parts = []
    for item in items:
        if not isinstance(item, dict):
            raise BadRequest("each filter must be an object")
        field, op, value = item.get("field"), item.get("op"), item.get("value")
        if not isinstance(field, str) or not COLUMN_RE.match(field) or field not in columns:
            raise BadRequest(f"unknown column: {field}")
        col = f'"{field}"'
        if op in EMPTY_OPS:
            empty = f"nullif(trim(CAST({col} AS varchar)), '') IS NULL"
            parts.append(empty if op == "is_empty" else f"NOT ({empty})")
        elif op in NUMBER_OPS or op == "between":
            values = value if op == "between" else [value]
            if not isinstance(values, list) or len(values) != (2 if op == "between" else 1):
                raise BadRequest(f"{field}: between needs [low, high]")
            numbers = [str(v) for v in values]
            if not all(SIGNED_NUMBER_RE.match(n) for n in numbers):
                raise BadRequest(f"{field}: value must be a number")
            number = f"try_cast({col} AS double)"
            if op == "gte_cents":
                number = f"ROUND(COALESCE({number}, 0), 2)"
            if op == "between":
                parts.append(f"{number} BETWEEN {numbers[0]} AND {numbers[1]}")
            else:
                compare = {"greater_than": ">", "gte": ">=", "gte_cents": ">=", "less_than": "<", "lte": "<="}[op]
                parts.append(f"{number} {compare} {numbers[0]}")
        elif op in TEXT_OPS:
            values = value if isinstance(value, list) else [value]
            if op in ("equals", "not_equals", "contains", "not_contains") and len(values) != 1:
                raise BadRequest(f"{field}: {op} takes one value")
            if not values or len(values) > MAX_VALUES:
                raise BadRequest(f"{field}: 1 to {MAX_VALUES} values")
            texts = []
            for v in values:
                if isinstance(v, bool) or not isinstance(v, (str, int, float)) or len(str(v)) > MAX_TEXT:
                    raise BadRequest(f"{field}: values must be text up to {MAX_TEXT} characters")
                texts.append(str(v).strip().lower())
            text = f"lower(trim(COALESCE(CAST({col} AS varchar), '')))"
            if op in ("contains", "not_contains"):
                pattern = texts[0].replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                like = f"{text} LIKE {sql_string('%' + pattern + '%')} ESCAPE '\\'"
                parts.append(like if op == "contains" else f"NOT ({like})")
            else:
                listed = ", ".join(sql_string(t) for t in texts)
                parts.append(f"{text} {'NOT IN' if op in ('not_equals', 'not_in') else 'IN'} ({listed})")
        else:
            raise BadRequest(f"{field}: unknown operator {op}")
    return " AND ".join(parts) if parts else "1 = 1"


def check_dates(body, calc):
    start = body.get("start_date", calc.get("start_date"))
    end = body.get("end_date", calc.get("end_date"))
    for label, value in (("start_date", start), ("end_date", end)):
        if value not in (None, "") and (not isinstance(value, str) or not DAY_RE.match(value)):
            raise BadRequest(f"{label} must be YYYY-MM-DD")
    if start and end and end < start:
        raise BadRequest("end_date is before start_date")
    calc.pop("start_date", None)
    calc.pop("end_date", None)
    if start:
        calc["start_date"] = start
    if end:
        calc["end_date"] = end


def check_sms(conditions, calc):
    connectors = [
        c.get("value") for c in conditions
        if isinstance(c, dict) and c.get("field") == "connector_id" and c.get("op") == "equals"
    ]
    if len(connectors) != 1 or str(connectors[0]) not in SMS_CONNECTORS:
        raise BadRequest("SMS rules need one connector_id equals filter: " + ", ".join(SMS_CONNECTORS))
    if calc.get("kind") != "sms_per_count":
        raise BadRequest("SMS rules use calculation kind sms_per_count")
    per = str(calc.get("per_count", ""))
    amount = str(calc.get("amount", ""))
    if not NUMBER_RE.match(per) or float(per) <= 0:
        raise BadRequest("per_count must be above 0")
    if not NUMBER_RE.match(amount):
        raise BadRequest("amount must be 0 or more")


def check_calculation(calc, columns):
    kind = calc.get("kind")
    if kind in ("cents", "money"):
        if calc.get("field") not in columns:
            raise BadRequest(f"unknown field: {calc.get('field')}")
        return
    if kind not in CALC_KINDS:
        return
    if kind == "event_based":
        if not SIGNED_NUMBER_RE.match(str(calc.get("amount", ""))) or float(calc["amount"]) < 0:
            raise BadRequest("event_based needs a dollar amount of 0 or more")
        return
    if calc.get("field") not in columns:
        raise BadRequest(f"unknown field: {calc.get('field')}")
    percent = str(calc.get("percent", ""))
    if not NUMBER_RE.match(percent) or not 0 < float(percent) <= 1000:
        raise BadRequest("percent must be a number above 0")


def condition_sql(raw, allowed):
    try:
        items = json.loads(raw or "[]")
    except ValueError:
        return None
    if not isinstance(items, list):
        return None
    parts = []
    for item in items:
        if not isinstance(item, dict):
            return None
        field = item.get("field")
        op = item.get("op")
        if field not in allowed:
            return None
        if op in ("greater_than", "gte_cents"):
            value = str(item.get("value", ""))
            if not NUMBER_RE.match(value):
                return None
            compare = ">" if op == "greater_than" else ">="
            number = (
                f"ROUND(COALESCE(try_cast({field} AS double), 0), 2)"
                if op == "gte_cents"
                else f"COALESCE(try_cast({field} AS double), 0)"
            )
            parts.append(f"{number} {compare} {value}")
        elif op in ("in", "equals"):
            values = item.get("value")
            values = values if isinstance(values, list) else [values]
            if not values or not all(isinstance(value, str) and TOKEN_RE.match(value) for value in values):
                return None
            listed = ", ".join("'" + value.lower().replace("'", "''") + "'" for value in values)
            parts.append(f"lower(COALESCE(CAST({field} AS varchar), '')) IN ({listed})")
        else:
            return None
    return " AND ".join(parts) if parts else "1 = 1"


def month_bounds(month):
    if not isinstance(month, str) or not MONTH_RE.match(month):
        raise BadRequest("month must be YYYY-MM")
    year, mon = int(month[:4]), int(month[5:7])
    start = f"{year:04d}-{mon:02d}-01 00:00:00"
    if mon == 12:
        end = f"{year + 1:04d}-01-01 00:00:00"
    else:
        end = f"{year:04d}-{mon + 1:02d}-01 00:00:00"
    return start, end


def preview(body):
    if not isinstance(body, dict):
        raise BadRequest("body must be a JSON object")
    source_id = body.get("source_id")
    if source_id not in ("tune", "homelight"):
        raise BadRequest("source_id must be tune or homelight")
    rule_filter = body.get("rule_id")
    if rule_filter is not None and (not isinstance(rule_filter, str) or not RULE_ID_RE.match(rule_filter)):
        raise BadRequest("rule_id is invalid")
    start, end = month_bounds(body.get("month"))
    rule_clause = f" AND rule_id = {sql_string(rule_filter)}" if rule_filter else ""
    rules_id = start_and_wait(
        f"""
        SELECT rule_id, CAST(rule_version AS varchar), type, conditions, calculation
        FROM {RULES_TABLE}
        WHERE status = 'ACTIVE' AND source_id = {sql_string(source_id)}
          AND (effective_to IS NULL OR effective_to > current_timestamp)
          {rule_clause}
        """
    )
    rows = []
    summaries = []
    for rule_id, version, rule_type, conditions, calculation in read_rows(rules_id):
        try:
            calc = json.loads(calculation or "{}")
        except ValueError:
            continue
        where_sql = condition_sql(conditions, TUNE_FIELDS if source_id == "tune" else HOMELIGHT_FIELDS)
        if where_sql is None:
            continue
        kind = calc.get("kind")
        if source_id == "homelight" and kind == "money" and rule_type == "REVENUE":
            sql = f"""
            SELECT CAST(s.id AS varchar), {sql_string(rule_id)},
                   CAST(e.amount AS varchar),
                   CAST(CAST(ROUND(s.expected_revenue, 2) AS decimal(18,2)) AS varchar)
            FROM (
                SELECT id, expected_revenue,
                       row_number() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn
                FROM sampledb.revenue_leads_plus
                WHERE updated_at >= TIMESTAMP '{start}' AND updated_at < TIMESTAMP '{end}'
                  AND {where_sql}
            ) s
            LEFT JOIN unified.revenue_events e
              ON e.event_id = lower(to_hex(sha256(to_utf8(concat('homelight|', CAST(s.id AS varchar), '|{rule_id}')))))
            WHERE s.rn = 1
            """
        elif source_id == "tune" and kind == "cents" and calc.get("field") in ("payout_cents", "revenue_cents"):
            field = calc["field"]
            event_table = "unified.cost_events" if rule_type == "COST" else "unified.revenue_events"
            sql = f"""
            SELECT s.transaction_id, {sql_string(rule_id)},
                   CAST(e.amount AS varchar),
                   CAST(CAST(round(COALESCE(try_cast(s.{field} AS double), 0) / 100.0, 2) AS decimal(18,2)) AS varchar)
            FROM (
                SELECT transaction_id, {field},
                       row_number() OVER (PARTITION BY transaction_id ORDER BY datetime DESC) AS rn
                FROM raw.raw_tune_clicks
                WHERE CAST(datetime AS timestamp) >= TIMESTAMP '{start}'
                  AND CAST(datetime AS timestamp) < TIMESTAMP '{end}'
                  AND {where_sql}
                  AND transaction_id IS NOT NULL
            ) s
            LEFT JOIN {event_table} e
              ON e.event_id = lower(to_hex(sha256(to_utf8(concat('tune|', s.transaction_id, '|{rule_id}')))))
            WHERE s.rn = 1
            """
        else:
            continue
        summary_id = start_and_wait(
            f"""
            SELECT count(*),
                   sum(CASE WHEN stored_amount IS NULL THEN 1 ELSE 0 END),
                   sum(CASE WHEN stored_amount IS NOT NULL AND calculated_amount = stored_amount THEN 1 ELSE 0 END),
                   sum(CASE WHEN stored_amount IS NOT NULL AND calculated_amount > stored_amount THEN 1 ELSE 0 END),
                   sum(CASE WHEN stored_amount IS NOT NULL AND calculated_amount < stored_amount THEN 1 ELSE 0 END),
                   CAST(sum(stored_amount) AS varchar),
                   CAST(sum(CASE WHEN stored_amount IS NOT NULL THEN calculated_amount ELSE 0 END) AS varchar),
                   CAST(sum(CASE WHEN stored_amount IS NULL THEN calculated_amount ELSE 0 END) AS varchar)
            FROM (
                SELECT CAST(stored_amount AS decimal(18,2)) AS stored_amount,
                       CAST(calculated_amount AS decimal(18,2)) AS calculated_amount
                FROM ({sql}) q(source_record_id, rule_id, stored_amount, calculated_amount)
            )
            """
        )
        summary_row = list(read_rows(summary_id))
        counts = summary_row[0] if summary_row else ["0", "0", "0", "0", "0", None, None, None]
        stored_total = float(counts[5]) if counts[5] not in (None, "") else 0.0
        calculated_on_stored = float(counts[6]) if counts[6] not in (None, "") else 0.0
        new_amount = float(counts[7]) if counts[7] not in (None, "") else 0.0
        summaries.append({
            "rule_id": rule_id,
            "rule_version": version,
            "type": rule_type,
            "matched": int(counts[0] or 0),
            "not_stored": int(counts[1] or 0),
            "unchanged": int(counts[2] or 0),
            "increased": int(counts[3] or 0),
            "decreased": int(counts[4] or 0),
            "stored_total": round(stored_total, 2),
            "calculated_on_stored": round(calculated_on_stored, 2),
            "net_change": round(calculated_on_stored - stored_total, 2),
            "new_amount": round(new_amount, 2),
        })
        for source_record_id, rid, stored, calculated in read_rows(start_and_wait(sql + " LIMIT 200")):
            stored_n = float(stored) if stored not in (None, "") else None
            calc_n = float(calculated) if calculated not in (None, "") else None
            delta = None if stored_n is None or calc_n is None else round(calc_n - stored_n, 2)
            rows.append({
                "source_record_id": source_record_id,
                "rule_id": rid,
                "rule_version": version,
                "stored_amount": stored,
                "calculated_amount": calculated,
                "delta": delta,
            })
    return response(200, {
        "month": body.get("month"),
        "source_id": source_id,
        "rule_id": rule_filter,
        "summary": summaries[0] if len(summaries) == 1 else summaries,
        "rows": rows,
        "shown": len(rows),
    })


def period_dates(body):
    start = body.get("start")
    end = body.get("end")
    if not isinstance(start, str) or not DAY_RE.match(start):
        raise BadRequest("start must be YYYY-MM-DD")
    if not isinstance(end, str) or not DAY_RE.match(end):
        raise BadRequest("end must be YYYY-MM-DD")
    start_d = datetime.strptime(start, "%Y-%m-%d").date()
    end_d = datetime.strptime(end, "%Y-%m-%d").date()
    today = datetime.now(timezone.utc).date()
    if end_d <= start_d:
        raise BadRequest("end must be after start")
    if start_d >= today or end_d > today:
        raise BadRequest("period must be entirely in the past")
    inclusive_end = end_d - timedelta(days=1)
    if inclusive_end > today - timedelta(days=5):
        raise BadRequest("wait 5 days before checking a date")
    return start, end


def check_sql(source_id, start, end):
    if source_id == "homelight":
        return f"""
        WITH src AS (
          SELECT CAST(l.id AS varchar) AS lead_id,
                 CAST(TRY_CAST(l.expected_revenue AS decimal(18,2)) AS decimal(18,2)) AS revenue,
                 min(lower(trim(b.alyson_session_id))) AS session_id,
                 max(CASE WHEN {hl_affiliate_sql("l")} THEN 'yes' ELSE 'no' END) AS affiliate
          FROM sampledb.revenue_leads_plus l
          JOIN unified.lead_id_bridge b
            ON trim(b.buyer_lead_id) = CAST(l.id AS varchar)
           AND nullif(trim(b.alyson_session_id), '') IS NOT NULL
          JOIN unified.session_click_ids c
            ON c.session_id = trim(b.alyson_session_id)
          WHERE TRY_CAST(l.date_pst AS date) >= DATE '{start}'
            AND TRY_CAST(l.date_pst AS date) < DATE '{end}'
            AND TRY_CAST(l.expected_revenue AS decimal(18,2)) > 0
          GROUP BY 1, 2
        ),
        loaded AS (
          SELECT lead_id AS lead_id,
                 revenue, session_id
          FROM unified.revenue_events
          WHERE source_id = 'homelight'
        )
        SELECT 'totals' AS kind,
               CAST(count(DISTINCT s.lead_id) AS varchar),
               CAST(sum(s.revenue) AS varchar),
               CAST(count(l.lead_id) AS varchar),
               CAST(sum(l.revenue) AS varchar),
               CAST(NULL AS varchar)
        FROM src s
        LEFT JOIN loaded l ON l.lead_id = s.lead_id
        UNION ALL
        SELECT * FROM (
          SELECT 'missing' AS kind, s.lead_id, CAST(s.revenue AS varchar),
                 s.session_id, s.affiliate, CAST(NULL AS varchar)
          FROM src s
          LEFT JOIN loaded l ON l.lead_id = s.lead_id
          WHERE l.lead_id IS NULL
          LIMIT 200
        )
        UNION ALL
        SELECT * FROM (
          SELECT 'different' AS kind, s.lead_id, CAST(s.revenue AS varchar),
                 CAST(l.revenue AS varchar), l.session_id, CAST(NULL AS varchar)
          FROM src s
          JOIN loaded l ON l.lead_id = s.lead_id
          WHERE l.revenue IS NULL OR abs(s.revenue - l.revenue) >= 0.01
          LIMIT 200
        )
        UNION ALL
        SELECT 'coverage',
               CAST(count(*) AS varchar),
               CAST(count(nullif(trim(l.session_id), '')) AS varchar),
               CAST(count(nullif(trim(l.session_id), '')) AS varchar),
               CAST(NULL AS varchar),
               CAST(NULL AS varchar)
        FROM src s
        JOIN loaded l ON l.lead_id = s.lead_id
        UNION ALL
        SELECT 'dup_count',
               CAST(count(*) AS varchar),
               CAST(NULL AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar)
        FROM (
          SELECT l.lead_id
          FROM src s
          JOIN loaded l ON l.lead_id = s.lead_id
          GROUP BY l.lead_id
          HAVING count(*) > 1
        ) d
        """
    elif source_id == "phonexa":
        src = f"""
        SELECT CAST(lead_id AS varchar) AS lead_id,
               max_by(
                 TRY_CAST(replace(replace(buyer_bid, '$', ''), ',', '') AS decimal(18,2)),
                 TRY(CAST(date_pst AS timestamp))
               ) AS revenue,
               'phonexa' AS click_id
        FROM raw.phonexa_ref_raw
        WHERE post_outcome = 'Accept'
          AND TRY(CAST(date_pst AS date)) >= DATE '{start}'
          AND TRY(CAST(date_pst AS date)) < DATE '{end}'
        GROUP BY 1
        HAVING max_by(
                 TRY_CAST(replace(replace(buyer_bid, '$', ''), ',', '') AS decimal(18,2)),
                 TRY(CAST(date_pst AS timestamp))
               ) > 0
        """
        loaded_source = "phonexa"
    else:
        return f"""
        WITH src AS (
          SELECT trim(u.utm_content) AS lead_id,
                 max_by(CAST(TRY_CAST(u.expected_revenue_vendor AS decimal(18,2)) AS decimal(18,2)), TRY_CAST(u.created_at AS timestamp)) AS revenue,
                 min(trim(b.alyson_session_id)) AS session_id
          FROM unified.uct_revenue u
          JOIN unified.lead_id_bridge b
            ON trim(b.client_lead_id) = trim(u.utm_content)
           AND nullif(trim(b.alyson_session_id), '') IS NOT NULL
          JOIN unified.session_click_ids c
            ON c.session_id = trim(b.alyson_session_id)
          WHERE nullif(trim(u.utm_content), '') IS NOT NULL
            AND TRY_CAST(u.created_at AS timestamp) >= TIMESTAMP '{start} 00:00:00'
            AND TRY_CAST(u.created_at AS timestamp) < TIMESTAMP '{end} 00:00:00'
            AND TRY_CAST(u.expected_revenue_vendor AS decimal(18,2)) > 0
          GROUP BY 1
        ),
        loaded AS (
          SELECT lead_id AS lead_id,
                 revenue, session_id
          FROM unified.revenue_events
          WHERE source_id = 'uct'
        )
        SELECT 'totals' AS kind,
               CAST(count(DISTINCT s.lead_id) AS varchar),
               CAST(sum(s.revenue) AS varchar),
               CAST(count(l.lead_id) AS varchar),
               CAST(sum(l.revenue) AS varchar),
               CAST(NULL AS varchar)
        FROM src s
        LEFT JOIN loaded l ON l.lead_id = s.lead_id
        UNION ALL
        SELECT * FROM (
          SELECT 'missing' AS kind, s.lead_id, CAST(s.revenue AS varchar),
                 s.session_id, CAST(NULL AS varchar), CAST(NULL AS varchar)
          FROM src s
          LEFT JOIN loaded l ON l.lead_id = s.lead_id
          WHERE l.lead_id IS NULL
          LIMIT 200
        )
        UNION ALL
        SELECT * FROM (
          SELECT 'different' AS kind, s.lead_id, CAST(s.revenue AS varchar),
                 CAST(l.revenue AS varchar), l.session_id, CAST(NULL AS varchar)
          FROM src s
          JOIN loaded l ON l.lead_id = s.lead_id
          WHERE l.revenue IS NULL OR abs(s.revenue - l.revenue) >= 0.01
          LIMIT 200
        )
        UNION ALL
        SELECT 'coverage',
               CAST(count(*) AS varchar),
               CAST(count(nullif(trim(l.session_id), '')) AS varchar),
               CAST(count(nullif(trim(l.session_id), '')) AS varchar),
               CAST(NULL AS varchar),
               CAST(NULL AS varchar)
        FROM src s
        JOIN loaded l ON l.lead_id = s.lead_id
        UNION ALL
        SELECT 'dup_count',
               CAST(count(*) AS varchar),
               CAST(NULL AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar)
        FROM (
          SELECT l.lead_id
          FROM src s
          JOIN loaded l ON l.lead_id = s.lead_id
          GROUP BY l.lead_id
          HAVING count(*) > 1
        ) d
        """
    return f"""
    WITH src AS ({src}),
    loaded AS (
      SELECT lead_id AS lead_id, revenue
      FROM unified.revenue_events
      WHERE source_id = '{loaded_source}'
        AND TRY_CAST(date AS date) >= DATE '{start}'
        AND TRY_CAST(date AS date) < DATE '{end}'
    ),
    comparable AS (
      SELECT lead_id, revenue
      FROM src
    )
    SELECT 'totals' AS kind,
           CAST(count(DISTINCT c.lead_id) AS varchar),
           CAST(sum(c.revenue) AS varchar),
           CAST((SELECT count(*) FROM loaded) AS varchar),
           CAST((SELECT sum(revenue) FROM loaded) AS varchar),
           CAST(NULL AS varchar)
    FROM comparable c
    UNION ALL
    SELECT * FROM (
      SELECT 'missing' AS kind,
             c.lead_id,
             CAST(c.revenue AS varchar),
             CAST(NULL AS varchar),
             CAST(NULL AS varchar),
             CAST(NULL AS varchar)
      FROM comparable c
      LEFT JOIN loaded l ON l.lead_id = c.lead_id
      WHERE l.lead_id IS NULL
      LIMIT 200
    )
    """


def integrity_sql(source_id, start, end):
    if source_id == "homelight":
        return f"""
        WITH leads AS (
          SELECT CAST(id AS varchar) AS lead_id
          FROM sampledb.revenue_leads_plus
          WHERE TRY_CAST(date_pst AS date) >= DATE '{start}'
            AND TRY_CAST(date_pst AS date) < DATE '{end}'
            AND TRY_CAST(expected_revenue AS decimal(18,2)) > 0
        ),
        bridged AS (
          SELECT l.lead_id, min(trim(b.alyson_session_id)) AS session_id
          FROM leads l
          JOIN unified.lead_id_bridge b
            ON trim(b.buyer_lead_id) = l.lead_id
           AND nullif(trim(b.alyson_session_id), '') IS NOT NULL
          GROUP BY 1
        ),
        in_click AS (
          SELECT b.lead_id, b.session_id
          FROM bridged b
          JOIN unified.session_click_ids c ON c.session_id = b.session_id
        ),
        loaded AS (
          SELECT lead_id AS lead_id,
                 nullif(trim(session_id), '') AS session_id
          FROM unified.revenue_events
          WHERE source_id = 'homelight'
        ),
        matched AS (
          SELECT l.lead_id, l.session_id
          FROM loaded l
          JOIN in_click i ON i.lead_id = l.lead_id
        ),
        dups AS (
          SELECT lead_id, count(*) AS rows
          FROM matched
          GROUP BY 1
          HAVING count(*) > 1
        )
        SELECT 'join' AS kind,
               CAST((SELECT count(*) FROM leads) AS varchar),
               CAST((SELECT count(*) FROM bridged) AS varchar),
               CAST((SELECT count(*) FROM in_click) AS varchar),
               CAST((SELECT count(DISTINCT lead_id) FROM matched) AS varchar)
        UNION ALL
        SELECT 'coverage',
               CAST(count(*) AS varchar),
               CAST(count(m.session_id) AS varchar),
               CAST(count(c.session_id) AS varchar),
               CAST(NULL AS varchar)
        FROM matched m
        LEFT JOIN unified.session_click_ids c ON c.session_id = m.session_id
        UNION ALL
        SELECT 'missing_count',
               CAST(count(*) AS varchar),
               CAST(NULL AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar)
        FROM in_click i
        LEFT JOIN loaded l ON l.lead_id = i.lead_id
        WHERE l.lead_id IS NULL
        UNION ALL
        SELECT 'dup_count', CAST(count(*) AS varchar),
               CAST(NULL AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar)
        FROM dups
        UNION ALL
        SELECT * FROM (
          SELECT 'duplicate' AS kind, lead_id, CAST(rows AS varchar),
                 CAST(NULL AS varchar), CAST(NULL AS varchar)
          FROM dups
          ORDER BY rows DESC
          LIMIT 50
        )
        """
    if source_id == "phonexa":
        return f"""
        WITH src AS (
          SELECT CAST(lead_id AS varchar) AS lead_id,
                 max_by(nullif(trim(click_id), ''), TRY(CAST(date_pst AS timestamp))) AS click_id,
                 max_by(
                   TRY_CAST(replace(replace(buyer_bid, '$', ''), ',', '') AS decimal(18,2)),
                   TRY(CAST(date_pst AS timestamp))
                 ) AS revenue
          FROM raw.phonexa_ref_raw
          WHERE post_outcome = 'Accept'
            AND TRY(CAST(date_pst AS date)) >= DATE '{start}'
            AND TRY(CAST(date_pst AS date)) < DATE '{end}'
          GROUP BY 1
          HAVING max_by(
                   TRY_CAST(replace(replace(buyer_bid, '$', ''), ',', '') AS decimal(18,2)),
                   TRY(CAST(date_pst AS timestamp))
                 ) > 0
        ),
        in_click AS (
          SELECT s.lead_id
          FROM src s
          JOIN unified.session_click_ids c ON c.session_id = s.click_id
        ),
        loaded AS (
          SELECT lead_id AS lead_id,
                 nullif(trim(session_id), '') AS session_id
          FROM unified.revenue_events
          WHERE source_id = 'phonexa'
            AND TRY_CAST(date AS date) >= DATE '{start}'
            AND TRY_CAST(date AS date) < DATE '{end}'
        ),
        matched AS (
          SELECT l.lead_id, l.session_id
          FROM loaded l
          JOIN src s ON s.lead_id = l.lead_id
        ),
        dups AS (
          SELECT lead_id, count(*) AS rows
          FROM matched
          GROUP BY 1
          HAVING count(*) > 1
        )
        SELECT 'join' AS kind,
               CAST((SELECT count(*) FROM src) AS varchar),
               CAST((SELECT count(*) FROM src) AS varchar),
               CAST((SELECT count(*) FROM in_click) AS varchar),
               CAST((SELECT count(DISTINCT lead_id) FROM matched) AS varchar)
        UNION ALL
        SELECT 'coverage',
               CAST(count(*) AS varchar),
               CAST(count(m.session_id) AS varchar),
               CAST(count(c.session_id) AS varchar),
               CAST(NULL AS varchar)
        FROM matched m
        LEFT JOIN unified.session_click_ids c ON c.session_id = m.session_id
        UNION ALL
        SELECT 'missing_count',
               CAST(count(*) AS varchar),
               CAST(NULL AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar)
        FROM src s
        LEFT JOIN loaded l ON l.lead_id = s.lead_id
        WHERE l.lead_id IS NULL
        UNION ALL
        SELECT 'dup_count', CAST(count(*) AS varchar),
               CAST(NULL AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar)
        FROM dups
        UNION ALL
        SELECT * FROM (
          SELECT 'duplicate' AS kind, lead_id, CAST(rows AS varchar),
                 CAST(NULL AS varchar), CAST(NULL AS varchar)
          FROM dups
          ORDER BY rows DESC
          LIMIT 50
        )
        """
    return f"""
    WITH src AS (
      SELECT CAST(unified_lead_id AS varchar) AS lead_id
      FROM unified.uct_revenue
      WHERE connector_id = '37'
        AND unified_lead_id IS NOT NULL AND trim(CAST(unified_lead_id AS varchar)) <> ''
        AND TRY_CAST(created_at AS timestamp) >= TIMESTAMP '{start} 00:00:00'
        AND TRY_CAST(created_at AS timestamp) < TIMESTAMP '{end} 00:00:00'
        AND TRY_CAST(expected_revenue_vendor AS decimal(18,2)) > 0
        AND utm_content IS NOT NULL AND trim(utm_content) <> ''
      GROUP BY 1
    ),
    loaded AS (
      SELECT lead_id AS lead_id,
             nullif(trim(session_id), '') AS session_id
      FROM unified.revenue_events
      WHERE source_id = 'uct'
        AND TRY_CAST(date AS date) >= DATE '{start}'
        AND TRY_CAST(date AS date) < DATE '{end}'
    ),
    matched AS (
      SELECT l.lead_id, l.session_id
      FROM loaded l
      JOIN src s ON s.lead_id = l.lead_id
    ),
    dups AS (
      SELECT lead_id, count(*) AS rows
      FROM matched
      GROUP BY 1
      HAVING count(*) > 1
    )
    SELECT 'join' AS kind,
           CAST((SELECT count(*) FROM src) AS varchar),
           CAST((SELECT count(*) FROM src) AS varchar),
           CAST(NULL AS varchar),
           CAST((SELECT count(DISTINCT lead_id) FROM matched) AS varchar)
    UNION ALL
    SELECT 'coverage',
           CAST(count(*) AS varchar),
           CAST(count(m.session_id) AS varchar),
           CAST(count(c.session_id) AS varchar),
           CAST(NULL AS varchar)
    FROM matched m
    LEFT JOIN unified.session_click_ids c ON c.session_id = m.session_id
    UNION ALL
    SELECT 'missing_count',
           CAST(count(*) AS varchar),
           CAST(NULL AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar)
    FROM src s
    LEFT JOIN loaded l ON l.lead_id = s.lead_id
    WHERE l.lead_id IS NULL
    UNION ALL
    SELECT 'dup_count', CAST(count(*) AS varchar),
           CAST(NULL AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar)
    FROM dups
    UNION ALL
    SELECT * FROM (
      SELECT 'duplicate' AS kind, lead_id, CAST(rows AS varchar),
             CAST(NULL AS varchar), CAST(NULL AS varchar)
      FROM dups
      ORDER BY rows DESC
      LIMIT 50
    )
    """


def integrity_block(source_id, start, end, missing):
    source_rows = lead_bridge_rows = click_bridge_rows = matched_rows = 0
    loaded_rows = with_session = in_click = 0
    missing_count = 0
    duplicate_count = 0
    duplicates = []
    for kind, a, b, c, d in read_rows(start_and_wait(integrity_sql(source_id, start, end))):
        if kind == "join":
            source_rows = int(a or 0)
            lead_bridge_rows = int(b or 0)
            click_bridge_rows = int(c or 0) if c not in (None, "") else None
            matched_rows = int(d or 0)
        elif kind == "coverage":
            loaded_rows = int(a or 0)
            with_session = int(b or 0)
            in_click = int(c or 0)
        elif kind == "missing_count":
            missing_count = int(a or 0)
        elif kind == "dup_count":
            duplicate_count = int(a or 0)
        elif kind == "duplicate":
            duplicates.append({"lead_id": a, "rows": int(b or 0)})
    if source_id == "homelight":
        date_column, date_basis = "date_pst", "America/Los_Angeles"
        path = [
            "sampledb.revenue_leads_plus",
            "unified.lead_id_bridge",
            "unified.session_click_ids",
            "unified.revenue_events",
        ]
    elif source_id == "phonexa":
        date_column, date_basis = "date_pst", "America/Los_Angeles"
        path = [
            "raw.phonexa_ref_raw",
            "unified.session_click_ids",
            "unified.revenue_events",
        ]
    else:
        date_column, date_basis = "created_at", "UTC"
        path = ["unified.uct_revenue", "unified.lead_id_bridge", "unified.session_click_ids", "unified.revenue_events"]
    return {
        "missing_source_leads": {"count": missing_count, "leads": missing},
        "session_id_coverage": {
            "loaded_rows": loaded_rows,
            "with_session_id": with_session,
            "in_click_bridge": in_click,
        },
        "duplicates": {"count": duplicate_count, "leads": duplicates},
        "timestamp": {
            "request_timezone": "UTC",
            "source_date_column": date_column,
            "source_date_basis": date_basis,
            "start": start,
            "end": end,
        },
        "join_validation": {
            "path": path,
            "source_rows": source_rows,
            "after_lead_bridge": lead_bridge_rows,
            "after_click_bridge": click_bridge_rows,
            "matched_loaded": matched_rows,
        },
    }


def log_id(source_id, start, end):
    return f"{source_id}:{start}:{end}"


def num_or_none(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_missing_leads(raw):
    if not raw:
        return []
    try:
        rows = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(rows, list):
        return []
    missing = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        lead_id = item.get("lead_id")
        if lead_id is None:
            continue
        missing.append({
            "lead_id": str(lead_id),
            "revenue": float(item.get("revenue") or 0),
            "session_id": item.get("session_id"),
            "affiliate": bool(item.get("affiliate")),
        })
    return missing


def missing_leads_json(missing):
    return json.dumps([
        {
            "lead_id": item.get("lead_id"),
            "revenue": item.get("revenue"),
            "session_id": item.get("session_id"),
            "affiliate": bool(item.get("affiliate")),
        }
        for item in (missing or [])[:200]
    ], separators=(",", ":"))


def list_reconciliation_log():
    qid = start_and_wait(
        f"""
        SELECT id, source_id, period_kind,
               CAST(date_reconciled AS varchar), CAST(period_start AS varchar), CAST(period_end AS varchar),
               CAST(checked_at AS varchar), result,
               CAST(source_leads AS varchar), CAST(loaded_leads AS varchar),
               CAST(source_revenue AS varchar), CAST(loaded_revenue AS varchar),
               CAST(difference AS varchar), how, CAST(locked AS varchar),
               CAST(missing_leads AS varchar), missing_lead_ids
        FROM {LOG_TABLE}
        WHERE workspace_id = {sql_string(workspace_id())}
        ORDER BY checked_at DESC
        """
    )
    rows = []
    for rec in read_rows(qid):
        (rid, source_id, kind, day, pstart, pend, checked, result,
         s_leads, l_leads, s_rev, l_rev, diff, how, locked, missing_count, missing_raw) = rec
        missing = parse_missing_leads(missing_raw)
        rows.append({
            "id": rid,
            "source": source_id,
            "period_kind": kind or "day",
            "date_reconciled": (day or "")[:10],
            "period_start": (pstart or "")[:10],
            "period_end": (pend or "")[:10],
            "checked_at": checked or "",
            "result": result or "failed",
            "source_leads": None if s_leads in (None, "") else int(float(s_leads)),
            "loaded_leads": None if l_leads in (None, "") else int(float(l_leads)),
            "source_revenue": num_or_none(s_rev),
            "loaded_revenue": num_or_none(l_rev),
            "difference": num_or_none(diff),
            "how": how or "reconcile/check",
            "locked": str(locked).lower() == "true",
            "cost_usd": None,
            "missing_leads": None if missing_count in (None, "") else int(float(missing_count)),
            "missing": missing,
        })
    return response(200, {"rows": rows})


def matched_log_row(source_id, start, end):
    qid = start_and_wait(
        f"""
        SELECT CAST(source_leads AS varchar), CAST(loaded_leads AS varchar),
               CAST(source_revenue AS varchar), CAST(loaded_revenue AS varchar),
               CAST(difference AS varchar)
        FROM {LOG_TABLE}
        WHERE source_id = {sql_string(source_id)}
          AND result = 'matched'
          AND locked = true
          AND workspace_id = {sql_string(workspace_id())}
          AND DATE {sql_string(start)} >= period_start
          AND DATE {sql_string(end)} <= period_end
        ORDER BY period_end DESC, checked_at DESC
        LIMIT 1
        """
    )
    found = list(read_rows(qid))
    if not found:
        return None
    s_leads, l_leads, s_rev, l_rev, diff = found[0]
    return {
        "source_leads": int(float(s_leads or 0)),
        "loaded_leads": int(float(l_leads or 0)),
        "source_revenue": float(s_rev or 0),
        "loaded_revenue": float(l_rev or 0),
        "difference": float(diff or 0),
    }


def save_reconciliation_log(row):
    start_and_wait(
        f"""
        MERGE INTO {LOG_TABLE} t
        USING (
          SELECT
            {sql_string(row['id'])} AS id,
            {sql_string(row['source_id'])} AS source_id,
            {sql_string(row['period_kind'])} AS period_kind,
            DATE {sql_string(row['date_reconciled'])} AS date_reconciled,
            DATE {sql_string(row['period_start'])} AS period_start,
            DATE {sql_string(row['period_end'])} AS period_end,
            CAST(current_timestamp AS timestamp) AS checked_at,
            {sql_string(row['result'])} AS result,
            {row['source_leads'] if row['source_leads'] is not None else 'CAST(NULL AS integer)'} AS source_leads,
            {row['loaded_leads'] if row['loaded_leads'] is not None else 'CAST(NULL AS integer)'} AS loaded_leads,
            {row['source_revenue'] if row['source_revenue'] is not None else 'CAST(NULL AS decimal(18,2))'} AS source_revenue,
            {row['loaded_revenue'] if row['loaded_revenue'] is not None else 'CAST(NULL AS decimal(18,2))'} AS loaded_revenue,
            {row['difference'] if row['difference'] is not None else 'CAST(NULL AS decimal(18,2))'} AS difference,
            {sql_string(row['how'])} AS how,
            {str(bool(row['locked'])).lower()} AS locked,
            {sql_string(workspace_id())} AS workspace_id,
            {row['missing_leads'] if row.get('missing_leads') is not None else 'CAST(NULL AS integer)'} AS missing_leads,
            {sql_string(row.get('missing_lead_ids') or '[]')} AS missing_lead_ids
        ) s
        ON t.id = s.id
        WHEN MATCHED THEN UPDATE SET
          period_kind = s.period_kind,
          checked_at = s.checked_at,
          result = s.result,
          source_leads = s.source_leads,
          loaded_leads = s.loaded_leads,
          source_revenue = s.source_revenue,
          loaded_revenue = s.loaded_revenue,
          difference = s.difference,
          how = s.how,
          locked = s.locked,
          missing_leads = s.missing_leads,
          missing_lead_ids = s.missing_lead_ids
        WHEN NOT MATCHED THEN INSERT (
          id, source_id, period_kind, date_reconciled, period_start, period_end,
          checked_at, result, source_leads, loaded_leads, source_revenue, loaded_revenue,
          difference, how, locked, workspace_id, missing_leads, missing_lead_ids
        ) VALUES (
          s.id, s.source_id, s.period_kind, s.date_reconciled, s.period_start, s.period_end,
          s.checked_at, s.result, s.source_leads, s.loaded_leads, s.source_revenue, s.loaded_revenue,
          s.difference, s.how, s.locked, s.workspace_id, s.missing_leads, s.missing_lead_ids
        )
        """
    )


def reconcile_check(body):
    if not isinstance(body, dict):
        raise BadRequest("body must be a JSON object")
    source_id = body.get("source_id")
    if source_id not in ("homelight", "uct", "phonexa"):
        raise BadRequest("source_id must be homelight, uct, or phonexa")
    kind = body.get("period_kind") or "day"
    if kind not in ("day", "week", "month"):
        raise BadRequest("period_kind must be day, week, or month")
    start, end = period_dates(body)
    prior = matched_log_row(source_id, start, end)
    if prior:
        return response(200, {
            "source_id": source_id,
            "start": start,
            "end": end,
            "from_log": True,
            "matched": True,
            "missing": [],
            "different": [],
            **prior,
        })
    payload = run_reconcile_check(source_id, start, end)
    try:
        save_reconciliation_log({
            "id": log_id(source_id, start, end),
            "source_id": source_id,
            "period_kind": kind,
            "date_reconciled": start,
            "period_start": start,
            "period_end": end,
            "result": "matched" if payload["matched"] else "difference",
            "source_leads": payload["source_leads"],
            "loaded_leads": payload["loaded_leads"],
            "source_revenue": payload["source_revenue"],
            "loaded_revenue": payload["loaded_revenue"],
            "difference": payload["difference"],
            "how": "reconcile/check",
            "locked": payload["matched"],
            "missing_leads": len(payload["missing"]),
            "missing_lead_ids": missing_leads_json(payload["missing"]),
        })
    except Exception:
        logger.exception("could not save reconciliation log")
    return response(200, payload)


LEAD_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
LOAD_SOURCES = {
    "homelight": "sampledb.revenue_leads_plus",
    "uct": "unified.uct_revenue",
    "phonexa": "raw.phonexa_ref_raw",
}


def clean_lead_ids(value):
    if not isinstance(value, list):
        return []
    out = []
    for item in value[:200]:
        text = str(item).strip()
        if LEAD_ID_RE.match(text):
            out.append(text)
    return out


def lead_id_filter(alias, lead_ids):
    if not lead_ids:
        return "1 = 1"
    listed = ", ".join(sql_string(item) for item in lead_ids)
    return f"{alias} IN ({listed})"


def load_missing_sql(source_id, start, end, lead_ids):
    table = LOAD_SOURCES[source_id]
    ids = lead_id_filter("src.lead_id", lead_ids)
    if source_id == "homelight":
        src = f"""
        SELECT CAST(l.id AS varchar) AS lead_id,
               CAST(TRY_CAST(l.expected_revenue AS decimal(18,2)) AS decimal(18,2)) AS revenue,
               min(lower(trim(b.alyson_session_id))) AS session_id,
               min(nullif(trim(b.unified_lead_id), '')) AS unified_lead_id,
               min(nullif(trim(CAST(l.client_id AS varchar)), '')) AS client_id,
               min(TRY_CAST(l.date_pst AS date)) AS d,
               min(CAST(COALESCE(try_cast(l.updated_at AS timestamp), CAST(TRY_CAST(l.date_pst AS date) AS timestamp)) AS timestamp)) AS event_time,
               CAST(NULL AS varchar) AS offer_id,
               CAST('VD001' AS varchar) AS vendor_id
        FROM sampledb.revenue_leads_plus l
        JOIN unified.lead_id_bridge b
          ON trim(b.buyer_lead_id) = CAST(l.id AS varchar)
         AND nullif(trim(b.alyson_session_id), '') IS NOT NULL
        JOIN unified.session_click_ids c
          ON c.session_id = trim(b.alyson_session_id)
        WHERE TRY_CAST(l.date_pst AS date) >= DATE '{start}'
          AND TRY_CAST(l.date_pst AS date) < DATE '{end}'
          AND TRY_CAST(l.expected_revenue AS decimal(18,2)) > 0
          AND {lead_id_filter('CAST(l.id AS varchar)', lead_ids)}
        GROUP BY 1, 2
        """
    elif source_id == "uct":
        src = f"""
        SELECT trim(u.utm_content) AS lead_id,
               max_by(CAST(TRY_CAST(u.expected_revenue_vendor AS decimal(18,2)) AS decimal(18,2)), TRY_CAST(u.created_at AS timestamp)) AS revenue,
               min(trim(b.alyson_session_id)) AS session_id,
               min(nullif(trim(b.unified_lead_id), '')) AS unified_lead_id,
               CAST(NULL AS varchar) AS client_id,
               min(TRY_CAST(u.created_at AS date)) AS d,
               min(TRY_CAST(u.created_at AS timestamp)) AS event_time,
               min(nullif(trim(u.offer_id), '')) AS offer_id,
               min(nullif(trim(u.vendor_id), '')) AS vendor_id
        FROM unified.uct_revenue u
        JOIN unified.lead_id_bridge b
          ON trim(b.client_lead_id) = trim(u.utm_content)
         AND nullif(trim(b.alyson_session_id), '') IS NOT NULL
        JOIN unified.session_click_ids c
          ON c.session_id = trim(b.alyson_session_id)
        WHERE nullif(trim(u.utm_content), '') IS NOT NULL
          AND TRY_CAST(u.created_at AS timestamp) >= TIMESTAMP '{start} 00:00:00'
          AND TRY_CAST(u.created_at AS timestamp) < TIMESTAMP '{end} 00:00:00'
          AND TRY_CAST(u.expected_revenue_vendor AS decimal(18,2)) > 0
          AND {lead_id_filter('trim(u.utm_content)', lead_ids)}
        GROUP BY 1
        """
    else:
        src = f"""
        SELECT CAST(p.lead_id AS varchar) AS lead_id,
               max_by(TRY_CAST(replace(replace(p.buyer_bid, '$', ''), ',', '') AS decimal(18,2)), TRY(CAST(p.date_pst AS timestamp))) AS revenue,
               min(lower(trim(b.alyson_session_id))) AS session_id,
               min(nullif(trim(b.unified_lead_id), '')) AS unified_lead_id,
               CAST(NULL AS varchar) AS client_id,
               min(TRY(CAST(p.date_pst AS date))) AS d,
               min(TRY_CAST(p.datetime_pst AS timestamp)) AS event_time,
               CAST(NULL AS varchar) AS offer_id,
               CAST(NULL AS varchar) AS vendor_id
        FROM raw.phonexa_ref_raw p
        JOIN unified.lead_id_bridge b
          ON nullif(trim(b.alyson_session_id), '') IS NOT NULL
         AND (
           trim(b.routing_platform_lead_id) = CAST(p.lead_id AS varchar)
           OR trim(b.client_lead_id) = CAST(p.lead_id AS varchar)
           OR trim(b.buyer_lead_id) = CAST(p.lead_id AS varchar)
         )
        JOIN unified.session_click_ids c
          ON c.session_id = trim(b.alyson_session_id)
        WHERE p.post_outcome = 'Accept'
          AND TRY(CAST(p.date_pst AS date)) >= DATE '{start}'
          AND TRY(CAST(p.date_pst AS date)) < DATE '{end}'
          AND {lead_id_filter('CAST(p.lead_id AS varchar)', lead_ids)}
        GROUP BY 1
        HAVING max_by(TRY_CAST(replace(replace(p.buyer_bid, '$', ''), ',', '') AS decimal(18,2)), TRY(CAST(p.date_pst AS timestamp))) > 0
        """
    return f"""
    MERGE INTO unified.revenue_events t
    USING (
      SELECT
        lower(to_hex(md5(to_utf8(concat('{table}|', src.session_id, '|', src.lead_id))))) AS event_id,
        src.session_id,
        CAST(round(src.revenue, 2) AS decimal(18,2)) AS revenue,
        src.event_time,
        concat('{{"revenue":"', CAST(CAST(round(src.revenue, 2) AS decimal(18,2)) AS varchar), '"}}') AS inputs,
        src.d,
        src.lead_id,
        src.unified_lead_id,
        src.client_id,
        src.offer_id,
        src.vendor_id
      FROM ({src}) src
      LEFT JOIN unified.revenue_events e
        ON e.source_id = '{source_id}' AND trim(e.lead_id) = src.lead_id
      WHERE e.lead_id IS NULL
        AND src.revenue > 0
        AND nullif(trim(src.session_id), '') IS NOT NULL
        AND {ids}
    ) s
    ON t.source_id = '{source_id}' AND trim(t.lead_id) = s.lead_id
    WHEN NOT MATCHED THEN INSERT (
      event_id, session_id, revenue, currency, rule_id, rule_version, source_id, source_table,
      event_time, status, inputs, processed_at, processing_run_id, session_id_source,
      client_id, workspace_id, date, offer_id, vendor_id, lead_id, unified_lead_id
    ) VALUES (
      s.event_id, s.session_id, s.revenue, 'USD', 'reconciliation_load', 1, '{source_id}', '{table}',
      s.event_time, 'PROCESSED', s.inputs, current_timestamp, 'reconcile-load', 'lead_id_bridge',
      s.client_id, {sql_string(workspace_id())}, s.d, s.offer_id, s.vendor_id, s.lead_id, s.unified_lead_id
    )
    """


def reconcile_load(body):
    if not isinstance(body, dict):
        raise BadRequest("body must be a JSON object")
    source_id = body.get("source_id")
    if source_id not in LOAD_SOURCES:
        raise BadRequest("source_id must be homelight, uct, or phonexa")
    start, end = period_dates(body)
    lead_ids = clean_lead_ids(body.get("lead_ids"))
    start_and_wait(load_missing_sql(source_id, start, end, lead_ids))
    return response(200, {"ok": True, "source_id": source_id, "start": start, "end": end, "lead_ids": lead_ids})


def run_reconcile_check(source_id, start, end):
    source_leads = 0
    source_revenue = 0.0
    loaded_leads = 0
    loaded_revenue = 0.0
    missing = []
    different = []
    steps = None
    coverage = None
    duplicate_count = 0
    for kind, a, b, c, d, _rest in read_rows(start_and_wait(check_sql(source_id, start, end))):
        if kind == "totals":
            source_leads = int(a or 0)
            source_revenue = float(b) if b not in (None, "") else 0.0
            loaded_leads = int(c or 0)
            loaded_revenue = float(d) if d not in (None, "") else 0.0
        elif kind == "missing":
            row = {
                "lead_id": a,
                "revenue": float(b) if b not in (None, "") else 0.0,
                "session_id": c,
            }
            if source_id == "homelight":
                row["affiliate"] = d == "yes"
            missing.append(row)
        elif kind == "different":
            different.append({
                "lead_id": a,
                "source_revenue": float(b) if b not in (None, "") else 0.0,
                "loaded_revenue": float(c) if c not in (None, "") else 0.0,
                "session_id": d,
            })
        elif kind == "steps":
            steps = {
                "source_rows": int(a or 0),
                "after_lead_bridge": int(b or 0),
                "after_click_bridge": int(c or 0),
                "matched_loaded": int(d or 0),
            }
        elif kind == "coverage":
            coverage = {
                "loaded_rows": int(a or 0),
                "with_session_id": int(b or 0),
                "in_click_bridge": int(c or 0),
            }
        elif kind == "dup_count":
            duplicate_count = int(a or 0)
    if steps is None:
        steps = {
            "source_rows": source_leads,
            "after_lead_bridge": source_leads,
            "after_click_bridge": source_leads,
            "matched_loaded": loaded_leads,
        }
    if coverage is None:
        coverage = {
            "loaded_rows": loaded_leads,
            "with_session_id": loaded_leads,
            "in_click_bridge": loaded_leads,
        }
    if source_id == "uct":
        date_column, date_basis = "created_at", "UTC"
        path = ["unified.uct_revenue", "unified.lead_id_bridge", "unified.session_click_ids", "unified.revenue_events"]
    elif source_id == "phonexa":
        date_column, date_basis = "date_pst", "America/Los_Angeles"
        path = ["raw.phonexa_ref_raw", "unified.revenue_events"]
    else:
        date_column, date_basis = "date_pst", "America/Los_Angeles"
        path = [
            "sampledb.revenue_leads_plus",
            "unified.lead_id_bridge",
            "unified.session_click_ids",
            "unified.revenue_events",
        ]
    missing_count = steps["after_click_bridge"] - steps["matched_loaded"]
    difference = round(source_revenue - loaded_revenue, 2)
    return {
        "source_id": source_id,
        "start": start,
        "end": end,
        "source_leads": source_leads,
        "source_revenue": round(source_revenue, 2),
        "loaded_leads": loaded_leads,
        "loaded_revenue": round(loaded_revenue, 2),
        "difference": difference,
        "matched": not missing,
        "missing": missing,
        "different": different,
        "integrity": {
            "missing_source_leads": {"count": missing_count, "leads": missing},
            "session_id_coverage": coverage,
            "duplicates": {"count": duplicate_count, "leads": []},
            "timestamp": {
                "request_timezone": "UTC",
                "source_date_column": date_column,
                "source_date_basis": date_basis,
                "start": start,
                "end": end,
            },
            "join_validation": {"path": path, **steps},
        },
    }


REPORT_SOURCES = (("homelight", "HomeLight"), ("uct", "Non-HL (UCT)"), ("phonexa", "Phonexa"))
REPORT_DAYS = int(os.environ.get("REPORT_DAYS", "30"))
REPORT_BUCKET = os.environ.get("REPORT_BUCKET", "datalake-unified-221490242148-us-west-2")
REPORT_PREFIX = os.environ.get("REPORT_PREFIX", "cost_revenue/reconcile_reports")


def daily_result(params):
    """Latest daily reconciliation, or the run for ?date=YYYY-MM-DD (the run's end date)."""
    day = (params or {}).get("date")
    if day is not None and not DAY_RE.match(day):
        raise BadRequest("date must be YYYY-MM-DD")
    key = f"{REPORT_PREFIX}/runs/{day}.json" if day else f"{REPORT_PREFIX}/latest.json"
    s3 = boto3.client("s3")
    try:
        obj = s3.get_object(Bucket=REPORT_BUCKET, Key=key)
    except s3.exceptions.NoSuchKey:
        return response(404, {"error": "no daily reconciliation for that date"})
    runs = s3.list_objects_v2(Bucket=REPORT_BUCKET, Prefix=f"{REPORT_PREFIX}/runs/").get("Contents") or []
    dates = sorted((o["Key"].rsplit("/", 1)[-1][:-5] for o in runs), reverse=True)[:30]
    return response(200, {**json.loads(obj["Body"].read()), "available_dates": dates})


def money(value):
    return f"${value:,.2f}"


def daily_report():
    """Reconcile each source over the last REPORT_DAYS days and email any difference."""
    from datetime import timedelta

    topic = os.environ.get("REPORT_TOPIC_ARN")
    today = datetime.now(timezone.utc).date()
    start = (today - timedelta(days=REPORT_DAYS)).isoformat()
    end = today.isoformat()
    results = []
    for source_id, label in REPORT_SOURCES:
        try:
            body = json.loads(reconcile_check({"source_id": source_id, "start": start, "end": end})["body"])
            results.append((label, body, None))
        except Exception as exc:
            logger.exception("daily reconcile failed for %s", source_id)
            results.append((label, None, str(exc)[:300]))

    lines = [f"Unified Revenue daily reconciliation, {start} to {end} (end exclusive)", ""]
    has_issue = False
    for label, body, error in results:
        if error:
            has_issue = True
            lines += [f"{label}: CHECK FAILED - {error}", ""]
            continue
        status = "MATCHED" if body["matched"] else "DIFFERENCE"
        has_issue = has_issue or not body["matched"]
        lines += [
            f"{label}: {status}",
            f"  Source:          {body['source_leads']:,} leads, {money(body['source_revenue'])}",
            f"  revenue_events:  {body['loaded_leads']:,} leads, {money(body['loaded_revenue'])}",
            f"  Difference:      {money(body['difference'])}",
            f"  Missing leads:   {len(body['missing'])}    Different amount: {len(body['different'])}",
            "",
        ]
    for label, body, error in results:
        if error or body["matched"]:
            continue
        if body["missing"]:
            lines += [f"{label} - in source, not in revenue_events (first 200)",
                      "  lead_id | source_revenue | revenue_events_revenue | session_id"]
            lines += [f"  {m['lead_id']} | {money(m['revenue'])} | - | {m['session_id'] or '-'}"
                      for m in body["missing"]]
            lines.append("")
        if body["different"]:
            lines += [f"{label} - amount differs (first 200)",
                      "  lead_id | source_revenue | revenue_events_revenue | difference | session_id"]
            lines += [f"  {d['lead_id']} | {money(d['source_revenue'])} | {money(d['loaded_revenue'])} | "
                      f"{money(d['source_revenue'] - d['loaded_revenue'])} | {d['session_id'] or '-'}"
                      for d in body["different"]]
            lines.append("")

    run_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    report = {
        "run_at": run_at,
        "start": start,
        "end": end,
        "difference_found": has_issue,
        "sources": [
            {"source_id": sid, "label": label, "error": error,
             "status": "failed" if error else ("matched" if body["matched"] else "difference"),
             **({} if error else {k: body[k] for k in (
                 "source_leads", "source_revenue", "loaded_leads", "loaded_revenue",
                 "difference", "missing", "different")})}
            for (sid, _), (label, body, error) in zip(REPORT_SOURCES, results)
        ],
    }
    bucket, prefix = REPORT_BUCKET, REPORT_PREFIX
    payload = json.dumps(report).encode("utf-8")
    try:
        s3 = boto3.client("s3")
        s3.put_object(Bucket=bucket, Key=f"{prefix}/latest.json", Body=payload, ContentType="application/json")
        s3.put_object(Bucket=bucket, Key=f"{prefix}/runs/{end}.json", Body=payload, ContentType="application/json")
    except Exception:
        logger.exception("could not save daily reconciliation report")

    sent = False
    if has_issue and topic:
        boto3.client("sns").publish(
            TopicArn=topic,
            Subject=f"Unified Revenue reconciliation: difference found ({start} to {end})"[:100],
            Message="\n".join(lines)[:250000],
        )
        sent = True
    return {"ok": True, "start": start, "end": end, "difference_found": has_issue, "email_sent": sent}


def lambda_handler(event, context):
    global _auth
    _auth = None
    if (event or {}).get("mode") == "daily_report":
        return daily_report()
    route = (event or {}).get("routeKey", "")
    if str(route).startswith("OPTIONS"):
        return {"statusCode": 204, "headers": cors_headers(), "body": ""}
    try:
        _auth = authenticate_request(event, require_workspace=True)
        if route == "GET /rules":
            return list_rules()
        if route == "GET /rules/columns":
            return list_columns((event or {}).get("queryStringParameters"))
        if route == "GET /rules/filter-options":
            return list_filter_options((event or {}).get("queryStringParameters"))
        if route == "GET /reconcile/daily":
            return daily_result((event or {}).get("queryStringParameters"))
        if route == "GET /reconcile/log":
            return list_reconciliation_log()
        body = json.loads((event or {}).get("body") or "{}")
        if route == "POST /rules":
            return save_rule(body)
        if route == "POST /rules/inactive":
            return deactivate(body)
        if route == "POST /reconcile/preview":
            return preview(body)
        if route == "POST /reconcile/check":
            return reconcile_check(body)
        if route == "POST /reconcile/load-missing":
            return reconcile_load(body)
        return response(404, {"error": "not found"})
    except AuthError as exc:
        return auth_response(exc, cors_headers())
    except BadRequest as exc:
        return response(400, {"error": str(exc)})
    except json.JSONDecodeError:
        return response(400, {"error": "body is not valid JSON"})
    except Exception:
        logger.exception("rules api failed at %s", datetime.now(timezone.utc).isoformat())
        return response(500, {"error": "query failed"})
