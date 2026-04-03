import { useEffect, useState, useCallback } from "react";

const RESOURCES = ["wood", "brick", "wheat", "ore", "sheep"];
const RESOURCE_EMOJI = {
  wood: { emoji: "🌲", label: "Wood" },
  brick: { emoji: "🧱", label: "Brick" },
  wheat: { emoji: "🌾", label: "Wheat" },
  ore: { emoji: "⛰️", label: "Ore" },
  sheep: { emoji: "🐑", label: "Sheep" },
};

function playerTotal(counts) {
  return RESOURCES.reduce((sum, r) => sum + (counts[r] || 0), 0);
}

function useResourceTotals() {
  const [totals, setTotals] = useState({});

  useEffect(() => {
    // Initial load from storage
    chrome.storage.local.get("resourceTotals", (data) => {
      setTotals(data.resourceTotals || {});
    });

    // Live updates — content.js writes to storage on every new message
    const listener = (changes) => {
      if (changes.resourceTotals) {
        setTotals(changes.resourceTotals.newValue || {});
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return totals;
}

function PlayerRow({ player, counts }) {
  const total = playerTotal(counts);
  return (
    <tr>
      <td className="player-col">{player}</td>
      {RESOURCES.map((r) => (
        <td key={r}>{counts[r] || 0}</td>
      ))}
      <td className="total-col">
        <strong>{total}</strong>
      </td>
    </tr>
  );
}

export default function App() {
  const totals = useResourceTotals();

  const players = Object.keys(totals).sort(
    (a, b) => playerTotal(totals[b]) - playerTotal(totals[a])
  );

  const handleReset = useCallback(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: "RESET" });
      } else {
        chrome.storage.local.set({ resourceTotals: {} });
      }
    });
  }, []);

  return (
    <div className="container">
      <header>
        <h1>Resource Tracker</h1>
        <button className="reset-btn" onClick={handleReset}>
          Reset
        </button>
      </header>

      {players.length === 0 ? (
        <p className="no-data">
          No game data yet.
          <br />
          Start a game on colonist.io.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th className="player-col">Player</th>
              {RESOURCES.map((r) => (
                <th key={r} title={RESOURCE_EMOJI[r].label}>
                  {RESOURCE_EMOJI[r].emoji}
                </th>
              ))}
              <th className="total-col">Total</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <PlayerRow key={player} player={player} counts={totals[player]} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
