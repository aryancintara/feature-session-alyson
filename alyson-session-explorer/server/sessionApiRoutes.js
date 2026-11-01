/**
 * Dev/local proxy for the Session Explorer API.
 * Keeps SESSION_API_KEY on the server — never expose it to the browser.
 */

const SESSION_API_BASE =
  process.env.REACT_APP_SESSION_API_BASE_URL ||
  "https://6s2ai70d6l.execute-api.us-west-2.amazonaws.com/prod";

const SESSION_PAGE_SIZE = 200;

const JOURNEY_API_FLAGS = {
  visit: "has_visit",
  quiz_start: "has_quiz_start",
  partial_lead: "has_partial_lead",
  lead: "has_lead",
  otp_verified: "has_otp_verified",
  qualified_connected: "has_qualified_connected",
  meeting: "has_meeting",
  listing: "has_listing",
  revenue: "has_revenue",
  consent_given: "has_consent",
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function isJourneyFilter(value) {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(JOURNEY_API_FLAGS, value);
}

function flagOn(value) {
  return value === true || value === "true" || value === "1";
}

function journeyFilterHonored(journey, rows, applied) {
  if (!journey) return true;
  const flag = JOURNEY_API_FLAGS[journey];
  if (applied && flagOn(applied[flag])) return true;
  if (!rows.length) return true;
  return rows.every((row) => flagOn(row[flag]));
}

function sessionRequest(from, to, pageSize = SESSION_PAGE_SIZE, journey) {
  const start = new Date(from);
  const end = new Date(to);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || start >= end) {
    throw new Error("Invalid date range");
  }
  const utc = (date) => date.toISOString().replace(".000Z", "Z");
  const params = new URLSearchParams({
    from: utc(start),
    to: utc(end),
    page_size: String(
      Math.max(1, Math.min(SESSION_PAGE_SIZE, Math.floor(pageSize) || SESSION_PAGE_SIZE)),
    ),
  });
  if (journey) params.set(JOURNEY_API_FLAGS[journey], "true");
  return params;
}

function parseSessionPage(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Invalid session response");
  const total = payload.total;
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) {
    throw new Error("Session response is missing total");
  }
  if (!Array.isArray(payload.rows)) throw new Error("Session response is missing rows");
  const rows = payload.rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Invalid session row");
    }
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value),
      ]),
    );
  });
  const applied =
    payload.applied_filters &&
    typeof payload.applied_filters === "object" &&
    !Array.isArray(payload.applied_filters)
      ? payload.applied_filters
      : null;
  return { rows, total, applied };
}

function apiKey() {
  return String(process.env.SESSION_API_KEY || "").trim();
}

function apiBase() {
  return String(SESSION_API_BASE || "").trim().replace(/\/$/, "");
}

async function upstreamGet(pathAndQuery) {
  const key = apiKey();
  const response = await fetch(`${apiBase()}${pathAndQuery}`, {
    headers: { "x-api-key": key, accept: "application/json" },
  });
  return response;
}

async function handlePage(req, res) {
  const key = apiKey();
  if (!key) {
    sendJson(res, 200, {
      ok: false,
      error: "Session API key is not connected yet. Add SESSION_API_KEY to your env file.",
      rows: [],
      total: null,
      journeyHonored: true,
      counts: null,
    });
    return;
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    sendJson(res, 400, { ok: false, error: "Invalid JSON body.", rows: [], total: null, journeyHonored: true, counts: null });
    return;
  }

  const from = typeof body.from === "string" ? body.from : "";
  const to = typeof body.to === "string" ? body.to : "";
  const journey =
    body.journey == null || body.journey === ""
      ? null
      : isJourneyFilter(body.journey)
        ? body.journey
        : null;
  if (!from || !to) {
    sendJson(res, 400, { ok: false, error: "from and to are required", rows: [], total: null, journeyHonored: true, counts: null });
    return;
  }
  if (body.journey != null && body.journey !== "" && !journey) {
    sendJson(res, 400, { ok: false, error: "Unknown journey filter", rows: [], total: null, journeyHonored: true, counts: null });
    return;
  }

  try {
    sessionRequest(from, to);
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid date range",
      rows: [],
      total: null,
      journeyHonored: true,
      counts: null,
    });
    return;
  }

  const get = (pageSize, journeyFilter) =>
    upstreamGet(`/sessions?${sessionRequest(from, to, pageSize, journeyFilter)}`);

  const count = async (journeyFilter) => {
    try {
      const response = await get(1, journeyFilter);
      if (!response.ok) return { total: null, honored: false };
      const page = parseSessionPage(await response.json());
      return {
        total: page.total,
        honored: journeyFilterHonored(journeyFilter, page.rows, page.applied),
      };
    } catch {
      return { total: null, honored: false };
    }
  };

  try {
    const [response, quizStart, partial, consent, range] = await Promise.all([
      get(200, journey),
      count("quiz_start"),
      count("partial_lead"),
      count("consent_given"),
      journey ? count(null) : Promise.resolve(null),
    ]);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[sessionApi] list failed [${response.status}]: ${text.slice(0, 500)}`);
      const error =
        response.status === 401 || response.status === 403
          ? "Session API rejected the key (access denied)."
          : `Session API request failed (${response.status}).`;
      sendJson(res, 200, {
        ok: false,
        error,
        rows: [],
        total: null,
        journeyHonored: true,
        counts: null,
      });
      return;
    }

    const page = parseSessionPage(await response.json());
    sendJson(res, 200, {
      ok: true,
      error: null,
      rows: page.rows,
      total: page.total,
      journeyHonored: journeyFilterHonored(journey, page.rows, page.applied),
      counts: {
        quizStart,
        partial,
        consent,
        rangeTotal: range ? range.total : page.total,
      },
    });
  } catch (error) {
    console.error("[sessionApi] list error:", error);
    sendJson(res, 200, {
      ok: false,
      error: "Failed to load sessions.",
      rows: [],
      total: null,
      journeyHonored: true,
      counts: null,
    });
  }
}

async function handleDetail(req, res) {
  const key = apiKey();
  if (!key) {
    sendJson(res, 200, {
      ok: false,
      error: "Session API key is not connected yet. Add SESSION_API_KEY to your env file.",
      detail: null,
    });
    return;
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    sendJson(res, 400, { ok: false, error: "Invalid JSON body.", detail: null });
    return;
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId || sessionId.length > 512) {
    sendJson(res, 400, { ok: false, error: "A valid session ID is required.", detail: null });
    return;
  }

  try {
    const response = await upstreamGet(`/sessions/${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      sendJson(res, 200, {
        ok: false,
        error:
          response.status === 404
            ? "Session details were not found."
            : `Session details could not be loaded (${response.status}).`,
        detail: null,
      });
      return;
    }
    const detail = await response.json();
    sendJson(res, 200, { ok: true, error: null, detail });
  } catch (error) {
    console.error("[sessionApi] detail error:", error);
    sendJson(res, 200, {
      ok: false,
      error: "Session details could not be loaded. Please try opening the row again.",
      detail: null,
    });
  }
}

function handleSessionApiRequest(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "POST" && (path === "/page" || path.endsWith("/page"))) {
    handlePage(req, res);
    return;
  }
  if (req.method === "POST" && (path === "/detail" || path.endsWith("/detail"))) {
    handleDetail(req, res);
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found." });
}

module.exports = { handleSessionApiRequest };
