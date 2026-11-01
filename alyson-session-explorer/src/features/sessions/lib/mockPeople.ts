/** Minimal deterministic people/sessions fixtures for local Session Explorer mocks. */

export interface MockSession {
  id: string;
  personId: string;
  startTime: string;
  endTime: string;
  exitReason: "inactivity_timeout" | "heartbeat_exit";
  pageViews: number;
  events: number;
  device: string;
  source: string;
}

export interface Person {
  id: string;
  city: string;
  state: string;
  consent: {
    platform: boolean;
    litigationRisk: boolean;
  };
  sessions: MockSession[];
}

const CITIES: [string, string][] = [
  ["Austin", "TX"],
  ["Denver", "CO"],
  ["Seattle", "WA"],
  ["Miami", "FL"],
  ["Brooklyn", "NY"],
  ["Portland", "OR"],
  ["Atlanta", "GA"],
  ["Phoenix", "AZ"],
  ["Boston", "MA"],
  ["Chicago", "IL"],
];
const SOURCES = [
  "website_tracker",
  "meta_ads",
  "google_ads",
  "tiktok_ads",
  "klaviyo",
  "twilio",
  "quiz_engine",
];
const DEVICES = [
  "iPhone 15 Pro · Safari",
  "MacBook Pro · Chrome",
  "Pixel 8 · Chrome",
  "iPad · Safari",
  "Windows · Edge",
];

/** Fixed clock so mock rows stay stable across reloads. */
export const NOW_MS = Date.UTC(2026, 7, 3, 12, 0, 0);

function rand<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function hours(n: number): string {
  return new Date(NOW_MS - n * 3600 * 1000).toISOString();
}

function buildSessions(seed: number, personId: string): MockSession[] {
  const count = 1 + (seed % 4);
  return Array.from({ length: count }).map((_, i) => ({
    id: `ses_${personId}_${i}`,
    personId,
    startTime: hours(i * 24 + 3),
    endTime: hours(i * 24 + 2.5),
    exitReason: i % 2 === 0 ? "inactivity_timeout" : "heartbeat_exit",
    pageViews: 3 + ((seed * (i + 1)) % 14),
    events: 5 + ((seed * 3 + i) % 22),
    device: rand(DEVICES, seed + i),
    source: rand(SOURCES, seed + i),
  }));
}

function buildPerson(seed: number): Person {
  const [city, state] = rand(CITIES, seed);
  const id = `prs_${(seed * 982451653).toString(36).slice(0, 10)}`;
  return {
    id,
    city,
    state,
    consent: {
      platform: true,
      litigationRisk: seed % 23 === 0,
    },
    sessions: buildSessions(seed, id),
  };
}

export const PEOPLE: Person[] = Array.from({ length: 24 }).map((_, i) =>
  buildPerson(i + 1),
);
