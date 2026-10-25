import { useState, useRef, useEffect } from "react";
import "./App.css";

const API = "http://localhost:5000";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("hinglish");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user", text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(API + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, language }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : data.error;
      setMessages([...newMessages, { role: "model", text: reply }]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "model", text: "Backend se connect nahi hua. Server chal raha hai?" },
      ]);
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          Parakh <span>AI</span>
        </div>
        <button className="new-chat" onClick={() => setMessages([])}>
          + New chat
        </button>

        <h4>Tools</h4>
        <button className="soon" disabled>Offer Check (jaldi)</button>
        <button className="soon" disabled>Path Compare (jaldi)</button>
        <button className="soon" disabled>Skill Radar (jaldi)</button>

        <h4>Language</h4>
        <button
          className={language === "hinglish" ? "active" : ""}
          onClick={() => setLanguage("hinglish")}
        >
          Hinglish
        </button>
        <button
          className={language === "english" ? "active" : ""}
          onClick={() => setLanguage("english")}
        >
          English
        </button>
      </aside>

      <main className="main">
        <div className="messages">
          <div className="chat-width">
            {messages.length === 0 && (
              <div className="welcome">
                <h1>Namaste! Main Parakh AI hoon</h1>
                <p>Offer ho ya raasta, pehle parakh lo. Kuch bhi poochho.</p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={"msg " + m.role}>
                <div className="bubble">{m.text}</div>
              </div>
            ))}

            {loading && (
              <div className="msg model">
                <div className="bubble">Soch raha hoon...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="input-area">
          <div className="input-box">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Apna sawaal likho..."
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}>
              Bhejo
            </button>
          </div>
          <p className="note">
            AI guide hai, guarantee nahi. Company verify karo, job ke liye kabhi paisa mat do.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;