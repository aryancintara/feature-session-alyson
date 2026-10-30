// React Flow graph canvas — visual-first: circular nodes with labels beneath,
// sparse edges, hover-only labels, in-canvas toolbar overlay.

import { memo, useMemo, useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow, Background, MiniMap, Handle, Position, Panel,
  BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow,
  type Node, type Edge, type NodeProps, type EdgeProps, type NodeMouseHandler, type EdgeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Users, Building2, MapPin, Layers, FileText, Star, AlertTriangle, Fingerprint,
  Mail, Phone, Cookie, Smartphone, Globe, KeySquare, Scale,
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Lock, Unlock,
} from "lucide-react";
import { edgeStyle, SEMANTIC_LABEL, type EdgeSemantic } from "./edgeStyle";

export type NodeKind =
  | "person" | "consolidated" | "individual" | "source"
  | "signal" | "household" | "company" | "place" | "legal_case"
  | "golden_record" | "gr_field" | "summary";

export interface GNodeData extends Record<string, unknown> {
  kind: NodeKind;
  label: string;
  sub?: string;
  score?: number;
  hygiene?: string;
  status?: "current" | "historical";
  warning?: boolean;
  selected?: boolean;
  signalKind?: string;
  center?: boolean;
}
export interface GEdgeData extends Record<string, unknown> {
  semantic: EdgeSemantic;
  label: string;
  confidence?: number;
  status?: "current" | "historical";
}

const SIGNAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail, phone: Phone, cookie: Cookie, device: Smartphone,
  maid: Smartphone, ip: Globe, session: KeySquare, click_id: KeySquare,
  domain: Globe, external_id: KeySquare, address: MapPin, caller_id: Phone,
};

// Fill (solid disc), ring (selected), and text tone per node kind.
// Uses direct token colors so discs read as clearly colored circles.
const KIND_COLOR_VAR: Record<NodeKind, string> = {
  person: "var(--primary)",
  consolidated: "var(--chart-2)",
  individual: "var(--chart-4)",
  source: "hsl(215 10% 55%)",
  signal: "var(--info)",
  household: "var(--chart-3)",
  company: "var(--chart-5)",
  place: "var(--info)",
  legal_case: "var(--destructive)",
  golden_record: "var(--warning)",
  gr_field: "var(--warning)",
  summary: "hsl(215 10% 60%)",
};

// Icons only appear inside disc for kinds where a glyph adds meaning.
const KIND_ICON: Partial<Record<NodeKind, React.ComponentType<{ className?: string }>>> = {
  golden_record: Star,
  gr_field: Star,
  consolidated: Layers,
  individual: FileText,
  source: FileText,
  household: Users,
  company: Building2,
  place: MapPin,
  legal_case: Scale,
  signal: Fingerprint,
};

const GNode = memo(function GNode({ data, selected }: NodeProps) {
  const d = data as GNodeData;
  const color = KIND_COLOR_VAR[d.kind];
  const isCenter = Boolean(d.center);
  const Icon =
    d.kind === "signal" && d.signalKind && SIGNAL_ICON[d.signalKind]
      ? SIGNAL_ICON[d.signalKind]
      : KIND_ICON[d.kind];

  const size = isCenter ? 64 : d.kind === "gr_field" ? 36 : 48;

  const initial =
    d.kind === "person" && d.label ? d.label.trim().charAt(0).toUpperCase() : null;

  return (
    <div className="flex flex-col items-center" style={{ minWidth: 120 }}>
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />

      <div className="relative">
        <div
          className={[
            "grid place-items-center rounded-full text-white shadow-sm transition-all",
            selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
            isCenter ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : "",
            d.status === "historical" ? "opacity-50" : "",
          ].join(" ")}
          style={{ width: size, height: size, backgroundColor: color }}
        >
          {Icon ? (
            <Icon className={isCenter ? "h-6 w-6" : "h-5 w-5"} />
          ) : initial ? (
            <span className={isCenter ? "text-lg font-semibold" : "text-base font-semibold"}>{initial}</span>
          ) : null}
        </div>
        {d.warning && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-warning text-warning-foreground shadow">
            <AlertTriangle className="h-2.5 w-2.5" />
          </span>
        )}
      </div>

      <div className="mt-1.5 max-w-[140px] text-center">
        <div className={["truncate text-[11px] font-medium text-foreground", isCenter && "font-semibold"].filter(Boolean).join(" ")}>
          {d.label}
        </div>
        {d.sub && <div className="truncate text-[10px] text-muted-foreground">{d.sub}</div>}
      </div>
    </div>
  );
});

