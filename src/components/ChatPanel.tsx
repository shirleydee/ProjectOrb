import { useState, useEffect } from "react";

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (window.orb) {
      window.orb.onToggleChat(() => {
        setIsOpen((prev) => !prev);
      });
    }
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", text: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText: input,
          requestType: "explain"
        })
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        userMsg,
        { role: "assistant", text: data.explanation || "No response" }
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Error contacting LLM API." }
      ]);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: isOpen ? 0 : "-400px",
        width: "400px",
        height: "100%",
        background: "#fff",
        borderLeft: "1px solid #ccc",
        transition: "right 0.3s ease",
        display: "flex",
        flexDirection: "column",
        zIndex: 999999
      }}
    >
      <div
        style={{
          padding: "10px",
          borderBottom: "1px solid #ccc",
          background: "#f5f5f5",
          fontWeight: "bold"
        }}
      >
        Quick Chat
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px"
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: "10px",
              textAlign: msg.role === "user" ? "right" : "left"
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "6px 10px",
                borderRadius: "6px",
                background: msg.role === "user" ? "#d1e7ff" : "#f0f0f0"
              }}
            >
              {msg.text}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #ccc"
        }}
      >
        <input
          style={{
            flex: 1,
            padding: "8px",
            border: "none",
            outline: "none"
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: "8px 12px",
            background: "purple",
            color: "white",
            border: "none",
            cursor: "pointer"
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
