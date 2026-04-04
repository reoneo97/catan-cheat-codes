import { useEffect, useState } from "react";

const TIPS = [
  "No wheat equals defeat",
  "No ore, 7 point score",
  "Beware trading with Irmine",
];

const CYCLE_MS = 3 * 60 * 1000; // 3 minutes

export function TipOfTheDay() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out, swap tip, fade in
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % TIPS.length);
        setVisible(true);
      }, 400);
    }, CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      fontSize: 12,
      color: "#f0c040",
      fontStyle: "italic",
      textAlign: "center",
      padding: "6px 12px",
      borderTop: "1px solid #30363d",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.4s ease",
    }}>
      💡 {TIPS[index]}
    </div>
  );
}
