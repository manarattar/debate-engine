import { useCallback, useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { getGraphData } from "../api";

const DOMAIN_COLORS = {
  Technology: "#7c3aed",
  Politics: "#d97706",
  Society: "#059669",
  Health: "#e11d48",
  Business: "#0891b2",
  "Energy & Climate": "#ea580c",
  "Arts & Media": "#db2777",
  General: "#64748b",
};

function getColor(domain) {
  return DOMAIN_COLORS[domain] ?? DOMAIN_COLORS.General;
}

function useGraphWidth() {
  const [width, setWidth] = useState(() =>
    Math.min(window.innerWidth - 320, 900)
  );
  useEffect(() => {
    const onResize = () => setWidth(Math.min(window.innerWidth - 320, 900));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

export default function DebateKnowledgeGraph({ onDebateSelect }) {
  const [graphData, setGraphData] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [visible, setVisible] = useState(false);
  const graphRef = useRef();
  const rafRef = useRef();
  const width = useGraphWidth();

  useEffect(() => {
    getGraphData()
      .then((data) => {
        setGraphData(data);
        requestAnimationFrame(() => setVisible(true));
      })
      .catch(() => {});
  }, []);

  // Keep canvas repainting so the pulse animation runs after the sim cools down
  useEffect(() => {
    const tick = () => {
      graphRef.current?.refresh?.();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const paintNode = useCallback(
    (node, ctx) => {
      const color = getColor(node.domain);
      const t = Date.now() / 1000;

      if (node.type === "domain") {
        const pulse = 1 + 0.12 * Math.sin(t * 1.8 + (node.__indexColor ?? 0));
        const r = 20 * pulse;

        // Outer glow
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color + "cc";
        ctx.fill();
        ctx.restore();

        // Label below
        ctx.font = "bold 5px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(node.label, node.x, node.y + r + 3);
      } else {
        const isHovered = hoveredNode?.id === node.id;
        const r = isHovered ? 7 : 5;

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = isHovered ? "#ffffff" : "#94a3b8";
        ctx.fill();

        if (isHovered) {
          const raw = node.label ?? "";
          const label = raw.length > 45 ? raw.slice(0, 45) + "…" : raw;
          const pad = 4;
          ctx.font = "4px Inter, sans-serif";
          const tw = ctx.measureText(label).width;
          const bx = node.x - tw / 2 - pad;
          const by = node.y - 20;
          const bw = tw + pad * 2;
          const bh = 12;

          ctx.fillStyle = "#1e1b4bdd";
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 2);
          ctx.fill();

          ctx.fillStyle = "#e2e8f0";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, node.x, by + bh / 2);
        }
      }
    },
    [hoveredNode]
  );

  const linkColor = useCallback(
    (link) => {
      const srcId = typeof link.source === "object" ? link.source.id : link.source;
      const src = graphData?.nodes.find((n) => n.id === srcId);
      return getColor(src?.domain) + "4d";
    },
    [graphData]
  );

  const handleNodeHover = useCallback(
    (node) => {
      setHoveredNode(node);
      const canvas = graphRef.current?.canvas?.();
      if (canvas) {
        canvas.style.cursor = node?.type === "topic" ? "pointer" : "default";
      }
    },
    []
  );

  const handleNodeClick = useCallback(
    (node) => {
      if (node.type === "topic" && node.debate_id) {
        onDebateSelect(node.debate_id);
      }
    },
    [onDebateSelect]
  );

  const nodeVal = useCallback(
    (n) => (n.type === "domain" ? 40 : 3),
    []
  );

  const data = graphData ?? { nodes: [], links: [] };

  return (
    <div
      className="w-full flex flex-col items-center gap-4 py-8 px-4"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.8s ease" }}
    >
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">
          Explore the Debate Universe
        </h2>
        {graphData && (
          <p className="text-slate-500 text-sm mt-1">
            {graphData.debate_count} debate
            {graphData.debate_count !== 1 ? "s" : ""} across{" "}
            {graphData.domain_count} domain
            {graphData.domain_count !== 1 ? "s" : ""} — click any topic to
            explore
          </p>
        )}
      </div>

      {!graphData && (
        <div className="text-slate-600 text-sm py-12 animate-pulse">
          Loading graph…
        </div>
      )}

      {graphData?.debate_count === 0 && (
        <div className="text-slate-600 text-sm py-12">
          No debates yet — start one above!
        </div>
      )}

      {graphData && graphData.debate_count > 0 && (
        <div
          className="rounded-2xl border border-slate-800 overflow-hidden"
          style={{ width, height: 460 }}
        >
          <ForceGraph2D
            ref={graphRef}
            graphData={data}
            width={width}
            height={460}
            backgroundColor="#0a0a0f"
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => "replace"}
            nodeVal={nodeVal}
            linkColor={linkColor}
            linkWidth={0.8}
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
            cooldownTicks={120}
            d3AlphaDecay={0.04}
            d3VelocityDecay={0.4}
            nodeId="id"
            linkSource="source"
            linkTarget="target"
          />
        </div>
      )}
    </div>
  );
}
