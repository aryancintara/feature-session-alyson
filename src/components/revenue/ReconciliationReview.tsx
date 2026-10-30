import { ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { reconciliationIntegrityChecks, type ReconciliationIntegrity } from "@/lib/reconciliationReview";

export type EvidenceMethod = "automated" | "export" | "manual";
export interface ReviewEntry { id: number; at: string; scope: string; action: string; detail: string }
interface Props {
  scope: string; source: string; start: string; end: string;
  method: EvidenceMethod; onMethod: (method: EvidenceMethod) => void;
  approved: boolean; onApprove: (approved: boolean) => void;
  checked: boolean; integrity?: ReconciliationIntegrity | null; entries: ReviewEntry[];
  onActivity: (action: string, detail: string) => void;
  onRevalidate: (reason: string) => void; loading: boolean;
}

/** Integrity checks only. The previous source-evidence tab was removed at the user's request. */
export function ReconciliationReview(props: Props) {
  return (
    <section aria-label="Reconciliation review" className="border-t border-border pt-5">
      <Tabs defaultValue="integrity">
        <TabsList className="mb-5 flex h-auto w-fit max-w-full flex-wrap">
          <TabsTrigger value="integrity"><ShieldCheck className="mr-2 h-4 w-4" />Integrity checks</TabsTrigger>
        </TabsList>
        <TabsContent value="integrity">
          <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="pb-3 font-medium">Check</th><th className="pb-3 font-medium">Result</th><th className="pb-3 font-medium">Evidence</th></tr></thead><tbody>
            {reconciliationIntegrityChecks(props.integrity).map(({ label, result, evidence, details }) => <tr key={label} className="border-t border-border align-top"><td className="py-3 pr-4 font-medium">{label}</td><td className={`py-3 pr-4 font-medium ${result === "Pass" ? "text-success" : result === "Fail" ? "text-destructive" : "text-muted-foreground"}`}>{result}</td><td className="py-3 text-xs text-muted-foreground"><p className="break-words">{evidence}</p>{details.length > 0 && <ul className="mt-2 space-y-1">{details.map((detail, index) => <li key={index} className="break-all font-mono">{detail}</li>)}</ul>}</td></tr>)}
          </tbody></table></div>
          <p className="mt-3 text-xs text-warning">Matching revenue totals do not verify session coverage, duplicates, timestamps or joins.</p>
        </TabsContent>
      </Tabs>
    </section>
  );
}