const GEdge = memo(function GEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected,
}: EdgeProps) {
  const d = (data ?? { semantic: "probable", label: "" }) as GEdgeData;
  const style = edgeStyle(d.semantic, d.confidence ?? 70);
  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });
  const [hover, setHover] = useState(false);
  const strokeStyle = {
    ...style,
    strokeWidth: selected || hover ? 2 : 1.25,
    opacity: selected || hover ? 1 : 0.7,
  };
  const showLabel = d.label && (selected || hover);
  return (
    <g onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <BaseEdge id={id} path={path} style={strokeStyle} interactionWidth={20} />
      {/* Always-on faint mid-label for edges in reference style ("resides at", "works at") */}
      {d.label && !showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{ position: "absolute", transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}
            className="pointer-events-none text-[10px] text-muted-foreground"
          >
            {d.label}
          </div>
        </EdgeLabelRenderer>
      )}
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{ position: "absolute", transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}
            className={[
              "pointer-events-none rounded border bg-card/95 px-1.5 py-0.5 text-[10px] font-medium shadow-sm",
              selected ? "border-primary text-primary" : "border-border text-foreground",
            ].join(" ")}
          >
            {d.label}
            {typeof d.confidence === "number" && <span className="ml-1 font-mono text-muted-foreground">{d.confidence}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});

const nodeTypes = { g: GNode };
const edgeTypes = { g: GEdge };

export interface GraphCanvasProps {
  nodes: Node<GNodeData>[];
  edges: Edge<GEdgeData>[];
  selectedId?: string;
  showMiniMap?: boolean;
  showLegend?: boolean;
  onSelectNode?: (id: string, data: GNodeData) => void;
  onSelectEdge?: (id: string, data: GEdgeData) => void;
  onCenterNode?: (id: string, data: GNodeData) => void;
}

function AutoFit({ signature }: { signature: string }) {
  const rf = useReactFlow();
  const last = useRef("");
  useEffect(() => {
    if (last.current === signature) return;
    last.current = signature;
    const t = setTimeout(() => {
      rf.fitView({ padding: 0.25, minZoom: 0.7, maxZoom: 1.2, duration: 300 });
    }, 50);
    return () => clearTimeout(t);
  }, [signature, rf]);
  return null;
}

function CanvasToolbar({ locked, setLocked }: { locked: boolean; setLocked: (v: boolean) => void }) {
  const rf = useReactFlow();
  const btn = "grid h-7 w-7 place-items-center rounded border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors";
  return (
    <Panel position="top-right" className="!m-2 flex items-center gap-1 rounded-md border border-border bg-card p-1 shadow-sm">
      <button className={btn} title="Zoom in" onClick={() => rf.zoomIn({ duration: 200 })}><ZoomIn className="h-3.5 w-3.5" /></button>
      <button className={btn} title="Zoom out" onClick={() => rf.zoomOut({ duration: 200 })}><ZoomOut className="h-3.5 w-3.5" /></button>
      <button className={btn} title="Fit view" onClick={() => rf.fitView({ padding: 0.25, duration: 300 })}><Maximize2 className="h-3.5 w-3.5" /></button>
      <button className={btn} title="Reset zoom" onClick={() => rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 })}><RotateCcw className="h-3.5 w-3.5" /></button>
      <button className={btn} title={locked ? "Unlock layout" : "Lock layout"} onClick={() => setLocked(!locked)}>
        {locked ? <Lock className="h-3.5 w-3.5 text-primary" /> : <Unlock className="h-3.5 w-3.5" />}
      </button>
    </Panel>
  );
}

