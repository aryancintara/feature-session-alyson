// Server-only helpers for querying AWS Athena through the Lovable connector
// gateway. Kept out of *.functions.ts because server-fn splitting drops
// sibling declarations from the transformed module.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/aws_athena";

export const SESSION_TABLE = '"unified"."unified_session_summary"';

export interface AthenaCreds {
  lovableKey: string;
  connectionKey: string;
  workgroup?: string | undefined;
  outputLocation?: string | undefined;
}

/** Reads gateway credentials. Returns null when Athena isn't linked yet. */
export function readAthenaCreds(): AthenaCreds | null {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["AWS_ATHENA_API_KEY"];
  if (!lovableKey || !connectionKey) return null;
  return {
    lovableKey,
    connectionKey,
    workgroup: process.env["AWS_ATHENA_WORKGROUP"] || undefined,
    outputLocation: process.env["AWS_ATHENA_OUTPUT_LOCATION"] || undefined,
  };
}

async function athena(
  creds: AthenaCreds,
  operation: string,
  body: Record<string, unknown>,
): Promise<Record<string, any>> {
  const res = await fetch(`${GATEWAY_URL}/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.lovableKey}`,
      "X-Connection-Api-Key": creds.connectionKey,
      "X-Amz-Target": `AmazonAthena.${operation}`,
      "Content-Type": "application/x-amz-json-1.1",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Athena ${operation} failed [${res.status}]: ${text}`);
    throw new Error(`Athena ${operation} failed [${res.status}]: ${text}`);
  }
  return (await res.json()) as Record<string, any>;
}

/**
 * Runs a parameterized query and returns rows as column-keyed string maps —
 * exactly the shape `parseSessionRow()` in sessionData.ts expects.
 */
export async function runAthenaQuery(
  creds: AthenaCreds,
  sql: string,
  params: string[],
  maxRows = 500,
): Promise<Record<string, string>[]> {
  const start = await athena(creds, "StartQueryExecution", {
    QueryString: sql,
    ClientRequestToken: crypto.randomUUID(),
    ...(params.length ? { ExecutionParameters: params } : {}),
    ...(creds.workgroup ? { WorkGroup: creds.workgroup } : {}),
    ...(creds.outputLocation
      ? { ResultConfiguration: { OutputLocation: creds.outputLocation } }
      : {}),
  });
  const id = start["QueryExecutionId"] as string;

  let state = "QUEUED";
  let delay = 800;
  const deadline = Date.now() + 60_000;
  while (state === "QUEUED" || state === "RUNNING") {
    if (Date.now() > deadline) {
      await athena(creds, "StopQueryExecution", { QueryExecutionId: id }).catch(() => {});
      throw new Error(`Athena query ${id} timed out after 60s`);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 4000);
    const poll = await athena(creds, "GetQueryExecution", { QueryExecutionId: id });
    const status = poll["QueryExecution"]?.Status ?? {};
    state = status.State ?? "FAILED";
    if (state === "FAILED" || state === "CANCELLED") {
      throw new Error(`Athena query ${state}: ${status.StateChangeReason ?? "unknown reason"}`);
    }
  }

  // Paginate until we have maxRows. Header row appears only on page 1.
  const out: Record<string, string>[] = [];
  let columns: string[] = [];
  let token: string | undefined;
  let first = true;

  while (out.length < maxRows) {
    const page: Record<string, any> = await athena(creds, "GetQueryResults", {
      QueryExecutionId: id,
      MaxResults: Math.min(1000, maxRows - out.length + (first ? 1 : 0)),
      ...(token ? { NextToken: token } : {}),
    });
    const rs = page["ResultSet"] ?? {};
    let rows: any[] = rs.Rows ?? [];
    if (first) {
      const header = rows[0];
      columns = (header?.Data ?? []).map((d: any) => String(d?.VarCharValue ?? ""));
      rows = rows.slice(1);
      first = false;
    }
    for (const row of rows) {
      const data: any[] = row?.Data ?? [];
      const rec: Record<string, string> = {};
      columns.forEach((c, i) => {
        rec[c] = data[i]?.VarCharValue ?? "";
      });
      out.push(rec);
    }
    token = page["NextToken"];
    if (!token) break;
  }

  return out;
}

/** Sessions whose start falls inside [from, to). */
export async function querySessionsInRange(
  creds: AthenaCreds,
  fromIso: string,
  toIso: string,
  limit: number,
): Promise<Record<string, string>[]> {
  const sql = `SELECT * FROM ${SESSION_TABLE}
    WHERE session_start >= ? AND session_start <= ?
    ORDER BY session_start DESC
    LIMIT ${Math.max(1, Math.min(1000, Math.floor(limit)))}`;
  return runAthenaQuery(creds, sql, [fromIso, toIso], limit);
}
