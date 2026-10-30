// Client-side daily cache for Identity reporting data.
// Reporting data changes at most once per day, so responses are stored in
// localStorage and served without network until the user clicks "Refresh data"
// or the UTC calendar day changes.

import type { PipelineStatus } from "./identityLiveApi";

const PREFIX = "identity-reporting-cache:v1:";
const META_KEY = `${PREFIX}meta`;
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

type Meta = {
  fingerprint: string;
  checkedAt: number;
  pipeline: PipelineStatus;
};

type Entry = {
  cachedAt: number;
  fingerprint: string;
  data: unknown;
};

export type InvalidateScope = "all" | "reporting";

let invalidator: ((scope: InvalidateScope) => void) | null = null;

export function registerPipelineFingerprintInvalidator(fn: (scope: InvalidateScope) => void) {
  invalidator = fn;
}

function hasStorage() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function utcDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function fingerprintOf(p: PipelineStatus) {
  return [
    p.identityGraph?.lastProcessDate ?? "",
    p.accuracy?.lastProcessDate ?? "",
    p.decisions?.lastProcessDate ?? "",
    p.expectedProcessDate ?? "",
  ].join("|");
}

export function clearAllReportingCache() {
  if (!hasStorage()) return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX) && k !== META_KEY) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

function readMeta(): Meta | null {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as Meta) : null;
  } catch {
    return null;
  }
}

function writeMeta(meta: Meta) {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* quota — ignore */
  }
}

/** True when we have never checked, or the UTC day rolled over since the last check. */
export function shouldRefreshPipeline(meta: Meta | null = readMeta()) {
  if (!meta) return true;
  return utcDay(meta.checkedAt) !== utcDay(Date.now());
}

let inflightMeta: Promise<Meta> | null = null;

export async function ensurePipelineMeta(fetchPipeline: () => Promise<PipelineStatus>): Promise<Meta> {
  const existing = readMeta();
  if (existing && !shouldRefreshPipeline(existing)) return existing;
  if (inflightMeta) return inflightMeta;

  inflightMeta = (async () => {
    const pipeline = await fetchPipeline();
    const fingerprint = fingerprintOf(pipeline);
    const dayChanged = !existing || utcDay(existing.checkedAt) !== utcDay(Date.now());
    if (!existing || dayChanged || existing.fingerprint !== fingerprint) {
      clearAllReportingCache();
      invalidator?.("reporting");
    }
    const meta: Meta = { fingerprint, checkedAt: Date.now(), pipeline };
    writeMeta(meta);
    return meta;
  })();

  try {
    return await inflightMeta;
  } finally {
    inflightMeta = null;
  }
}

function entryKey(path: string, params: Record<string, unknown>) {
  return `${PREFIX}${path}?${JSON.stringify(params, Object.keys(params).sort())}`;
}

function readEntry(key: string, fingerprint: string): Entry | null {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry;
    const stale =
      entry.fingerprint !== fingerprint ||
      Date.now() - entry.cachedAt > MAX_AGE_MS ||
      utcDay(entry.cachedAt) !== utcDay(Date.now());
    if (stale) {
      localStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeEntry(key: string, fingerprint: string, data: unknown) {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify({ cachedAt: Date.now(), fingerprint, data } satisfies Entry));
  } catch {
    // Quota exceeded — drop the cache and continue uncached.
    clearAllReportingCache();
  }
}

/** Serves a reporting response from localStorage when fresh, otherwise fetches and stores it. */
export async function cachedReportingGet<T>(
  path: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  fetchPipeline: () => Promise<PipelineStatus>,
): Promise<T> {
  let fingerprint = "";
  try {
    fingerprint = (await ensurePipelineMeta(fetchPipeline)).fingerprint;
  } catch {
    fingerprint = readMeta()?.fingerprint ?? "";
  }
  const key = entryKey(path, params);
  const hit = readEntry(key, fingerprint);
  if (hit) return hit.data as T;
  const data = await fetcher();
  writeEntry(key, fingerprint, data);
  return data;
}

/** Manual "Refresh data": purge the daily cache and invalidate every Identity query. */
export function forceRefreshReportingData(): void {
  clearAllReportingCache();
  if (hasStorage()) localStorage.removeItem(META_KEY);
  invalidator?.("all");
}
