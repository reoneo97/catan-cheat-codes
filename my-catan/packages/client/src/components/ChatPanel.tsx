import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store.js";

const PLAYER_COLOR: Record<string, string> = {
  red: "#e74c3c", blue: "#2980b9", green: "#27ae60", orange: "#e67e22",
};

export function ChatPanel() {
  const { chatMessages, sendChat } = useGameStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg) return;
    sendChat(msg);
    setInput("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        Chat
      </div>
      <div style={{
        background: "rgba(0,0,0,0.3)",
        borderRadius: 6,
        padding: "6px 8px",
        height: 110,
        overflowY: "auto",
        fontSize: 11,
        fontFamily: "monospace",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}>
        {chatMessages.length === 0 && (
          <span style={{ color: "#444", fontStyle: "italic" }}>No messages yet…</span>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ lineHeight: 1.5 }}>
            <span style={{ color: PLAYER_COLOR[msg.color] ?? "#aaa", fontWeight: 700 }}>
              {msg.name}:
            </span>{" "}
            <span style={{ color: "#ccc" }}>{msg.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something…"
          style={{ flex: 1, fontSize: 12, padding: "4px 8px" }}
          maxLength={200}
        />
        <button
          type="submit"
          style={{ fontSize: 14, padding: "4px 10px", minWidth: "unset", lineHeight: 1 }}
        >
          ↩
        </button>
      </form>
    </div>
  );
}
