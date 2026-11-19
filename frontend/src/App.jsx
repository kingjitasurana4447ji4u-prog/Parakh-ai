import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import OfferCheck from "./OfferCheck";
import PathCompare from "./PathCompare";
import SkillRadar from "./SkillRadar";
import Applications from "./Applications";
import Login from "./Login";
import { API } from "./apiConfig";
import "./App.css";
const TOKEN_KEY = "parakh_token";
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ATTACHMENT_TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function getAttachmentMimeType(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  return ATTACHMENT_TYPES[extension] || "";
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("File nahi padha ja saka."));
        return;
      }
      resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("File nahi padha ja saka."));
    reader.readAsDataURL(file);
  });
}

// Har request ke saath login token bhejta hai
function authFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  return fetch(API + url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: "Bearer " + token },
  });
}

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState("chat");
  const [menuOpen, setMenuOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [language, setLanguage] = useState("hinglish");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Page khulte hi dekho ki pehle se login hai ya nahi
  useEffect(() => {
    async function check() {
      if (!localStorage.getItem(TOKEN_KEY)) {
        setChecking(false);
        return;
      }
      try {
        const res = await authFetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        // backend band hai, login page dikhega
      }
      setChecking(false);
    }
    check();
  }, []);

  // Login hote hi apni chats lao
  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function loadConversations() {
    try {
      const res = await authFetch("/api/conversations");
      if (res.ok) setConversations(await res.json());
    } catch {
      // backend band hai
    }
  }

  function handleLogin(token, u) {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
    setView("chat");
  }

  async function logout() {
    try {
      await authFetch("/api/logout", { method: "POST" });
    } catch {
      // koi baat nahi
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setConversations([]);
    setActiveId(null);
    setMessages([]);
    setView("chat");
    setMenuOpen(false);
  }

  function go(v) {
    setView(v);
    setMenuOpen(false);
  }

  function newChat() {
    go("chat");
    setActiveId(null);
    setMessages([]);
    setAttachment(null);
    setAttachmentError("");
  }

  async function openChat(id) {
    go("chat");
    setActiveId(id);
    setAttachment(null);
    setAttachmentError("");
    try {
      const res = await authFetch("/api/conversations/" + id + "/messages");
      setMessages(res.ok ? await res.json() : []);
    } catch {
      setMessages([]);
    }
  }

  async function deleteChat(id, e) {
    e.stopPropagation();
    await authFetch("/api/conversations/" + id, { method: "DELETE" });
    if (id === activeId) newChat();
    loadConversations();
  }

  function handleAttachmentChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAttachment(null);
    if (!getAttachmentMimeType(file)) {
      setAttachmentError("Sirf PDF, JPG, PNG ya WebP file attach karo.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setAttachmentError("File 10 MB se chhoti honi chahiye.");
      return;
    }

    setAttachment(file);
    setAttachmentError("");
  }

  async function sendMessage() {
    const text = input.trim();
    const file = attachment;
    if ((!text && !file) || loading) return;

    const prompt = text || (language === "hinglish"
      ? "Is attached file ko padhkar iska summary aur main points batao."
      : "Read the attached file and summarize its main points.");
    const shownText = file ? `${prompt}\n[Attached: ${file.name}]` : prompt;

    const shown = [...messages, { role: "user", text: shownText }];
    setMessages(shown);
    setInput("");
    setAttachment(null);
    setAttachmentError("");
    setLoading(true);

    try {
      const attachmentData = file ? await readFileAsBase64(file) : undefined;
      let id = activeId;
      if (!id) {
        const r = await authFetch("/api/conversations", { method: "POST" });
        const c = await r.json();
        if (!r.ok) {
          setMessages([...shown, { role: "model", text: c.error || "Kuch galat hua." }]);
          setLoading(false);
          return;
        }
        id = c.id;
        setActiveId(id);
      }
      const res = await authFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: id,
          message: prompt,
          language,
          attachment: file
            ? { name: file.name, mimeType: getAttachmentMimeType(file), data: attachmentData }
            : undefined,
        }),
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

  if (checking) {
    return <p style={{ padding: 20 }}>Ruko...</p>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? "×" : "☰"}
      </button>

      <aside className={"sidebar " + (menuOpen ? "open" : "")}>
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
        <button className={view === "offer" ? "active" : ""} onClick={() => go("offer")}>
          Offer Check
        </button>
        <button className={view === "path" ? "active" : ""} onClick={() => go("path")}>
          Path Compare
        </button>
        <button className={view === "skill" ? "active" : ""} onClick={() => go("skill")}>
          Skill Radar
        </button>
        <button className={view === "apps" ? "active" : ""} onClick={() => go("apps")}>
          My Applications
        </button>

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

        <h4>Account</h4>
        <p className="empty">{user.name}</p>
        <button onClick={logout}>Logout</button>
      </aside>

      <main className="main">
        {view === "offer" && <OfferCheck language={language} />}
        {view === "path" && <PathCompare language={language} />}
        {view === "skill" && <SkillRadar language={language} />}
        {view === "apps" && <Applications />}

        {view === "chat" && (
          <>
            <div className="messages">
              <div className="chat-width">
                {messages.length === 0 && (
                  <div className="welcome">
                    <h1>Namaste {user.name}! Main Parakh AI hoon</h1>
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
              {attachmentError && <p className="attachment-error">{attachmentError}</p>}
              <div className="input-box">
                {attachment && (
                  <div className="attachment-chip">
                    <span className="attachment-type">
                      {attachment.type === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf")
                        ? "PDF"
                        : "IMAGE"}
                    </span>
                    <span className="attachment-name" title={attachment.name}>{attachment.name}</span>
                    <button
                      className="attachment-remove"
                      type="button"
                      aria-label="Remove attachment"
                      onClick={() => setAttachment(null)}
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="input-row">
                  <button
                    className="attachment-add"
                    type="button"
                    aria-label="Attach a PDF or image"
                    title="Attach PDF or image"
                    disabled={loading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    +
                  </button>
                  <input
                    ref={fileInputRef}
                    className="attachment-input"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={handleAttachmentChange}
                  />
                  <textarea
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Apna sawaal likho..."
                  />
                  <button onClick={sendMessage} disabled={loading || (!input.trim() && !attachment)}>
                    Bhejo
                  </button>
                </div>
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