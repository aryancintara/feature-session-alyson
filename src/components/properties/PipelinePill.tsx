import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pill } from "@/components/identity/bits";
import { pipelineTone, propertyGet, relTime, type PipelineStatusResponse } from "@/lib/unifiedPropertiesApi";

export const pipelineQuery = { queryKey: ["unified-properties", "pipeline"], queryFn: () => propertyGet<PipelineStatusResponse>("/v1/pipeline/status"), retry: 1 };

export const PIPELINE_OVERALL: Record<string, string> = { healthy: "Pipelines healthy", lagging: "Pipelines lagging", stale: "Pipelines behind", failed: "Pipeline failed", unknown: "Pipeline status unknown" };

export function PipelinePill() {
  const q = useQuery(pipelineQuery);
  if (q.isLoading) return <Pill>Checking pipelines…</Pill>;
  if (!q.data) return null;
  const events = q.data.pipelines.find((p) => p.id === "property_events");
  return (
    <Link to="/unified-properties/pipeline-api-health" aria-label="Open pipeline and API health">
      <Pill tone={pipelineTone(q.data.overallStatus)}>
        {PIPELINE_OVERALL[q.data.overallStatus] ?? "Pipeline status"}
        {events?.lastSuccessfulAt ? ` · Events ${relTime(events.lastSuccessfulAt)}` : ""}
      </Pill>
    </Link>
  );
}
