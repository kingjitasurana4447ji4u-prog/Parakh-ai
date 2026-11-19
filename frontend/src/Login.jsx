import { useState } from "react";
import "./Login.css";

const API = "http://localhost:5000";

function Login({ onLogin }) {
  const [mode, setMode] = useState("login"); // login ya signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const url = mode === "signup" ? "/api/signup" : "/api/login";
      const body =
        mode === "signup" ? { name, email, password } : { email, password };
      const res = await fetch(API + url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kuch galat hua.");
      } else {
        onLogin(data.token, data.user);
      }
    } catch {
      setError("Backend se connect nahi hua. Server chal raha hai?");
    }
    setBusy(false);
  }

  function handleKey(e) {
    if (e.key === "Enter") submit();
  }

  return (
    <div className="lg-page">
      <div className="lg-card">
        <h1>
          Parakh <span>AI</span>
        </h1>
        <p className="lg-tag">Offer ho ya raasta, pehle parakh lo.</p>

        <h2>{mode === "signup" ? "Naya account banao" : "Login karo"}</h2>

        {mode === "signup" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Tumhara naam"
            maxLength={100}
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Email"
          maxLength={200}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Password (kam se kam 6 akshar)"
          maxLength={200}
        />

        {error && <p className="lg-error">{error}</p>}

        <button className="lg-btn" onClick={submit} disabled={busy}>
          {busy ? "Ruko..." : mode === "signup" ? "Account banao" : "Login"}
        </button>

        <p className="lg-switch">
          {mode === "signup" ? "Account pehle se hai?" : "Naye ho?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
            }}
          >
            {mode === "signup" ? "Login karo" : "Account banao"}
          </button>
        </p>

        <p className="lg-note">
          AI guide hai, guarantee nahi. Company verify karo, job ke liye kabhi paisa mat do.
        </p>
      </div>
    </div>
  );
}

export default Login;