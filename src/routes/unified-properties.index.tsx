import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui-bits";
import { Shimmer, TableSkeleton } from "@/components/identity/skeletons";
import { PipelinePill } from "@/components/properties/PipelinePill";
import {
  fmtPst, formatAddress, humanize, propertyCsv, propertyGet, sourceLabel,
  type EventsResponse, type Facets, type PropertiesResponse, type PropertyRow,
} from "@/lib/unifiedPropertiesApi";

export const Route = createFileRoute("/unified-properties/")({
  head: () => ({ meta: [
    { title: "Unified Properties — Alyson CDP" },
    { name: "description", content: "Property details and listing activity from every source in one catalog." },
    { property: "og:title", content: "Unified Properties — Alyson CDP" },
    { property: "og:description", content: "Property details and listing activity from every source in one catalog." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: UnifiedProperties,
});

const PAGE = 20;
type Filters = { property_source: string; home_status: string; property_type: string; list_price_min: string; list_price_max: string };
const EMPTY: Filters = { property_source: "", home_status: "", property_type: "", list_price_min: "", list_price_max: "" };
const dash = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "number" ? v.toLocaleString() : String(v));
const money = (v: unknown) => (typeof v === "number" ? `$${v.toLocaleString()}` : "—");

function facetValues(f: Facets | undefined, ...keys: string[]): string[] {
  for (const k of keys) {
    const v = f?.[k];
    if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x ? String((x as Record<string, unknown>).value ?? (x as Record<string, unknown>)[k] ?? Object.values(x)[0]) : String(x))).filter(Boolean);
  }
  return [];
}

function UnifiedProperties() {
  const qc = useQueryClient();
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState<PropertyRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const params = { q, ...applied };
  const list = useQuery({ queryKey: ["unified-properties", "list", params, offset], queryFn: () => propertyGet<PropertiesResponse>("/v1/properties", { ...params, limit: PAGE, offset }), retry: 1 });
  const facets = useQuery({ queryKey: ["unified-properties", "facets"], queryFn: () => propertyGet<Facets>("/v1/meta/facets"), retry: 1 });
  const rows = list.data?.items ?? list.data?.properties ?? [];
  const total = list.data?.total ?? 0;
  const activeCount = Object.values(applied).filter(Boolean).length;
  const anyApplied = activeCount > 0 || !!q;

  const search = () => { setQ(qInput.trim()); setOffset(0); };
  const clearAll = () => { setQInput(""); setQ(""); setDraft(EMPTY); setApplied(EMPTY); setOffset(0); };
  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await propertyCsv("/v1/properties", { ...params, limit: 5000 });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "unified-properties.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { toast.error((e as Error).message); } finally { setExporting(false); }
  };

  const selects: [keyof Filters, string, string[], (v: string) => string][] = [
    ["property_source", "Source", facetValues(facets.data, "property_source", "property_sources", "sources"), sourceLabel],
    ["home_status", "Status", facetValues(facets.data, "home_status", "home_statuses"), humanize],
    ["property_type", "Type", facetValues(facets.data, "property_type", "property_types"), humanize],
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Unified Properties"
        subtitle="Property details and listing activity from Homelight, Zillow, RentCast, and Smarty—addresses, facts, prices, and transaction history in one catalog. Open a record to see every source and its event timeline."
        actions={<>
          <PipelinePill />
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["unified-properties"] })}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}><Download className="mr-1.5 h-3.5 w-3.5" />{exporting ? "Exporting…" : "Export CSV"}</Button>
        </>}
      />
      <div className="space-y-3 px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search by address" placeholder="Search by address" className="pl-8" value={qInput} onChange={(e) => setQInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} />
          </div>
          <Button size="sm" onClick={search}>Search</Button>
          <Button size="sm" variant="outline" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />Filters
            {activeCount > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeCount}</span>}
          </Button>
          {anyApplied && <Button size="sm" variant="ghost" onClick={clearAll}><X className="mr-1 h-3.5 w-3.5" />Clear</Button>}
        </div>

        {showFilters && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {selects.map(([key, label, opts, fmt]) => (
                <label key={key} className="text-xs text-muted-foreground">{label}
                  <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}>
                    <option value="">All</option>
                    {opts.map((o) => <option key={o} value={o}>{fmt(o)}</option>)}
                  </select>
                </label>
              ))}
              <label className="text-xs text-muted-foreground">Min price
                <Input type="number" min={0} className="mt-1" value={draft.list_price_min} onChange={(e) => setDraft({ ...draft, list_price_min: e.target.value })} />
              </label>
              <label className="text-xs text-muted-foreground">Max price
                <Input type="number" min={0} className="mt-1" value={draft.list_price_max} onChange={(e) => setDraft({ ...draft, list_price_max: e.target.value })} />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => { setApplied(draft); setOffset(0); }}>Apply filters</Button>
              <Button size="sm" variant="outline" onClick={() => { setDraft(EMPTY); setApplied(EMPTY); setOffset(0); }}>Reset</Button>
            </div>
          </div>
        )}

        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Property records</h3>
            <p className="text-xs text-muted-foreground">{list.isLoading ? "Loading…" : `${total.toLocaleString()} matching records`}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["Address", "Source", "Status", "Type", "Beds/Baths", "List price", "Observed (PST)"].map((h, i) => <th key={h} className={`whitespace-nowrap px-4 py-2 font-medium ${i === 5 ? "text-right" : "text-left"}`}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.isLoading ? <TableSkeleton cols={7} /> : list.isError ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-destructive" role="alert">{(list.error as Error).message}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No properties match these filters.</td></tr>
                ) : rows.map((r) => (
                  <tr key={`${r.property_id}-${r.property_source}`} tabIndex={0} role="button" aria-label={`Open ${formatAddress(r)} from ${sourceLabel(r.property_source)}`}
                    className="cursor-pointer hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
                    onClick={() => setOpen(r)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(r); } }}>
                    <td className="border-t border-border px-4 py-2.5"><div className="max-w-[320px] truncate font-medium" title={formatAddress(r)}>{formatAddress(r)}</div><div className="font-mono text-[11px] text-muted-foreground">{r.property_id}</div></td>
                    <td className="border-t border-border px-4 py-2.5">{sourceLabel(r.property_source)}</td>
                    <td className="border-t border-border px-4 py-2.5">{humanize(r.home_status)}</td>
                    <td className="border-t border-border px-4 py-2.5">{humanize(r.property_type)}</td>
                    <td className="border-t border-border px-4 py-2.5 tabular-nums">{dash(r.bedrooms)} / {dash(r.bathrooms)}</td>
                    <td className="border-t border-border px-4 py-2.5 text-right tabular-nums">{money(r.list_price)}</td>
                    <td className="whitespace-nowrap border-t border-border px-4 py-2.5 text-xs">{fmtPst(r.observed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > PAGE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              <span>{offset + 1}–{Math.min(offset + PAGE, total)} of {total.toLocaleString()}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
                <Button size="sm" variant="outline" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Next</Button>
              </div>
            </div>
          )}
        </section>
      </div>
      <PropertyDrawer row={open} close={() => setOpen(null)} />
    </div>
  );
}

