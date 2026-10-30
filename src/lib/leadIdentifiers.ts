/** Display-only filter for lead custom identifiers: internal heartbeat bookkeeping is never shown. */
const HIDDEN_KEYS = ["heartbeat_recovered_session"];
const HIDDEN = new Set(HIDDEN_KEYS);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalise = (k: string) => k.trim().toLowerCase().replace(/[-\s]+/g, "_");
const isHiddenKey = (k: unknown) => typeof k === "string" && HIDDEN.has(normalise(k));
const PAIR_RE = new RegExp(`${HIDDEN_KEYS.map(escapeRe).join("|")}\\s*(?::|=>|\\bis\\b)\\s*(?:true|false|nil|null|yes|no|"[^"]*"|'[^']*'|[\\w-]+)?`, "gi");

function tryParse(v: string): unknown | undefined {
  const t = v.trim();
  if (!/^[{[]/.test(t)) return undefined;
  try { return JSON.parse(t); } catch { return undefined; }
}

/** Drops hidden keys from objects/arrays (one level deep, plus array elements). */
function withoutHidden(value: unknown): unknown {
  if (Array.isArray(value)) {
    const kept = value
      .map((x) => (x !== null && typeof x === "object" ? withoutHidden(x) : x))
      .filter((x) => !(isHiddenKey(x) || (x !== null && typeof x === "object" && Object.keys(x as object).length === 0)));
    return kept.length ? kept : null;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => { if (!isHiddenKey(k)) out[k] = v; });
    return Object.keys(out).length ? out : null;
  }
  return value;
}

/** Hidden heartbeat identifiers are stripped; returns null when nothing meaningful is left to show. */
export function customIdentifiersForDisplay(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "string" ? tryParse(value) ?? value : value;
  const kept = withoutHidden(parsed);
  if (kept === null || kept === undefined) return null;
  if (typeof kept === "string") {
    const stripped = kept.replace(PAIR_RE, " ").replace(/[^A-Za-z0-9]+/g, " ").trim();
    if (!stripped || isHiddenKey(stripped)) return null;
  }
  return kept;
}
