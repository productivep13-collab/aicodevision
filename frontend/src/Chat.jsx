import React, { useState } from "react";

export default function Chat({ chatHistory, setChatHistory }) {
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input) return;
    const updatedHistory = [...chatHistory, { role: "user", content: input }];
    setChatHistory(updatedHistory);

    const res = await fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: updatedHistory }),
    });
    const data = await res.json();
    setChatHistory([...updatedHistory, { role: "assistant", content: data.response }]);
    setInput("");
  };

  return (
    <div className="chat-container">
      <div className="chatMessages">
        {chatHistory.map((msg, i) => (
          <div key={i}><b>{msg.role}:</b> {msg.content}</div>
        ))}
      </div>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
