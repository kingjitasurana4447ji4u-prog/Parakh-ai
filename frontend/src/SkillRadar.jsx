import { useState } from "react";

const API = "http://localhost:5000";

const SAMPLE = "MS Excel, Typing, Python basics, Photoshop, Digital Marketing, Tally, Canva";

const TREND = {
  growing: { label: "Badh rahi hai", color: "#16a34a" },
  stable: { label: "Stable", color: "#f97316" },
  declining: { label: "Ghat rahi hai", color: "#dc2626" },
};

export default function SkillRadar({ language }) {
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function check() {
    if (!skills.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(API + "/api/skill-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills, language }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Kuch gadbad ho gayi.");
      else setResult(data);
    } catch {
      setError("Backend se connect nahi hua. Server chal raha hai?");
    }
    setLoading(false);
  }

  const list = result && Array.isArray(result.skills) ? result.skills : [];
  const count = (t) => list.filter((s) => s.trend === t).length;

  return (
    <div className="oc-wrap">
      <div className="oc-inner">
        <h2>Skill Radar</h2>
        <p className="oc-sub">
          Apni skills likho (comma se alag karke). Parakh AI batayega kaun si skill badh rahi
          hai aur kaun si ghat rahi hai.
        </p>

        <div className="oc-samples">
          <button onClick={() => setSkills(SAMPLE)}>Sample bharo</button>
        </div>

        <textarea
          className="oc-text"
          rows={4}
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          maxLength={1500}
          placeholder="Jaise: Excel, Typing, Python, Photoshop..."
        />
        <div className="oc-row">
          <span className="oc-count">{skills.length} / 1500</span>
          <button className="oc-go" onClick={check} disabled={loading || !skills.trim()}>
            {loading ? "Check ho raha hai..." : "Skills check karo"}
          </button>
        </div>

        {error && <div className="oc-error">{error}</div>}

        {result && (
          <div className="oc-card">
            <p>{result.summary}</p>

            <div className="sr-counts">
              <span style={{ color: TREND.growing.color }}>▲ Badh rahi: {count("growing")}</span>
              <span style={{ color: TREND.stable.color }}>● Stable: {count("stable")}</span>
              <span style={{ color: TREND.declining.color }}>▼ Ghat rahi: {count("declining")}</span>
            </div>

            {list.map((s, i) => {
              const t = TREND[s.trend] || TREND.stable;
              return (
                <div className="sr-card" key={i} style={{ borderLeftColor: t.color }}>
                  <div className="sr-head">
                    <b>{s.name}</b>
                    <span className="sr-badge" style={{ background: t.color }}>
                      {t.label}
                    </span>
                  </div>
                  <p>{s.why}</p>
                  <p className="oc-note">
                    <b>Aage seekho:</b> {s.learnNext}
                  </p>
                </div>
              );
            })}

            <p className="oc-disclaimer">
              Ye andaza hai, AI guide hai, guarantee nahi. Job portals pe bhi demand check karo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}