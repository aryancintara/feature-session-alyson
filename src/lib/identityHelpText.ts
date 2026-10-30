/**
 * Plain-language help copy for the Identity UI.
 * Source: IDENTITY_UI_ELEMENT_DESCRIPTIONS.md — kept short (≤ ~140 chars) for tooltips.
 *
 * Copy rules:
 * - Accuracy = did we attach the RIGHT person vs SOT (Leads Plus) (phone via Homelight).
 * - Match rate / resolution / share = did we attach A person / how often a method was used.
 * - Cost is not available yet — show "—".
 * - Leads Plus is source of truth only; it is never scored against itself.
 */
export const HELP = {
  // shared chrome
  dateRange: "Pick which days of identity data to view. You can select up to 7 days at once.",
  pipeline: "Shows whether yesterday's identity processing finished and how fresh these numbers are.",
  peopleOnly: "This product tracks people identities only — not companies or places.",

  // overview
  resolutionRate: "Of events that should get a person ID, the share that successfully got one.",
  failureRate: "Of events that should get a person ID, the share that ended with no person attached.",
  accuracy:
    "On the overlapped sample vs Lead Plus: did we attach the right person? A record counts only if every Lead Plus field that has a value (email, name, address) also matches in the graph. Phone is checked separately via Homelight.",
  fieldMatchRate:
    "On the same Lead Plus overlap sample: looking at each field one at a time (email, name, address), how often that field matched. A record can pass some fields and fail others — unlike Accuracy, which requires all present fields to match.",
  methodConfidence:
    "How much we trust the method that attached this person. The identity job gives each method type a fixed trust score (phone highest, then email, then name+address; weaker methods score lower). It is not predicted by a model, and it is not the same as accuracy vs Lead Plus.",
  cost: "Cost per identity is not available yet — shown as —.",
  baseline: "How the selected period compares with the average of the previous ~30 days.",
  volume: "Total events we tried to identify, and how many of them received a person ID.",
  trendChart: "Resolution, failure and accuracy over time, so you can spot good and bad days.",
  methodRanking: "Which identity methods were used most often. This is volume share — not accuracy.",
  waterfall:
    "How events flow through method families in priority order: how many entered a step, resolved there, and passed on.",
  waterfallEntering: "Events still needing an identity when this method family is tried.",
  waterfallResolved: "Events that got a person ID using this method family.",
  waterfallPassed: "Events that did not resolve here and moved on to the next method.",
  waterfallMatch:
    "How often this family resolved events, its share of all resolutions, and average confidence — not accuracy vs SOT (Leads Plus).",
  systemHealth: "Quick pulse of the live Identity Search API — calls, success and latency. Full detail on API Health.",

  // method analysis
  methodsTable:
    "One row per identity method: how often it was used, confidence, and where available accuracy vs SOT (Leads Plus).",
  methodRecords: "How many events used this method as the winning way to assign a person.",
  methodResolved: "How many of those events successfully got a person ID via this method.",
  matchRate:
    "Share of events that got a person ID attached (resolution). Not the same as Accuracy or Field match rate.",
  avgConfidence:
    "How much we trust the method that attached the person, averaged across these events. Each method gets a fixed trust score from the identity job (phone highest, then email, then name+address, then weaker keys like address-only or IP). Not a machine-learning score, and not “accuracy vs Lead Plus.”",
  accuracyByMethod:
    "On the overlapped sample where this method won, how often the person matched SOT (Leads Plus) (phone uses Homelight).",
  comparedVsSot: "Number of records for this method we could join to a SOT (Leads Plus) record and score.",
  cascadeStep: "Position of this method family in the priority order that identity resolution tries.",
  methodTrends: "How this method's volume and share change day by day across the selected range.",
  latencyByFamily: "How long Identity Search takes per method family. Graph cascade latency may be blank.",
  csvExport: "Download the current table for spreadsheets or offline review.",
  accuracyScoring:
    "Scored only on events we can join to a SOT (Leads Plus) record. Leads Plus is the source of truth, never scored against itself.",

  // audit explorer
  explorerFilters: "Find identity decisions by session, person, email, phone, source or date range.",
  decisionsTable:
    "Each row is one identity decision: which event or session, which person (if any), which method won, and status.",
  decisionStatus: "Whether the event was resolved to a person or left without an identity.",
  winningMethod: "The rule that decided which person to attach, such as email match or phone match.",
  decisionModal: "The full story for one session: profile fields, winning method, confidence and related history.",
  decisionInputs: "The values that were available when the identity decision was made.",
  decisionHistory: "Earlier identity decisions recorded for this same session.",

  // errors
  errorTotals: "How many problem records were flagged, how many are still open, and how many error types appeared.",
  errorsTable: "Catalog of data quality issues found during identity processing, with counts and examples.",
  errorSeverity: "How urgent the issue is: Critical, High, Medium or Low.",
  errorStatus: "Whether the issue is open, being investigated, or resolved.",
  errorExample: "A sample record showing what this error looks like.",

  // api health
  callVolume: "How many Identity Search (partial-match) API calls ran in this window.",
  successRate: "Share of Identity Search calls that succeeded rather than failed.",
  latency: "How slow the slowest typical calls were — useful for spotting API slowdowns.",
  apiSeries: "Identity Search call volume and 5xx server error rate over time.",
  apiStatusBreakdown: "Logged Identity Search 5xx server errors grouped by HTTP status code.",
  apiErrors: "The most recent Identity Search failures, with reason and timing.",
  sampling: "Successful (2xx) calls may be sampled in the logs, so call volume is an estimate.",

  // source comparison
  sot: "Trusted qualified Leads Plus records. Other sources are compared to this — Leads Plus is never scored against itself.",
  comparePicker: "Choose which graph source to compare against SOT (Leads Plus).",
  overlap: "How many sample records could be joined between SOT (Leads Plus) and the chosen source.",
  fieldAgreement: "On that sample, how often each field matched between SOT (Leads Plus) and the graph.",
  bySourceAccuracy: "Accuracy of this source's identities vs SOT (Leads Plus) for the selected period.",
  compareRows: "Example joined records showing where fields agree or differ with trusted Leads Plus.",
  auditLink: "Open this session in Audit Explorer to see why the identity was assigned.",

  refreshData:
    "Clears the saved daily cache and loads the latest numbers from the server. Use after the identity pipeline has finished for the day.",

  // optional screens
  validation: "Automated checks that the day's identity data looks healthy (pass / warn / fail) with counts.",
  remediation: "Logged follow-ups for identity issues. Creating an entry records intent; it does not rewrite the graph.",
  personProfile: "Who this person ID is: contact fields and recent events linked to them.",
  assignmentAudit: "How this person was assigned — the winning method and supporting matches.",
} as const;