const SECTIONS: [string, [string, string][]][] = [
  ["Identity", [["Property ID", "property_id"], ["Property source", "property_source"], ["Source record ID", "source_record_id"], ["Source property ID", "source_property_id"], ["Observed at (PST)", "observed_at"], ["Updated at (PST)", "updated_at"]]],
  ["Address", [["Address", "address"], ["Street", "address_line_1"], ["Unit", "address_line_2"], ["City", "city"], ["State", "state"], ["ZIP", "zip"], ["County", "county"], ["Country", "country"], ["Latitude", "latitude"], ["Longitude", "longitude"], ["Parcel ID", "parcel_id"], ["FIPS code", "fips_code"]]],
  ["Facts", [["Property type", "property_type"], ["Property subtype", "property_sub_type"], ["Home status", "home_status"], ["Bedrooms", "bedrooms"], ["Bathrooms", "bathrooms"], ["Full bathrooms", "full_bathrooms"], ["Half bathrooms", "half_bathrooms"], ["Living area (sqft)", "living_area_sqft"], ["Lot size (sqft)", "lot_size_sqft"], ["Lot size (acres)", "lot_size_acres"], ["Year built", "year_built"], ["Effective year built", "effective_year_built"], ["Stories", "stories"], ["Total rooms", "total_rooms"], ["Units", "units"], ["Days on market", "days_on_market"], ["HOA fee", "hoa_fee"]]],
  ["Valuation", [["List price", "list_price"], ["Zestimate", "zestimate"], ["Rent zestimate", "rent_zestimate"], ["Tax assessed value", "tax_assessed_value"], ["Market value", "market_value"], ["Assessed land value", "assessed_land_value"], ["Assessed improvement value", "assessed_improvement_value"], ["Last sold price", "last_sold_price"], ["Last sold date", "last_sold_date"]]],
  ["Ownership", [["Owner names", "owner_names"], ["Owner type", "owner_type"], ["Owner occupied", "owner_occupied"], ["Owner mailing address", "owner_mailing_address"]]],
  ["Listing", [["Property URL", "property_url"], ["Virtual tour URL", "virtual_tour_url"], ["Listing agent", "listing_agent"], ["Listing broker", "listing_broker"], ["Description", "description"]]],
  ["Media & features", [["Image URLs", "image_urls"], ["Interior features", "interior_features"], ["Exterior features", "exterior_features"], ["Features", "features"], ["Nearby schools", "nearby_schools"], ["Comparable sales", "comparable_sales"]]],
  ["History & attributes", [["Price history (raw)", "price_history"], ["Tax history (raw)", "tax_history"], ["Custom attributes", "custom_attributes"]]],
];
const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);
function parse(v: unknown): unknown {
  if (typeof v === "string" && /^\s*[[{]/.test(v)) { try { return JSON.parse(v); } catch { return v; } }
  return v;
}
function Value({ k, v }: { k: string; v: unknown }) {
  const val = parse(v);
  if (typeof val === "boolean") return <>{val ? "Yes" : "No"}</>;
  if (typeof val === "number") return <>{k.includes("price") || k.includes("value") || k.includes("zestimate") || k === "hoa_fee" ? `$${val.toLocaleString()}` : val.toLocaleString()}</>;
  if (typeof val === "object" && val !== null) return <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-muted p-2 text-left font-mono text-[11px]">{JSON.stringify(val, null, 2)}</pre>;
  const s = String(val);
  if (k === "observed_at" || k === "updated_at") return <>{fmtPst(s)}</>;
  if (k === "property_source") return <>{sourceLabel(s)}</>;
  if (/^https:\/\//.test(s)) return <a href={s} target="_blank" rel="noreferrer" className="break-all text-primary underline">{s}</a>;
  return <>{s}</>;
}

function PropertyDrawer({ row, close }: { row: PropertyRow | null; close: () => void }) {
  const id = row?.property_id ?? "";
  const src = row?.property_source ?? "";
  const enc = encodeURIComponent(id);
  const detail = useQuery({ queryKey: ["unified-properties", "detail", id, src], queryFn: () => propertyGet<{ property: Record<string, unknown> }>(`/v1/properties/${enc}`, { property_source: src }), enabled: !!row, retry: 1 });
  const sources = useQuery({ queryKey: ["unified-properties", "sources", id], queryFn: () => propertyGet<{ items: PropertyRow[] }>(`/v1/properties/${enc}/sources`), enabled: !!row, retry: 1 });
  const events = useQuery({ queryKey: ["unified-properties", "events", id], queryFn: () => propertyGet<EventsResponse>(`/v1/properties/${enc}/events`, { limit: 200 }), enabled: !!row, retry: 1 });
  const evList = events.data?.items ?? events.data?.events ?? [];
  const evBadge = events.data ? `${events.data.total ?? evList.length}${events.data.truncated ? "+" : ""}` : "…";
  const srcList = sources.data?.items ?? [];
  const p = detail.data?.property;

  return (
    <Sheet open={!!row} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{row ? formatAddress(row) : "Property"}</SheetTitle>
          <SheetDescription className="break-all">{id} · {sourceLabel(src)}</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="summary" className="mt-4">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="sources">Sources ({sources.data ? srcList.length : "…"})</TabsTrigger>
            <TabsTrigger value="events">Events ({evBadge})</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            {detail.isLoading ? <Rows /> : detail.isError ? <p role="alert" className="mt-4 text-sm text-destructive">{(detail.error as Error).message}</p> : p ? SECTIONS.map(([title, fields]) => {
              const shown = fields.filter(([, k]) => !isEmpty(parse(p[k])));
              if (!shown.length) return null;
              return (
                <section key={title} className="mt-5">
                  <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
                  <dl className="divide-y divide-border border-y border-border text-xs">
                    {shown.map(([label, k]) => <div key={k} className="grid grid-cols-[38%_1fr] gap-3 py-2"><dt className="text-muted-foreground">{label}</dt><dd className="break-words text-right font-medium"><Value k={k} v={p[k]} /></dd></div>)}
                  </dl>
                </section>
              );
            }) : null}
          </TabsContent>
          <TabsContent value="sources">
            {sources.isLoading ? <Rows /> : sources.isError ? <p role="alert" className="mt-4 text-sm text-destructive">{(sources.error as Error).message}</p> : srcList.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No sources for this property.</p> : (
              <ul className="mt-2 divide-y divide-border">{srcList.map((s) => (
                <li key={s.property_source} className="py-3"><div className="text-sm font-medium">{sourceLabel(s.property_source)}</div><div className="text-xs">{formatAddress(s)}</div><div className="text-xs text-muted-foreground">Observed {fmtPst(s.observed_at)}</div></li>
              ))}</ul>
            )}
          </TabsContent>
          <TabsContent value="events">
            {events.isLoading ? <Rows /> : events.isError ? <p role="alert" className="mt-4 text-sm text-destructive">{(events.error as Error).message}</p> : evList.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No events for this property.</p> : (
              <ul className="mt-2 border-l border-border pl-4">{evList.map((e) => (
                <li key={e.event_id} className="border-b border-border py-3">
                  <div className="text-sm font-medium">{humanize(e.event_type)} · {e.event_date ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{sourceLabel(e.event_source)}</div>
                  {([["Source record ID", e.source_record_id], ["Source property ID", e.source_property_id], ["Source listing ID", e.source_listing_id], ["Source MLS ID", e.source_mls_id]] as const).filter(([, v]) => v).map(([l, v]) => (
                    <div key={l} className="text-[11px] text-muted-foreground">{l}: <span className="font-mono">{v}</span></div>
                  ))}
                </li>
              ))}</ul>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
function Rows() {
  return <div className="mt-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex justify-between"><Shimmer className="h-3 w-24" /><Shimmer className="h-3 w-36" /></div>)}</div>;
}
