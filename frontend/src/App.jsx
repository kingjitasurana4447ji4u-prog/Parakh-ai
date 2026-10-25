import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import OfferCheck from "./OfferCheck";
import "./App.css";

const API = "http://localhost:5000";

function App() {
  const [view, setView] = useState("chat");
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("hinglish");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  async function loadConversations() {
    try {
      const res = await fetch(API + "/api/conversations");
      setConversations(await res.json());
    } catch {
      // backend band hai
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function newChat() {
    setView("chat");
    setActiveId(null);
    setMessages([]);
  }

  async function openChat(id) {
    setView("chat");
    setActiveId(id);
    try {
      const res = await fetch(API + "/api/conversations/" + id + "/messages");
      setMessages(await res.json());
    } catch {
      setMessages([]);
    }
  }

  async function deleteChat(id, e) {
    e.stopPropagation();
    await fetch(API + "/api/conversations/" + id, { method: "DELETE" });
    if (id === activeId) newChat();
    loadConversations();
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const shown = [...messages, { role: "user", text }];
    setMessages(shown);
    setInput("");
    setLoading(true);

    try {
      let id = activeId;
      if (!id) {
        const r = await fetch(API + "/api/conversations", { method: "POST" });
        const c = await r.json();
        id = c.id;
        setActiveId(id);
      }
      const res = await fetch(API + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id, message: text, language }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : data.error;
      setMessages([...shown, { role: "model", text: reply }]);
      loadConversations();
    } catch {
      setMessages([
        ...shown,
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
        <button className="new-chat" onClick={newChat}>
          + New chat
        </button>

        <h4>Chats</h4>
        <div className="chat-list">
          {conversations.length === 0 && <p className="empty">Abhi koi chat nahi</p>}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={"chat-item " + (view === "chat" && c.id === activeId ? "current" : "")}
              onClick={() => openChat(c.id)}
            >
              <span>{c.title}</span>
              <button onClick={(e) => deleteChat(c.id, e)}>×</button>
            </div>
          ))}
        </div>

        <h4>Tools</h4>
        <button
          className={view === "offer" ? "active" : ""}
          onClick={() => setView("offer")}
        >
          Offer Check
        </button>
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
        {view === "offer" ? (
          <OfferCheck language={language} />
        ) : (
          <>
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
                    <div className="bubble">
                      {m.role === "model" ? (
                        <ReactMarkdown>{m.text}</ReactMarkdown>
                      ) : (
                        m.text
                      )}
                    </div>
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
          </>
        )}
      </main>
    </div>
  );
}

export default App;