const LEGEND: { label: string; semantic: EdgeSemantic }[] = [
  { label: "confirmed", semantic: "confirmed" },
  { label: "probable", semantic: "probable" },
  { label: "conflict", semantic: "conflict" },
  { label: "historical", semantic: "historical" },
];

function EdgeLegend() {
  return (
    <Panel position="bottom-left" className="!m-2 rounded-md border border-border bg-card px-2.5 py-1.5 shadow-sm">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Edge semantics</div>
      <div className="flex items-center gap-3">
        {LEGEND.map((l) => {
          const s = edgeStyle(l.semantic, 80);
          return (
            <div key={l.label} className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line x1="0" y1="3" x2="18" y2="3"
                  stroke={s.stroke as string}
                  strokeWidth={2}
                  strokeDasharray={s.strokeDasharray as string | undefined}
                />
              </svg>
              <span className="text-[10px] text-foreground">{l.label}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function GraphCanvas({
  nodes, edges, selectedId, showMiniMap = false, showLegend = true,
  onSelectNode, onSelectEdge, onCenterNode,
}: GraphCanvasProps) {
  const [locked, setLocked] = useState(false);
  const rfNodes = useMemo(
    () => nodes.map((n) => ({
      ...n,
      type: "g" as const,
      selected: n.id === selectedId,
      draggable: !locked,
    })),
    [nodes, selectedId, locked],
  );
  const rfEdges = useMemo(
    () => edges.map((e) => ({ ...e, type: "g" as const })),
    [edges],
  );

  const onNodeClick = useCallback<NodeMouseHandler>((_, n) => {
    onSelectNode?.(n.id, n.data as GNodeData);
  }, [onSelectNode]);
  const onNodeDoubleClick = useCallback<NodeMouseHandler>((_, n) => {
    onCenterNode?.(n.id, n.data as GNodeData);
  }, [onCenterNode]);
  const onEdgeClick = useCallback<EdgeMouseHandler>((_, e) => {
    onSelectEdge?.(e.id, (e.data ?? { semantic: "probable", label: "" }) as GEdgeData);
  }, [onSelectEdge]);

  const signature = `${nodes.length}:${edges.length}:${nodes.map((n) => n.id).join(",").slice(0, 100)}`;

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onEdgeClick={onEdgeClick}
      fitView
      fitViewOptions={{ padding: 0.25, minZoom: 0.7, maxZoom: 1.2 }}
      minZoom={0.4}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
      panOnScroll
      nodesDraggable={!locked}
      nodesConnectable={false}
      elementsSelectable
      selectionOnDrag={false}
    >
      <AutoFit signature={signature} />
      <Background gap={20} size={1} color="hsl(215 15% 92%)" />
      <CanvasToolbar locked={locked} setLocked={setLocked} />
      {showLegend && <EdgeLegend />}
      {showMiniMap && (
        <MiniMap
          position="bottom-right"
          maskColor="hsl(215 20% 95% / 0.6)"
          pannable
          zoomable
          style={{ width: 140, height: 90 }}
          className="!rounded-md !border !border-border !bg-card"
          nodeColor={(n) => {
            const k = (n.data as GNodeData)?.kind;
            if (k === "person") return "var(--primary)";
            if (k === "signal") return "var(--info)";
            if (k === "consolidated") return "var(--chart-2)";
            if (k === "individual") return "var(--chart-4)";
            if (k === "company") return "var(--chart-5)";
            if (k === "household") return "var(--chart-3)";
            if (k === "golden_record") return "var(--warning)";
            return "hsl(215 15% 60%)";
          }}
        />
      )}
    </ReactFlow>
  );
}

export { SEMANTIC_LABEL };
