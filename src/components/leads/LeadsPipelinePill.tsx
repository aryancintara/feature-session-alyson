import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pill } from "@/components/identity/bits";
import { pipelineTone, relTime } from "@/lib/unifiedPropertiesApi";
import { leadsGet, type LeadsPipelineStatus } from "@/lib/unifiedLeadsApi";

export const leadsPipelineQuery = { queryKey: ["unified-leads", "pipeline"], queryFn: () => leadsGet<LeadsPipelineStatus>("/v1/pipeline/status"), retry: 1, refetchInterval: 60_000 };
export const LEADS_OVERALL: Record<string, string> = { healthy: "Pipeline healthy", lagging: "Pipeline lagging", stale: "Pipeline behind", failed: "Pipeline failed", unknown: "Pipeline status unknown" };

export function LeadsPipelinePill() {
  const q = useQuery(leadsPipelineQuery);
  if (q.isLoading) return <Pill>Checking pipeline…</Pill>;
  if (!q.data) return null;
  const last = q.data.pipelines[0]?.lastSuccessfulAt;
  return (
    <Link to="/unified-leads/pipeline-api-health" aria-label="Open leads pipeline and API health">
      <Pill tone={pipelineTone(q.data.overallStatus)}>{LEADS_OVERALL[q.data.overallStatus] ?? "Pipeline status"}{last ? ` · ${relTime(last)}` : ""}</Pill>
    </Link>
  );
}
