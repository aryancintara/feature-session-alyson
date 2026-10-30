import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ClipboardList, FormInput, TrendingDown, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/forms")({
  head: () => ({
    meta: [
      { title: "Form Analytics · Resolve.io" },
      { name: "description", content: "Quiz and form completion plus passively captured identity." },
    ],
  }),
  component: Forms,
});

const QUIZZES = [
  { id: "qz_001", name: "Whole-Home Solar v3", started: 412_881, completed: 142_318 },
  { id: "qz_002", name: "Roof Replacement Quote", started: 248_991, completed: 84_220 },
  { id: "qz_003", name: "Auto Insurance Match", started: 184_412, completed: 38_812 },
];

const QUESTIONS_BY_QUIZ: Record<string, { q: string; shown: number; answered: number; captured?: string[] }[]> = {
  qz_001: [
    { q: "What's your zip code?", shown: 412_881, answered: 392_004, captured: ["Geo"] },
    { q: "What's your home type?", shown: 392_004, answered: 348_220 },
    { q: "What's your name?", shown: 348_220, answered: 312_881, captured: ["First name", "Last name"] },
    { q: "What's your email?", shown: 312_881, answered: 248_004, captured: ["Email"] },
    { q: "What's your phone number?", shown: 248_004, answered: 184_412, captured: ["Phone"] },
    { q: "When are you looking to start?", shown: 184_412, answered: 142_318 },
  ],
  qz_002: [
    { q: "What's your zip code?", shown: 248_991, answered: 232_004, captured: ["Geo"] },
    { q: "Roof age (years)?", shown: 232_004, answered: 198_220 },
    { q: "Square footage?", shown: 198_220, answered: 152_881 },
    { q: "What's your name?", shown: 152_881, answered: 128_004, captured: ["First name", "Last name"] },
    { q: "Email?", shown: 128_004, answered: 96_412, captured: ["Email"] },
    { q: "Phone?", shown: 96_412, answered: 84_220, captured: ["Phone"] },
  ],
  qz_003: [
    { q: "Vehicle year?", shown: 184_412, answered: 168_881 },
    { q: "Vehicle make?", shown: 168_881, answered: 148_220 },
    { q: "Driver name?", shown: 148_220, answered: 102_881, captured: ["First name", "Last name"] },
    { q: "Email?", shown: 102_881, answered: 64_004, captured: ["Email"] },
    { q: "Phone?", shown: 64_004, answered: 38_812, captured: ["Phone"] },
  ],
};

function Forms() {
  const [quizId, setQuizId] = useState(QUIZZES[0].id);
  const quiz = QUIZZES.find((q) => q.id === quizId)!;
  const questions = QUESTIONS_BY_QUIZ[quizId];
  const completion = ((quiz.completed / quiz.started) * 100).toFixed(1);
  const dropoff = (100 - parseFloat(completion)).toFixed(1);
  const biggestDrop = questions
    .map((q) => ({ q: q.q, drop: 100 - (q.answered / q.shown) * 100 }))
    .sort((a, b) => b.drop - a.drop)[0];

  return (
    <div className="pb-10">
      <PageHeader
        title="Form Analytics"
        subtitle="Question-by-question completion, plus identity captured outside the question flow."
        actions={
          <div className="flex rounded-md border border-border bg-card p-0.5 text-xs">
            {QUIZZES.map((q) => (
              <button
                key={q.id}
                onClick={() => setQuizId(q.id)}
                className={cn("rounded px-2.5 py-1", quizId === q.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60")}
              >
                {q.name}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-6 lg:grid-cols-4">
        {[
          { icon: ClipboardList, label: "Started", value: quiz.started.toLocaleString() },
          { icon: FormInput, label: "Completed", value: quiz.completed.toLocaleString() },
          { icon: Eye, label: "Completion rate", value: `${completion}%` },
          { icon: TrendingDown, label: "Total drop-off", value: `${dropoff}%`, sub: `worst: ${biggestDrop.q}` },
        ].map((k) => {
          const I = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><I className="h-3.5 w-3.5" /><span className="uppercase tracking-wider">{k.label}</span></div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</div>
              {k.sub && <div className="line-clamp-1 text-xs text-muted-foreground">{k.sub}</div>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 px-6 pt-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">{quiz.name} — by question</div>
          <div className="space-y-2 p-4">
            {questions.map((q, i) => {
              const c = (q.answered / q.shown) * 100;
              const drop = 100 - c;
              return (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">{i + 1}. {q.q}</div>
                    <div className="font-mono text-xs text-muted-foreground">{q.answered.toLocaleString()} / {q.shown.toLocaleString()}</div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-success" style={{ width: `${c}%` }} /></div>
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-success">{c.toFixed(1)}% completed</span>
                    <span className="text-destructive">−{drop.toFixed(1)}% drop</span>
                  </div>
                  {q.captured && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {q.captured.map((c) => (
                        <span key={c} className="rounded border border-info/30 bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info">captured {c}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Captured outside questions</h3>
          <p className="mt-1 text-xs text-muted-foreground">Signals captured passively during the session — even when the user abandons.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              { k: "Partial email typed", v: "84,121" },
              { k: "Phone typed (not submitted)", v: "32,004" },
              { k: "Address autocomplete", v: "184,412" },
              { k: "Geolocation detected", v: "402,881" },
              { k: "Cookie linked to known person", v: "248,991" },
              { k: "Mobile Ad ID matched", v: "62,418" },
            ].map((row) => (
              <li key={row.k} className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                <span className="text-xs">{row.k}</span>
                <span className="font-mono text-xs">{row.v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
