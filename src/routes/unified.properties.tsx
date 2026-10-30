import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Mono } from "@/components/ui-bits";
import { AnalyticsTable } from "@/components/AnalyticsTable";

export const Route = createFileRoute("/unified/properties")({
  head: () => ({
    meta: [
      { title: "UCT Properties · Resolve.io" },
      { name: "description", content: "Property / listing event stream from the unified data warehouse." },
    ],
  }),
  component: UnifiedProperties,
});

interface UnifiedPropertyRow {
  id: string;
  eventType: string;
  propertyId: string;
  personId: string;
  timestamp: string;
  source: string;
}

const ROWS: UnifiedPropertyRow[] = [
  { id: "evt_p_001", eventType: "property_viewed", propertyId: "prop_8a2_101", personId: "prs_1f4a3e2", timestamp: "2026-08-06T14:24:33Z", source: "website" },
  { id: "evt_p_002", eventType: "property_saved", propertyId: "prop_8a2_101", personId: "prs_1f4a3e2", timestamp: "2026-08-06T14:31:05Z", source: "website" },
  { id: "evt_p_003", eventType: "property_viewed", propertyId: "prop_3f4_204", personId: "prs_2c8b1d9", timestamp: "2026-08-06T13:46:17Z", source: "quiz_engine" },
  { id: "evt_p_004", eventType: "property_shared", propertyId: "prop_9e2_512", personId: "prs_9e2f7c1", timestamp: "2026-08-06T12:15:44Z", source: "email" },
  { id: "evt_p_005", eventType: "property_contact", propertyId: "prop_4a1_88", personId: "prs_4a1d6b8", timestamp: "2026-08-06T10:39:51Z", source: "website" },
  { id: "evt_p_006", eventType: "property_viewed", propertyId: "prop_4a1_88", personId: "prs_4a1d6b8", timestamp: "2026-08-06T10:42:12Z", source: "website" },
];

function UnifiedProperties() {
  return (
    <div className="pb-10">
      <PageHeader
        title="UCT Properties"
        subtitle="Property / listing event stream from the unified warehouse — views, saves, shares, and contact requests."
      />

      <div className="px-6">
        <AnalyticsTable
          rows={ROWS}
          rowKey={(r) => r.id}
          pageSize={10}
          csvName="uct-properties.csv"
          columns={[
            {
              key: "id",
              header: "Event ID",
              cell: (r) => <Mono>{r.id}</Mono>,
              value: (r) => r.id,
            },
            { key: "eventType", header: "Event type", cell: (r) => r.eventType, value: (r) => r.eventType },
            { key: "propertyId", header: "Property ID", cell: (r) => <Mono>{r.propertyId}</Mono>, value: (r) => r.propertyId },
            { key: "personId", header: "Person ID", cell: (r) => <Mono>{r.personId}</Mono>, value: (r) => r.personId },
            { key: "timestamp", header: "Timestamp", cell: (r) => r.timestamp, value: (r) => r.timestamp },
            { key: "source", header: "Source", cell: (r) => r.source, value: (r) => r.source },
          ]}
        />
      </div>
    </div>
  );
}
