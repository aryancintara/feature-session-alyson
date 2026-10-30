// All investigation dialogs (Merge / Split / RemoveLink / ReassignLink /
// MarkShared / MarkIncorrect / Reverse / UnavailableAction).
// Each dialog reads current store state, shows a before/after preview, and
// executes through useIdentityStore mutations so audit + reversal work.

import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, GitMerge, Split, Trash2, ArrowRightLeft, Flag, XCircle, RotateCcw, ArrowRight } from "lucide-react";
import { useIdentityStore, type AuditEntry } from "@/lib/identityStore";
import { PEOPLE, INDIVIDUAL_PROFILES, type SharingClass } from "@/lib/mockData";
import { cn } from "@/lib/utils";

// -------------------- Merge ---------------------------------------------------

export function MergeDialog({ open, onOpenChange, aPersonId, bPersonId }: {
  open: boolean; onOpenChange: (v: boolean) => void; aPersonId?: string; bPersonId?: string;
}) {
  const merge = useIdentityStore((s) => s.merge);
  const [reason, setReason] = useState("Investigator manually confirmed match");
  const a = PEOPLE.find((p) => p.id === aPersonId);
  const b = PEOPLE.find((p) => p.id === bPersonId);
  const canRun = a && b && a.id !== b.id;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitMerge className="h-4 w-4" /> Merge person entities</DialogTitle>
          <DialogDescription>Preview and confirm. Reversible from the audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <PreviewRow left={a ? `${a.name} (${a.id})` : "(select)"} right={b ? `${b.name} (${b.id})` : "(select)"} />
          <ImpactCard items={[
            { label: "Profiles combined", value: (a && b) ? String(INDIVIDUAL_PROFILES.filter((ip) => ip.personId === a.id || ip.personId === b.id).length) : "—" },
            { label: "Merge confidence", value: "97%" },
            { label: "False merge risk", value: "3%" },
            { label: "Downstream systems", value: "audience · funnel · propensity" },
          ]} />
          <ReasonInput value={reason} onChange={setReason} />
        </div>
        <DialogFooter>
          <SecondaryBtn onClick={() => onOpenChange(false)}>Cancel</SecondaryBtn>
          <PrimaryBtn
            disabled={!canRun}
            onClick={() => {
              if (!canRun) return;
              const id = merge(a!.id, b!.id, reason);
              toast.success("Merge committed", {
                description: `${a!.name} ⇢ ${b!.name}`,
                action: { label: "Undo", onClick: () => useIdentityStore.getState().reverse(id) },
              });
              onOpenChange(false);
            }}
          >Confirm merge</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Split ---------------------------------------------------

export function SplitDialog({ open, onOpenChange, personId }: { open: boolean; onOpenChange: (v: boolean) => void; personId?: string }) {
  const split = useIdentityStore((s) => s.split);
  const individuals = useIdentityStore((s) => s.individuals);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("Profile determined to belong to a separate person");
  const options = useMemo(() => individuals.filter((ip) => ip.personId === personId), [individuals, personId]);
  const p = PEOPLE.find((x) => x.id === personId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Split className="h-4 w-4" /> Split profiles off {p?.name ?? "person"}</DialogTitle>
          <DialogDescription>Selected profiles will become a new person entity. Reversible.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-xs">
          <div className="rounded-md border border-border">
            {options.map((ip) => {
              const on = selected.includes(ip.id);
              return (
                <label key={ip.id} className={cn("flex items-center gap-2 border-b border-border p-2 last:border-b-0 cursor-pointer", on && "bg-accent")}>
                  <input type="checkbox" checked={on} onChange={() => setSelected((s) => on ? s.filter((x) => x !== ip.id) : [...s, ip.id])} />
                  <span className="flex-1 truncate">{ip.label}</span>
                  <span className="text-[10px] text-muted-foreground">{ip.type}</span>
                </label>
              );
            })}
            {options.length === 0 && <div className="p-3 text-muted-foreground">No individual profiles for this person.</div>}
          </div>
          <ReasonInput value={reason} onChange={setReason} />
        </div>
        <DialogFooter>
          <SecondaryBtn onClick={() => onOpenChange(false)}>Cancel</SecondaryBtn>
          <PrimaryBtn
            disabled={selected.length === 0 || !personId}
            onClick={() => {
              const id = split(personId!, selected, reason);
              toast.success(`Split ${selected.length} profile(s)`, {
                action: { label: "Undo", onClick: () => useIdentityStore.getState().reverse(id) },
              });
              setSelected([]);
              onOpenChange(false);
            }}
          >Confirm split</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- RemoveLink ---------------------------------------------

export function RemoveLinkDialog({ open, onOpenChange, relationshipId, label }: {
  open: boolean; onOpenChange: (v: boolean) => void; relationshipId?: string; label?: string;
}) {
  const remove = useIdentityStore((s) => s.removeRelationship);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Remove relationship</DialogTitle>
          <DialogDescription>{label ? `Removes edge "${label}".` : "This will remove the selected edge."} Reversible.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-xs">
          <ReasonInput value={reason} onChange={setReason} placeholder="Why is this link incorrect?" />
        </div>
        <DialogFooter>
          <SecondaryBtn onClick={() => onOpenChange(false)}>Cancel</SecondaryBtn>
          <PrimaryBtn
            disabled={!relationshipId || !reason}
            onClick={() => {
              if (!relationshipId) return;
              const id = remove(relationshipId, reason);
              toast.success("Relationship removed", {
                action: { label: "Undo", onClick: () => useIdentityStore.getState().reverse(id) },
              });
              onOpenChange(false);
            }}
          >Remove link</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- ReassignLink -------------------------------------------

export function ReassignLinkDialog({ open, onOpenChange, relationshipId, label }: {
  open: boolean; onOpenChange: (v: boolean) => void; relationshipId?: string; label?: string;
}) {
  const reassign = useIdentityStore((s) => s.reassignRelationship);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Reassign relationship</DialogTitle>
          <DialogDescription>{label ?? "Point this edge at a different destination."} Reversible.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-xs">
          <Field label="New destination ID">
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. p_0002 · co_004 · pl_…" className="w-full rounded-md border border-border bg-background px-2 py-1 outline-none" />
          </Field>
          <ReasonInput value={reason} onChange={setReason} />
        </div>
        <DialogFooter>
          <SecondaryBtn onClick={() => onOpenChange(false)}>Cancel</SecondaryBtn>
          <PrimaryBtn
            disabled={!relationshipId || !target}
            onClick={() => {
              const id = reassign(relationshipId!, target, reason);
              toast.success("Relationship reassigned", { action: { label: "Undo", onClick: () => useIdentityStore.getState().reverse(id) } });
              onOpenChange(false);
            }}
          >Reassign</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- MarkShared ---------------------------------------------

const SHARING_CLASSES: { value: SharingClass; label: string; effect: string }[] = [
  { value: "household", label: "Household shared", effect: "Removes conflict, keeps link" },
  { value: "company", label: "Company shared", effect: "Removes conflict, keeps link" },
  { value: "shared_business_phone", label: "Shared business phone", effect: "Removes conflict" },
  { value: "shared_office_device", label: "Shared office device", effect: "Removes conflict" },
  { value: "historical_reuse", label: "Historical reuse", effect: "Marks historical" },
  { value: "unexplained", label: "Unexplained", effect: "Keeps conflict, needs investigation" },
];

export function MarkSharedDialog({ open, onOpenChange, signalId, currentClass }: {
  open: boolean; onOpenChange: (v: boolean) => void; signalId?: string; currentClass?: SharingClass;
}) {
  const mark = useIdentityStore((s) => s.markSignalSharing);
  const [pick, setPick] = useState<SharingClass>(currentClass ?? "household");
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Flag className="h-4 w-4" /> Mark signal sharing</DialogTitle>
          <DialogDescription>Classify how this signal is shared. Reversible.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-xs">
          <div className="rounded-md border border-border divide-y divide-border">
            {SHARING_CLASSES.map((c) => {
              const on = pick === c.value;
              return (
                <label key={c.value} className={cn("flex items-center gap-2 p-2 cursor-pointer", on && "bg-accent")}>
                  <input type="radio" checked={on} onChange={() => setPick(c.value)} />
                  <div className="flex-1"><div className="font-medium">{c.label}</div><div className="text-[10px] text-muted-foreground">{c.effect}</div></div>
                </label>
              );
            })}
          </div>
          <ReasonInput value={reason} onChange={setReason} />
        </div>
        <DialogFooter>
          <SecondaryBtn onClick={() => onOpenChange(false)}>Cancel</SecondaryBtn>
          <PrimaryBtn
            disabled={!signalId}
            onClick={() => {
              const id = mark(signalId!, pick, reason);
              toast.success(`Signal classified: ${pick}`, {
                action: { label: "Undo", onClick: () => useIdentityStore.getState().reverse(id) },
              });
              onOpenChange(false);
            }}
          >Apply</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- MarkIncorrect ------------------------------------------

export function MarkIncorrectDialog({ open, onOpenChange, signalId }: {
  open: boolean; onOpenChange: (v: boolean) => void; signalId?: string;
}) {
  const mark = useIdentityStore((s) => s.markSignalIncorrect);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><XCircle className="h-4 w-4" /> Mark signal incorrect</DialogTitle>
          <DialogDescription>Flags the signal as a confirmed conflict. Downstream decisions using it will be revisited. Reversible.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-xs">
          <ReasonInput value={reason} onChange={setReason} placeholder="What is incorrect about this signal?" />
        </div>
        <DialogFooter>
          <SecondaryBtn onClick={() => onOpenChange(false)}>Cancel</SecondaryBtn>
          <PrimaryBtn
            disabled={!signalId || !reason}
            onClick={() => {
              const id = mark(signalId!, reason);
              toast.success("Signal marked incorrect", { action: { label: "Undo", onClick: () => useIdentityStore.getState().reverse(id) } });
              onOpenChange(false);
            }}
          >Mark incorrect</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Reverse ------------------------------------------------

export function ReverseDialog({ open, onOpenChange, entry }: {
  open: boolean; onOpenChange: (v: boolean) => void; entry?: AuditEntry;
}) {
  const reverse = useIdentityStore((s) => s.reverse);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Reverse audit action</DialogTitle>
          <DialogDescription>Restores the previous state and creates a compensating audit entry.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-xs">
          {entry ? (
            <div className="rounded-md border border-border p-2">
              <div className="font-medium">{entry.summary}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{entry.user} · {new Date(entry.ts).toLocaleString()}</div>
              {entry.reason && <div className="mt-1 text-muted-foreground">Reason: {entry.reason}</div>}
              {entry.reversedBy && <div className="mt-1 text-warning">Already reversed by {entry.reversedBy}.</div>}
            </div>
          ) : <div className="text-muted-foreground">No entry selected.</div>}
        </div>
        <DialogFooter>
          <SecondaryBtn onClick={() => onOpenChange(false)}>Cancel</SecondaryBtn>
          <PrimaryBtn
            disabled={!entry || !entry.reversible || Boolean(entry.reversedBy)}
            onClick={() => {
              if (!entry) return;
              const ok = reverse(entry.id);
              if (ok) toast.success("Action reversed");
              else toast.error("Could not reverse");
              onOpenChange(false);
            }}
          >Reverse</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Unavailable Action card --------------------------------

export function UnavailableActionCard({ title, reason, actions }: {
  title: string; reason: string; actions: { label: string; onClick: () => void; icon?: React.ReactNode }[];
}) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-warning-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-warning" /> {title}
      </div>
      <div className="mb-2 text-muted-foreground">{reason}</div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 hover:bg-accent"
          >{a.icon}{a.label}<ArrowRight className="h-3 w-3" /></button>
        ))}
      </div>
    </div>
  );
}

// -------------------- Shared bits --------------------------------------------

function PreviewRow({ left, right }: { left: string; right: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded border border-border p-2 font-medium">{left}</div>
      <div className="rounded border border-border p-2 font-medium">{right}</div>
    </div>
  );
}
function ImpactCard({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="rounded border border-border bg-muted/30 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Impact preview</div>
      <ul className="space-y-0.5">
        {items.map((i) => <li key={i.label} className="flex justify-between"><span className="text-muted-foreground">{i.label}</span><span className="font-medium">{i.value}</span></li>)}
      </ul>
    </div>
  );
}
function ReasonInput({ value, onChange, placeholder = "Reason (required for audit)" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Reason</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} className="w-full rounded-md border border-border bg-background px-2 py-1 outline-none" />
    </label>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
function PrimaryBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">{children}</button>;
}
function SecondaryBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">{children}</button>;
}
