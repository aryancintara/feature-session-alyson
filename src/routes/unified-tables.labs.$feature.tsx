import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-bits";
import { FEATURE_FLAGS, HIDDEN_FEATURES } from "@/lib/unifiedTablesData";

// Hidden future-ready routes (not in navigation), gated by feature flags.
export const Route = createFileRoute("/unified-tables/labs/$feature")({
  head: () => ({ meta: [{ title: "Unified Labs · Resolve.io" }, { name: "robots", content: "noindex" }] }),
  component: LabsPage,
});

function LabsPage() {
  const { feature } = Route.useParams();
  const f = HIDDEN_FEATURES[feature];
  const enabled = f ? FEATURE_FLAGS[f.flag] : false;
  return (
    <div className="pb-10">
      <PageHeader title={f?.title ?? "Unknown feature"} subtitle={f?.description} />
      <div className="mx-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {enabled ? "This feature is enabled." : <>This feature is behind the <code className="font-mono">{f?.flag ?? "—"}</code> flag and is not enabled yet.</>}
        <div className="mt-3"><Link to="/unified-tables" className="text-primary">Back to Unified Tables</Link></div>
      </div>
    </div>
  );
}
