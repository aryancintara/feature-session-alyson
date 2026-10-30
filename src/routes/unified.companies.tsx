import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Mono } from "@/components/ui-bits";
import { AnalyticsTable } from "@/components/AnalyticsTable";

export const Route = createFileRoute("/unified/companies")({
  head: () => ({
    meta: [
      { title: "UCT Companies · Resolve.io" },
      { name: "description", content: "Company / account event stream from the unified data warehouse." },
    ],
  }),
  component: UnifiedCompanies,
});

interface UnifiedCompanyRow {
  id: string;
  eventType: string;
  companyId: string;
  personId: string;
  timestamp: string;
  source: string;
}

const ROWS: UnifiedCompanyRow[] = [
  { id: "evt_c_001", eventType: "company_viewed", companyId: "cmp_221_acme", personId: "prs_1f4a3e2", timestamp: "2026-08-06T14:27:09Z", source: "website" },
  { id: "evt_c_002", eventType: "company_engaged", companyId: "cmp_221_acme", personId: "prs_1f4a3e2", timestamp: "2026-08-06T14:35:22Z", source: "website" },
  { id: "evt_c_003", eventType: "company_viewed", companyId: "cmp_884_stark", personId: "prs_2c8b1d9", timestamp: "2026-08-06T13:48:55Z", source: "quiz_engine" },
  { id: "evt_c_004", eventType: "company_matched", companyId: "cmp_442_wayne", personId: "prs_9e2f7c1", timestamp: "2026-08-06T12:18:30Z", source: "clearbit" },
  { id: "evt_c_005", eventType: "company_viewed", companyId: "cmp_442_wayne", personId: "prs_4a1d6b8", timestamp: "2026-08-06T10:44:02Z", source: "website" },
  { id: "evt_c_006", eventType: "company_engaged", companyId: "cmp_442_wayne", personId: "prs_4a1d6b8", timestamp: "2026-08-06T10:50:11Z", source: "website" },
];

function UnifiedCompanies() {
  return (
    <div className="pb-10">
      <PageHeader
        title="UCT Companies"
        subtitle="Company / account event stream from the unified warehouse — views, engagements, and account matches."
      />

      <div className="px-6">
        <AnalyticsTable
          rows={ROWS}
          rowKey={(r) => r.id}
          pageSize={10}
          csvName="uct-companies.csv"
          columns={[
            {
              key: "id",
              header: "Event ID",
              cell: (r) => <Mono>{r.id}</Mono>,
              value: (r) => r.id,
            },
            { key: "eventType", header: "Event type", cell: (r) => r.eventType, value: (r) => r.eventType },
            { key: "companyId", header: "Company ID", cell: (r) => <Mono>{r.companyId}</Mono>, value: (r) => r.companyId },
            { key: "personId", header: "Person ID", cell: (r) => <Mono>{r.personId}</Mono>, value: (r) => r.personId },
            { key: "timestamp", header: "Timestamp", cell: (r) => r.timestamp, value: (r) => r.timestamp },
            { key: "source", header: "Source", cell: (r) => r.source, value: (r) => r.source },
          ]}
        />
      </div>
    </div>
  );
}
