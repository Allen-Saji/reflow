import React, { useContext } from "react";
import {
  ReactFlow,
  Background,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { EvidencePath } from "../domain/model";
import { Context } from "./context";
import { useTheme } from "./theme";
import "@xyflow/react/dist/style.css";

export default function GraphPath({ paths }: { paths: EvidencePath[] }) {
  const { state, inspect } = useContext(Context);
  const { theme } = useTheme();
  const edgeColor = theme === "light" ? "#8b623e" : "#a78b71";
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
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
    style: { stroke: edgeColor, strokeWidth: 1.5 },
  }));
  return (
    <div className="path-view">
      <div className="path-graph" aria-label="Graph evidence path">
        <ReactFlow
          colorMode={theme}
          style={{ background: "transparent" }}
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
          <Background color="var(--dots)" gap={32} />
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
