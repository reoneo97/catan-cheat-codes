import { useNavigate } from "react-router-dom";

const S = {
  page: {
    minHeight: "100vh",
    background: "#0d1117",
    color: "#e0e0e0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "32px 16px 64px",
  } as React.CSSProperties,
  inner: {
    maxWidth: 720,
    margin: "0 auto",
  } as React.CSSProperties,
  h1: {
    fontSize: 32,
    color: "#f0c040",
    marginBottom: 8,
    fontWeight: 700,
  } as React.CSSProperties,
  subtitle: {
    color: "#888",
    fontSize: 15,
    marginBottom: 36,
  } as React.CSSProperties,
  section: {
    marginBottom: 36,
    borderLeft: "3px solid #30363d",
    paddingLeft: 18,
  } as React.CSSProperties,
  h2: {
    fontSize: 18,
    fontWeight: 700,
    color: "#f0c040",
    marginBottom: 12,
  } as React.CSSProperties,
  p: {
    fontSize: 14,
    lineHeight: 1.65,
    color: "#ccc",
    marginBottom: 10,
  } as React.CSSProperties,
  card: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 8,
    padding: "12px 14px",
    marginBottom: 10,
  } as React.CSSProperties,
  cardTitle: {
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 4,
  } as React.CSSProperties,
  cardBody: {
    fontSize: 13,
    color: "#aaa",
    lineHeight: 1.55,
  } as React.CSSProperties,
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
    marginBottom: 4,
  } as React.CSSProperties,
  th: {
    textAlign: "left" as const,
    color: "#888",
    fontWeight: 600,
    paddingBottom: 6,
    borderBottom: "1px solid #30363d",
  } as React.CSSProperties,
  td: {
    padding: "7px 0",
    borderBottom: "1px solid #1e2530",
    color: "#ccc",
    verticalAlign: "top" as const,
  } as React.CSSProperties,
  pill: (color: string) => ({
    display: "inline-block",
    background: color,
    borderRadius: 4,
    padding: "2px 7px",
    fontSize: 12,
    fontWeight: 600,
    color: "#fff",
    marginRight: 4,
  }) as React.CSSProperties,
  backBtn: {
    background: "#30363d",
    color: "#ccc",
    border: "none",
    borderRadius: 6,
    padding: "8px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 28,
  } as React.CSSProperties,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.section}>
      <div style={S.h2}>{title}</div>
      {children}
    </div>
  );
}

