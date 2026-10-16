import React, { useContext, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ReactFlow,
  Background,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import { ArrowUpRight, X, ChevronRight } from "lucide-react";

import { Source, EvidencePath } from "../domain/model";
import { Context } from "./context";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link className={"logo " + (small ? "small" : "")} to="/">
      <span className="mark">
        <i />
        <i />
        <i />
      </span>
      <span>
        reflow
        <sup> / </sup>
      </span>
    </Link>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={"badge " + tone}>
      <span className="dot" />
      {children}
    </span>
  );
}
export function Button({
  children,
  onClick,
  disabled = false,
  kind = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={"button " + kind}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function EvidenceDrawer({
  sources,
  onClose,
}: {
  sources: Source[];
  onClose: () => void;
}) {
  const focus = useModalFocus(true, onClose);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="evidence-drawer"
        ref={focus}
        tabIndex={-1}
        aria-label="Source evidence"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <div className="eyebrow">RECORDED FACTS</div>
            <h2>Source evidence</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close evidence"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <p className="subtle">
          Imported source records used by this investigation.
        </p>
        {sources.length ? (
          sources.map((s) => (
            <article className="source-card" key={s.id}>
              <div className="mono">
                {s.id} / {s.kind}
              </div>
              <h3>{s.title}</h3>
              <p>{s.detail}</p>
              <footer>Recorded {new Date(s.updatedAt).toLocaleString()}</footer>
            </article>
          ))
        ) : (
          <div className="notice">
            No supporting record was found. This claim needs verification.
          </div>
        )}
      </aside>
    </div>
  );
}
export function OrdersTable() {
  const { state, inspect } = useContext(Context);
  const s = state!.snapshot;
  const plan = state!.plans.filter((p) => p.status === "verified").at(-1);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer order</th>
            <th>Product</th>
            <th>Units</th>
            <th>Due</th>
            <th>Planning status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {s.orders.map((o) => {
            const a = plan?.allocations.find((a) => a.orderId === o.id),
              affected = state!.impact?.orderIds.includes(o.id);
            return (
              <tr key={o.id}>
                <td>
                  <strong className="mono">{o.id}</strong>
                  <small>{o.customer}</small>
                </td>
                <td>{s.products.find((p) => p.id === o.productId)?.name}</td>
                <td className="mono">{o.quantity}</td>
                <td className="mono">Day {o.dueDay}</td>
                <td>
                  <Badge
                    tone={
                      affected ? (a?.complete ? "green" : "amber") : "neutral"
                    }
                  >
                    {affected
                      ? a?.complete
                        ? "Projected on time"
                        : a
                          ? `${a.shortage} units uncovered`
                          : "At risk"
                      : state!.impact
                        ? "Outside disruption"
                        : "Scheduled"}
                  </Badge>
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => inspect([o.sourceId])}
                  >
                    Source <ArrowUpRight size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function PathView({ paths }: { paths: EvidencePath[] }) {
  const { state, inspect } = useContext(Context);
  const path = paths[0];
  if (!path)
    return (
      <div className="notice">
        No path is recorded for this selection. Review its source evidence and
        modeled scope.
      </div>
    );
  const name = (id: string, fallback: string) => {
    const offer = state!.snapshot.offers.find((o) => o.id === id);
    return offer
      ? (state!.snapshot.suppliers.find((s) => s.id === offer.supplierId)
          ?.name || offer.supplierId) + " quote"
      : fallback;
  };
  const nodes: Node[] = path.ids.map((id, i) => ({
    id,
    position: { x: i * 180, y: 35 },
    data: { label: name(id, path.names[i]) },
    type: "default",
    className: i === 0 ? "origin-node" : "",
  }));
  const edges: Edge[] = nodes.slice(1).map((n, i) => ({
    id: "edge" + i,
    source: nodes[i].id,
    target: n.id,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#3f6856" },
    style: { stroke: "#3f6856", strokeWidth: 1.5 },
  }));
  return (
    <div className="path-view">
      <div className="path-graph" aria-label="Graph evidence path">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnScroll={false}
          panOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#dcded4" gap={20} />
        </ReactFlow>
      </div>
      <div className="path-description">
        {path.ids.map((id, i) => (
          <React.Fragment key={id}>
            {i > 0 && <ChevronRight size={13} />}
            <span>{name(id, path.names[i])}</span>
          </React.Fragment>
        ))}
      </div>
      <button className="text-button" onClick={() => inspect(path.sourceIds)}>
        Inspect source records <ArrowUpRight size={15} />
      </button>
    </div>
  );
}

export function useModalFocus(enabled: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const items = () => [
      ...root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
      ),
    ];
    (items()[0] || root).focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const nodes = items(),
        first = nodes[0],
        last = nodes.at(-1);
      if (!first) {
        event.preventDefault();
        root.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === root)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [enabled]);
  return ref;
}
