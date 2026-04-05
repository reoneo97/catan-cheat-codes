import { useNavigate } from "react-router-dom";

const DEV_CARDS = [
  {
    color: "#7c3aed",
    icon: "🛡️⚔️",
    name: "Knight",
    count: 14,
    desc: "Move the robber, optionally steal 1 resource. Play before or after rolling. 3+ knights = Largest Army (2 VP).",
  },
  {
    color: "#2980b9",
    icon: "🛤️",
    name: "Road Building",
    count: 2,
    desc: "Place 2 roads for free anywhere you could legally build. Useful for racing to Longest Road (5+ roads = 2 VP).",
  },
  {
    color: "#27ae60",
    icon: "+2",
    name: "Year of Plenty",
    count: 2,
    desc: "Take any 2 resources directly from the bank. Great for completing a build you are 1–2 resources short on.",
  },
  {
    color: "#e67e22",
    icon: "↺",
    name: "Monopoly",
    count: 2,
    desc: "Name one resource — every other player hands you all of that resource. Best when others are stockpiling.",
  },
  {
    color: "#f0c040",
    icon: "★",
    name: "Victory Point",
    count: 5,
    desc: "Worth 1 VP. Kept secret until you win. Revealed automatically when you reach 10 VP.",
  },
];

const COSTS = [
  { name: "🏠 Settlement", cost: "1 Wood + 1 Brick + 1 Wheat + 1 Sheep", vp: "1 VP" },
  { name: "🏙️ City",        cost: "3 Ore + 2 Wheat  (upgrades settlement)", vp: "2 VP" },
  { name: "🛣️ Road",        cost: "1 Wood + 1 Brick",                       vp: "—" },
  { name: "🃏 Dev Card",    cost: "1 Ore + 1 Wheat + 1 Sheep",               vp: "varies" },
];

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.75)",
  zIndex: 2000,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 16,
};

const panel: React.CSSProperties = {
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 12,
  padding: "20px 22px",
  maxWidth: 480,
  width: "100%",
  maxHeight: "85vh",
  overflowY: "auto",
  position: "relative",
};

export function HelpModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#f0c040" }}>📖 Quick Reference</span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer", minWidth: "unset", padding: "0 4px", lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Win condition */}
        <p style={{ fontSize: 13, color: "#aaa", marginBottom: 16, lineHeight: 1.55 }}>
          First to <strong style={{ color: "#f0c040" }}>10 Victory Points</strong> wins.
          Roll 7 → move the robber (discard if &gt;7 cards), optionally steal from adjacent player.
        </p>

        {/* Building costs */}
        <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
          Building Costs
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 18 }}>
          <tbody>
            {COSTS.map(({ name, cost, vp }) => (
              <tr key={name} style={{ borderBottom: "1px solid #1e2530" }}>
                <td style={{ padding: "5px 0", color: "#ddd", whiteSpace: "nowrap", paddingRight: 12 }}>{name}</td>
                <td style={{ padding: "5px 0", color: "#888" }}>{cost}</td>
                <td style={{ padding: "5px 0", color: "#f0c040", whiteSpace: "nowrap", paddingLeft: 12 }}>{vp}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Dev cards */}
        <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
          Development Cards
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
          {DEV_CARDS.map(({ color, icon, name, count, desc }) => (
            <div
              key={name}
              style={{
                borderLeft: `3px solid ${color}`,
                background: "#0d1117",
                borderRadius: "0 6px 6px 0",
                padding: "7px 10px",
                display: "flex", gap: 10, alignItems: "flex-start",
              }}
            >
              <span style={{
                fontSize: 13, fontWeight: 700, color,
                minWidth: 22, textAlign: "center", lineHeight: 1.5,
              }}>
                {icon}
              </span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color }}>{name}</span>
                <span style={{ fontSize: 11, color: "#555", marginLeft: 5 }}>×{count} in deck</span>
                <p style={{ fontSize: 12, color: "#999", margin: "3px 0 0", lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Trading reminder */}
        <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
          Trading
        </div>
        <p style={{ fontSize: 12, color: "#999", lineHeight: 1.55, marginBottom: 16 }}>
          <strong style={{ color: "#ccc" }}>Bank 4:1</strong> — any 4 identical resources → 1 of your choice.{" "}
          <strong style={{ color: "#ccc" }}>Port 3:1</strong> — any 3 identical → 1 of your choice.{" "}
          <strong style={{ color: "#ccc" }}>Resource port 2:1</strong> — 2 of that resource → 1 of your choice.{" "}
          <strong style={{ color: "#ccc" }}>Player trade</strong> — propose on your turn, any other player can accept.
        </p>

        {/* Footer link to full tutorial */}
        <button
          onClick={() => { onClose(); navigate("/tutorial"); }}
          style={{
            background: "transparent", color: "#f0c040",
            border: "1px solid #f0c04044", borderRadius: 6,
            padding: "6px 14px", fontSize: 12, cursor: "pointer", width: "100%",
          }}
        >
          View full tutorial →
        </button>
      </div>
    </div>
  );
}
