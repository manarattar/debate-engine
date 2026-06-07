import { useCallback, useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { getGraphData } from "../api";

function buildDomainDegree(links) {
  const counts = {};
  for (const link of links) {
    const src = typeof link.source === "object" ? link.source.id : link.source;
    counts[src] = (counts[src] || 0) + 1;
  }
  return counts;
}

const DOMAIN_COLORS = {
  Technology: "#7c3aed",
  Politics: "#d97706",
  Society: "#059669",
  Health: "#e11d48",
  Business: "#0891b2",
  "Energy & Climate": "#ea580c",
  "Arts & Media": "#db2777",
  Sports: "#16a34a",
  "Philosophy & Ethics": "#9333ea",
  Science: "#0e7490",
};

// Palette for dynamically discovered domains
const DYNAMIC_PALETTE = [
  "#b45309", "#be185d", "#1d4ed8", "#065f46", "#7e22ce",
  "#b91c1c", "#0369a1", "#15803d", "#c2410c", "#6d28d9",
];

function domainOffset(domain) {
  return domain.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function getColor(domain) {
  if (DOMAIN_COLORS[domain]) return DOMAIN_COLORS[domain];
  // Deterministic color for dynamically discovered domains
  const idx = domainOffset(domain) % DYNAMIC_PALETTE.length;
  return DYNAMIC_PALETTE[idx];
}

function useContainerWidth(ref) {
  const [width, setWidth] = useState(400);
  useEffect(() => {
    const measure = () => {
      if (ref.current) setWidth(ref.current.getBoundingClientRect().width);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export default function DebateKnowledgeGraph({ onDebateSelect }) {
  const [graphData, setGraphData] = useState(null);
  const [domainDegree, setDomainDegree] = useState({});
  const [hoveredNode, setHoveredNode] = useState(null);
  const [visible, setVisible] = useState(false);
  const graphRef = useRef();
  const rafRef = useRef();
  const containerRef = useRef();
  const width = useContainerWidth(containerRef);

  useEffect(() => {
    getGraphData()
      .then((data) => {
        // Compute degree before ForceGraph mutates link objects in-place
        setDomainDegree(buildDomainDegree(data.links));
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
        const degree = domainDegree[node.id] ?? 1;
        const baseR = 10 + Math.min(degree * 2.5, 18); // 10 (1 debate) → 28 (many)
        const pulse = 1 + 0.1 * Math.sin(t * 1.6 + domainOffset(node.domain));
        const r = baseR * pulse;

        // Filled circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // Subtle white ring
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label inside the circle
        ctx.font = "bold 4.5px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(node.label, node.x, node.y);
      } else {
        const isHovered = hoveredNode?.id === node.id;
        const r = isHovered ? 7 : 5;

        // Node dot — colored by domain
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = isHovered ? "#ffffff" : color + "bb";
        ctx.fill();

        // Always-visible short label below the node
        const short =
          (node.label ?? "").length > 24
            ? node.label.slice(0, 24) + "…"
            : (node.label ?? "");
        ctx.font = `${isHovered ? "bold " : ""}3.5px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHovered ? "#e2e8f0" : "#64748b";
        ctx.fillText(short, node.x, node.y + r + 2);

        // Full label tooltip above on hover
        if (isHovered) {
          const full =
            (node.label ?? "").length > 50
              ? node.label.slice(0, 50) + "…"
              : (node.label ?? "");
          const pad = 4;
          ctx.font = "4px sans-serif";
          const tw = ctx.measureText(full).width;
          const bx = node.x - tw / 2 - pad;
          const by = node.y - 22;
          const bw = tw + pad * 2;
          const bh = 12;

          ctx.fillStyle = "#1e1b4b";
          ctx.fillRect(bx, by, bw, bh);

          ctx.fillStyle = "#e2e8f0";
          ctx.textBaseline = "middle";
          ctx.fillText(full, node.x, by + bh / 2);
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
    (n) => n.type === "domain" ? 15 + (domainDegree[n.id] ?? 1) * 4 : 3,
    [domainDegree]
  );

  const data = graphData ?? { nodes: [], links: [] };

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col items-center gap-4 py-8"
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
          className="w-full rounded-2xl border border-slate-800 overflow-hidden"
          style={{ height: 460 }}
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
