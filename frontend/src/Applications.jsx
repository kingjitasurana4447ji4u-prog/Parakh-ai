import { useState, useEffect } from "react";
import { API } from "./apiConfig";
const TOKEN_KEY = "parakh_token";
const STATUSES = ["Applied", "Interview", "Offer", "Rejected"];
const COLORS = {
  Applied: "#1e3a8a",
  Interview: "#f97316",
  Offer: "#16a34a",
  Rejected: "#dc2626",
};

// Har request ke saath login token bhejta hai
function authFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  return fetch(API + url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: "Bearer " + token },
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Applications() {
  const [list, setList] = useState([]);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [date, setDate] = useState(today());
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await authFetch("/api/applications");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Kuch gadbad ho gayi.");
        return;
      }
      setList(await res.json());
      setError("");
    } catch {
      setError("Backend se connect nahi hua. Server chal raha hai?");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!company.trim() || !role.trim()) return;
    try {
      const res = await authFetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, appliedDate: date }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Kuch gadbad ho gayi.");
        return;
      }
      setCompany("");
      setRole("");
      setDate(today());
      load();
    } catch {
      setError("Backend se connect nahi hua. Server chal raha hai?");
    }
  }

  async function changeStatus(id, status) {
    await authFetch("/api/applications/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove(id) {
    await authFetch("/api/applications/" + id, { method: "DELETE" });
    load();
  }

  const count = (s) => list.filter((a) => a.status === s).length;
  const shown = filter === "All" ? list : list.filter((a) => a.status === filter);

  return (
    <div className="oc-wrap">
      <div className="oc-inner">
        <h2>My Applications</h2>
        <p className="oc-sub">
          Kahan-kahan apply kiya, sab yahan likho. Status badalte raho: Applied, Interview,
          Offer ya Rejected.
        </p>

        <div className="ap-form">
          <input
            className="pc-input"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={100}
            placeholder="Company ka naam"
          />
          <input
            className="pc-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={100}
            placeholder="Role (jaise: Sales Intern)"
          />
          <input
            className="pc-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button className="oc-go" onClick={add} disabled={!company.trim() || !role.trim()}>
            Add karo
          </button>
        </div>

        {error && <div className="oc-error">{error}</div>}

        <div className="ap-filters">
          <button
            className={filter === "All" ? "on" : ""}
            onClick={() => setFilter("All")}
          >
            Sab ({list.length})
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={filter === s ? "on" : ""}
              style={filter === s ? { background: COLORS[s], borderColor: COLORS[s] } : {}}
              onClick={() => setFilter(s)}
            >
              {s} ({count(s)})
            </button>
          ))}
        </div>

        {shown.length === 0 && (
          <p className="ap-empty">
            {list.length === 0
              ? "Abhi koi application nahi. Upar se pehli add karo."
              : "Is status mein koi application nahi."}
          </p>
        )}

        {shown.map((a) => (
          <div className="ap-item" key={a.id} style={{ borderLeftColor: COLORS[a.status] }}>
            <div className="ap-info">
              <b>{a.company}</b>
              <span>{a.role}</span>
              <small>Apply kiya: {a.appliedDate}</small>
            </div>
            <div className="ap-actions">
              <select
                value={a.status}
                onChange={(e) => changeStatus(a.id, e.target.value)}
                style={{ borderColor: COLORS[a.status], color: COLORS[a.status] }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button className="ap-del" onClick={() => remove(a.id)}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}