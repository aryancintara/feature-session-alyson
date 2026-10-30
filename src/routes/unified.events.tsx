import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Mono } from "@/components/ui-bits";
import { AnalyticsTable } from "@/components/AnalyticsTable";

export const Route = createFileRoute("/unified/events")({
  head: () => ({
    meta: [
      { title: "UCT Events · Resolve.io" },
      { name: "description", content: "People event stream from the unified data warehouse." },
    ],
  }),
  component: UnifiedEvents,
});

interface UnifiedEventRow {
  id: string;
  eventType: string;
  personId: string;
  sessionId: string;
  timestamp: string;
  source: string;
}

const ROWS: UnifiedEventRow[] = [
  { id: "evt_u_001", eventType: "page_view", personId: "prs_1f4a3e2", sessionId: "ses_prs_1f4a_0", timestamp: "2026-08-06T14:23:11Z", source: "website" },
  { id: "evt_u_002", eventType: "quiz_started", personId: "prs_2c8b1d9", sessionId: "ses_prs_2c8b_1", timestamp: "2026-08-06T13:45:02Z", source: "quiz_engine" },
  { id: "evt_u_003", eventType: "lead_submitted", personId: "prs_2c8b1d9", sessionId: "ses_prs_2c8b_1", timestamp: "2026-08-06T13:51:29Z", source: "form_capture" },
  { id: "evt_u_004", eventType: "sms_clicked", personId: "prs_9e2f7c1", sessionId: "ses_prs_9e2f_0", timestamp: "2026-08-06T12:10:55Z", source: "twilio" },
  { id: "evt_u_005", eventType: "appointment_set", personId: "prs_9e2f7c1", sessionId: "ses_prs_9e2f_0", timestamp: "2026-08-06T11:58:00Z", source: "calendar" },
  { id: "evt_u_006", eventType: "reactivation_eligible", personId: "prs_4a1d6b8", sessionId: "-", timestamp: "2026-08-06T10:34:18Z", source: "identity_engine" },
];

function UnifiedEvents() {
  return (
    <div className="pb-10">
      <PageHeader
        title="UCT Events"
        subtitle="People event stream from the unified warehouse — every person-level action across web, ads, SMS, email, and partners."
      />

      <div className="px-6">
        <AnalyticsTable
          rows={ROWS}
          rowKey={(r) => r.id}
          pageSize={10}
          csvName="uct-events.csv"
          columns={[
            {
              key: "id",
              header: "Event ID",
              cell: (r) => <Mono>{r.id}</Mono>,
              value: (r) => r.id,
            },
            { key: "eventType", header: "Event type", cell: (r) => r.eventType, value: (r) => r.eventType },
            { key: "personId", header: "Person ID", cell: (r) => <Mono>{r.personId}</Mono>, value: (r) => r.personId },
            { key: "sessionId", header: "Session ID", cell: (r) => <Mono>{r.sessionId}</Mono>, value: (r) => r.sessionId },
            { key: "timestamp", header: "Timestamp", cell: (r) => r.timestamp, value: (r) => r.timestamp },
            { key: "source", header: "Source", cell: (r) => r.source, value: (r) => r.source },
          ]}
        />
      </div>
    </div>
  );
}
