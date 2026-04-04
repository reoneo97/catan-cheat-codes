import { useEffect, useRef, useState } from "react";
import { subscribeFlight, type ResourceFlight } from "../flightBus.js";

function FlyingParticle({ flight, onDone }: { flight: ResourceFlight; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const { fromX, fromY, toX, toY } = flight;
    // Arc control point: peaks above both endpoints so the path curves up then down
    const ctrlX = fromX + (toX - fromX) * 0.35;
    const ctrlY = Math.min(fromY, toY) - 80;

    const anim = el.animate(
      [
        { transform: "translate(0px, 0px) scale(0.5)", opacity: 0, offset: 0 },
        {
          transform: `translate(${ctrlX - fromX}px, ${ctrlY - fromY}px) scale(1.3)`,
          opacity: 1,
          offset: 0.3,
        },
        {
          transform: `translate(${toX - fromX}px, ${toY - fromY}px) scale(0.6)`,
          opacity: 0,
          offset: 1,
        },
      ],
      { duration: 1200, easing: "ease-in-out", fill: "forwards" },
    );

    anim.onfinish = onDone;
    return () => anim.cancel();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: flight.fromX - 14,
        top: flight.fromY - 14,
        width: 28,
        height: 28,
        fontSize: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 9999,
        userSelect: "none",
      }}
    >
      {flight.emoji}
    </div>
  );
}

export function FlyingResourcesOverlay() {
  const [flights, setFlights] = useState<ResourceFlight[]>([]);

  useEffect(() => {
    return subscribeFlight((flight) => {
      setFlights((prev) => [...prev, flight]);
    });
  }, []);

  if (flights.length === 0) return null;

  return (
    <>
      {flights.map((f) => (
        <FlyingParticle
          key={f.id}
          flight={f}
          onDone={() => setFlights((prev) => prev.filter((x) => x.id !== f.id))}
        />
      ))}
    </>
  );
}