function Card({ emoji, title, color, children }: { emoji: string; title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${color}` }}>
      <div style={{ ...S.cardTitle, color }}>
        {emoji} {title}
      </div>
      <div style={S.cardBody}>{children}</div>
    </div>
  );
}

export function Tutorial() {
  const navigate = useNavigate();
  return (
    <div style={S.page}>
      <div style={S.inner}>
        <button style={S.backBtn} onClick={() => navigate(-1)}>← Back</button>
        <h1 style={S.h1}>How to Play Catan</h1>
        <p style={S.subtitle}>A quick reference for mechanics, dev cards, and strategy tips.</p>

        {/* Goal */}
        <Section title="🏆 Goal">
          <p style={S.p}>
            Be the first player to reach <strong style={{ color: "#f0c040" }}>10 Victory Points (VP)</strong>.
            VP come from settlements (1 VP), cities (2 VP), Longest Road (2 VP),
            Largest Army (2 VP), and Victory Point dev cards (1 VP each).
          </p>
        </Section>

        {/* Resources */}
        <Section title="🌾 Resources">
          <p style={S.p}>There are 5 resource types. Every building and card requires some combination of them.</p>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Resource</th>
                <th style={S.th}>Terrain</th>
                <th style={S.th}>Primary use</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["🌲 Wood",  "Forest",  "Roads, settlements"],
                ["🧱 Brick", "Hills",   "Roads, settlements"],
                ["🌾 Wheat", "Fields",  "Settlements → cities, dev cards"],
                ["🐑 Sheep", "Pasture", "Settlements, dev cards"],
                ["⛰️ Ore",   "Mountains","Cities, dev cards"],
              ].map(([r, t, u]) => (
                <tr key={r}>
                  <td style={S.td}>{r}</td>
                  <td style={{ ...S.td, color: "#888" }}>{t}</td>
                  <td style={{ ...S.td, color: "#888" }}>{u}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Building costs */}
        <Section title="🏗️ Building Costs">
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Building</th>
                <th style={S.th}>Cost</th>
                <th style={S.th}>VP</th>
                <th style={S.th}>Limit</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["🏠 Settlement", "1 Wood + 1 Brick + 1 Wheat + 1 Sheep", "1",  "5"],
                ["🏙️ City",       "2 Wheat + 3 Ore (upgrades settlement)", "2",  "4"],
                ["🛣️ Road",       "1 Wood + 1 Brick",                      "—",  "15"],
                ["🃏 Dev Card",   "1 Wheat + 1 Sheep + 1 Ore",             "varies","—"],
              ].map(([b, c, v, l]) => (
                <tr key={b}>
                  <td style={S.td}>{b}</td>
                  <td style={{ ...S.td, color: "#888", fontSize: 12 }}>{c}</td>
                  <td style={S.td}>{v}</td>
                  <td style={{ ...S.td, color: "#888" }}>{l}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Dice & collection */}
        <Section title="🎲 Dice & Resource Collection">
          <p style={S.p}>
            On your turn, roll two dice. Every player with a settlement or city on a hex
            whose number matches the roll receives resources — <strong>1 per settlement</strong>,{" "}
            <strong>2 per city</strong>. Multiple matching hexes all produce simultaneously.
          </p>
          <p style={S.p}>
            <strong style={{ color: "#e74c3c" }}>6 and 8</strong> are the most likely outcomes
            (5-in-36 each) and are printed in red. The numbers{" "}
            <strong>2</strong> and <strong>12</strong> are rarest (1-in-36 each).
          </p>
          <p style={S.p}>
            Rolling a <strong>7</strong> produces no resources — it triggers the robber instead.
          </p>
        </Section>

        {/* Robber */}
        <Section title="🥷 The Robber">
          <p style={S.p}>Rolling a <strong>7</strong> (or playing a Knight card) activates the robber:</p>
          <ol style={{ paddingLeft: 18, color: "#ccc", fontSize: 14, lineHeight: 2 }}>
            <li>
              <strong>Discard</strong> — any player holding more than 7 cards must discard half (rounded down).
            </li>
            <li>
              <strong>Move</strong> — the active player moves the robber to any land hex (except its current one).
              That hex produces <em>no resources</em> until the robber leaves.
            </li>
            <li>
              <strong>Steal</strong> — optionally steal 1 random resource from any player with a
              settlement or city on the robber's new hex.
            </li>
          </ol>
        </Section>

        {/* Trading */}
        <Section title="🤝 Trading">
          <Card emoji="🏦" title="Bank Trade (4:1)" color="#888">
            Any 4 identical resources → 1 resource of your choice. Always available.
          </Card>
          <Card emoji="⚓" title="Port Trade (3:1 or 2:1)" color="#c8a96e">
            Build a settlement on a port vertex to unlock better rates. Generic ports give 3:1
            for any resource; specific ports give 2:1 for one resource type.
          </Card>
          <Card emoji="🤜🤛" title="Player Trade" color="#2980b9">
            On your turn (after rolling), propose a trade to any other player. Both sides
            must agree. Only the active player can initiate; opponents can accept or reject.
          </Card>
        </Section>

        {/* Dev cards */}
        <Section title="🃏 Development Cards">
          <p style={S.p}>
            Buy a dev card for <strong>1 Wheat + 1 Sheep + 1 Ore</strong>. Draw from the top of a
            shuffled deck. You <em>cannot</em> play a card on the same turn you bought it.
            Only one card may be played per turn (before or after rolling).
          </p>
          <p style={{ ...S.p, color: "#888", fontSize: 13 }}>
            Deck composition: 14 Knights · 5 VP cards · 2 Road Building · 2 Year of Plenty · 2 Monopoly
          </p>

          <Card emoji="⚔️" title="Knight (×14)" color="#7c3aed">
            Move the robber to any hex (same rules as rolling a 7 — discard applies, steal
            from an adjacent player). <strong>Largest Army</strong> goes to the first player
            to play 3 Knights, worth 2 VP. It can be stolen by playing more.
          </Card>
          <Card emoji="🛤️" title="Road Building (×2)" color="#2980b9">
            Place 2 roads for free anywhere you could legally build them. Powerful for
            racing toward <strong>Longest Road</strong> (5+ connected roads = 2 VP).
          </Card>
          <Card emoji="✨" title="Year of Plenty (×2)" color="#f0c040">
            Take any 2 resources of your choice directly from the bank. Great for completing
            a build you're one resource short on.
          </Card>
          <Card emoji="🎭" title="Monopoly (×2)" color="#e67e22">
            Name one resource type — every other player must hand you <em>all</em> of that
            resource. Devastating if well-timed; use when others are stockpiling.
          </Card>
          <Card emoji="🏅" title="Victory Point (×5)" color="#27ae60">
            Worth 1 VP. Kept secret in your hand until you win (you may reveal them at any
            time). Counts toward your total immediately on purchase.
          </Card>
        </Section>

        {/* Longest road / largest army */}
        <Section title="🏅 Special Awards">
          <Card emoji="🛣️" title="Longest Road — 2 VP" color="#0369a1">
            Awarded to the first player with a continuous road of <strong>5+ segments</strong>.
            Opponents can steal it by building a longer road. If a player's road is broken
            by an opponent's settlement, the award may pass to the next longest road of 5+.
          </Card>
          <Card emoji="⚔️" title="Largest Army — 2 VP" color="#7c3aed">
            Awarded to the first player to play <strong>3+ Knight cards</strong>.
            Opponents steal it by playing more Knights total.
          </Card>
        </Section>

        {/* Setup */}
        <Section title="🏁 Setup (Snake Draft)">
          <p style={S.p}>
            Players take turns placing an initial settlement + road in order, then reverse order
            for a second settlement + road. The <strong>second settlement</strong> earns free
            resources — one from each adjacent hex.
          </p>
          <p style={S.p}>
            First player advantage is offset by going last in the second round (choosing the
            best remaining spot) and receiving free resources from up to 3 hexes.
          </p>
        </Section>

        {/* Number rule */}
        <Section title="🎯 Board Fairness">
          <p style={S.p}>
            This implementation enforces two placement rules when generating the board:
          </p>
          <ul style={{ paddingLeft: 18, color: "#ccc", fontSize: 14, lineHeight: 2 }}>
            <li><strong style={{ color: "#e74c3c" }}>No adjacent 6s or 8s</strong> — red numbers must not touch each other.</li>
            <li><strong>No adjacent 2s or 12s</strong> — rare numbers must not stack next to each other.</li>
          </ul>
          <p style={{ ...S.p, color: "#888", fontSize: 13 }}>
            These are standard fair-play constraints not in the base rulebook but enforced
            by virtually every digital Catan implementation.
          </p>
        </Section>

        <button style={S.backBtn} onClick={() => navigate(-1)}>← Back to lobby</button>
      </div>
    </div>
  );
}
