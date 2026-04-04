import { useState, useEffect, useRef } from "react";
import type { ClientGameState } from "@catan/shared";

// Pip [x%, y%] positions for each die face
const PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[72, 28], [28, 72]],
  3: [[72, 28], [50, 50], [28, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [28, 50], [28, 78], [72, 22], [72, 50], [72, 78]],
};

function Die({ value, rolling }: { value: number | null; rolling: boolean }) {
  const hasValue = value !== null && value >= 1 && value <= 6;
  return (
    <div
      className={rolling ? "catan-die catan-die--rolling" : "catan-die"}
      style={{
        width: 50,
        height: 50,
        background: hasValue ? "#f8f8f0" : "#1e222a",
        borderRadius: 10,
        border: `2px solid ${hasValue ? "rgba(0,0,0,0.25)" : "#2a2f3a"}`,
        boxShadow: hasValue
          ? "0 4px 10px rgba(0,0,0,0.6), inset 0 1px 3px rgba(255,255,255,0.6)"
          : "0 2px 6px rgba(0,0,0,0.4)",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {hasValue
        ? PIPS[value!].map(([x, y], i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#1a1a2e",
                transform: "translate(-50%, -50%)",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
              }}
            />
          ))
        : (
          <span style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "#444",
          }}>?</span>
        )}
    </div>
  );
}

export function DiceDisplay({ state }: { state: ClientGameState }) {
  const [displayDice, setDisplayDice] = useState<[number, number] | null>(null);
  const [rolling, setRolling] = useState(false);
  const prevKey = useRef<string>("");

  useEffect(() => {
    const key = JSON.stringify(state.dice);
    if (state.dice && key !== prevKey.current) {
      prevKey.current = key;
      setRolling(true);

      // Cycle random values during animation
      const iv = setInterval(() => {
        setDisplayDice([
          (Math.floor(Math.random() * 6) + 1) as number,
          (Math.floor(Math.random() * 6) + 1) as number,
        ]);
      }, 75);

      // Settle on real value after 650 ms
      const t = setTimeout(() => {
        clearInterval(iv);
        setRolling(false);
        setDisplayDice(state.dice);
      }, 650);

      return () => { clearInterval(iv); clearTimeout(t); };
    }
    if (!state.dice) {
      prevKey.current = "";
      setDisplayDice(null);
    }
  }, [state.dice]);

  if (state.phase !== "main") return null;

  const shown = displayDice ?? state.dice;
  const sum = shown ? shown[0] + shown[1] : null;
  const isSeven = sum === 7;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: "8px 0",
    }}>
      <Die value={shown?.[0] ?? null} rolling={rolling} />
      <Die value={shown?.[1] ?? null} rolling={rolling} />
      {sum !== null && (
        <div style={{ marginLeft: 4, textAlign: "center" }}>
          <div style={{
            fontSize: 22,
            fontWeight: "bold",
            color: isSeven ? "#e74c3c" : "#f0c040",
            lineHeight: 1,
          }}>
            = {sum}
          </div>
          {isSeven && (
            <div style={{ fontSize: 10, color: "#e74c3c", marginTop: 2, fontWeight: "bold" }}>
              ROBBER!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
