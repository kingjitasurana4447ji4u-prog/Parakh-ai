import { useState } from "react";

const API = "http://localhost:5000";
const arr = (x) => (Array.isArray(x) ? x : []);
const num = (x) => Number(x) || 0;

const SAMPLE = {
  a: "MBA (2 saal full-time, private college, fees around 6 lakh)",
  b: "Job (private company mein fresher, Panipat ya Delhi NCR)",
  bg: "BBA final year, marks 65%, Tier-2 city se, family ko jaldi kamai chahiye",
};

function Chart({ title, rows, max, nameA, nameB }) {
  return (
    <div className="pc-chart">
      <h4>{title}</h4>
      {rows.map((r) => (
        <div className="pc-yr" key={r.label}>
          <div className="pc-yl">{r.label}</div>
          <div className="pc-bars">
            <div className="pc-bar a" style={{ width: Math.max((r.a / max) * 100, 4) + "%" }}>
              {r.a}
            </div>
            <div className="pc-bar b" style={{ width: Math.max((r.b / max) * 100, 4) + "%" }}>
              {r.b}
            </div>
          </div>
        </div>
      ))}
      <div className="pc-legend">
        <span className="a">■ {nameA}</span>
        <span className="b">■ {nameB}</span>
      </div>
    </div>
  );
}

function OptionCard({ o, color }) {
  return (
    <div className={"pc-card " + color}>
      <h3>{o.name}</h3>
      <p className="pc-stress">Stress: {num(o.stress)}/10</p>
      <div className="oc-list steps">
        <h4>Skills milengi</h4>
        <ul>{arr(o.skills).map((x, i) => <li key={i}>{x}</li>)}</ul>
      </div>
      <div className="oc-list good">
        <h4>Fayde</h4>
        <ul>{arr(o.pros).map((x, i) => <li key={i}>{x}</li>)}</ul>
      </div>
      <div className="oc-list bad">
        <h4>Risk</h4>
        <ul>{arr(o.risks).map((x, i) => <li key={i}>{x}</li>)}</ul>
      </div>
      <p className="oc-note"><b>Kiske liye:</b> {o.suits}</p>
    </div>
  );
}

export default function PathCompare({ language }) {
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [background, setBackground] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function fillSample() {
    setOptionA(SAMPLE.a);
    setOptionB(SAMPLE.b);
    setBackground(SAMPLE.bg);
  }

  async function compare() {
    if (!optionA.trim() || !optionB.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(API + "/api/path-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionA, optionB, background, language }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Kuch gadbad ho gayi.");
      else setResult(data);
    } catch {
      setError("Backend se connect nahi hua. Server chal raha hai?");
    }
    setLoading(false);
  }

  const A = result ? result.optionA : null;
  const B = result ? result.optionB : null;

  let salaryRows = [];
  let salaryMax = 1;
  if (A && B) {
    salaryRows = [
      { label: "Saal 1", a: num(A.salaryYear1), b: num(B.salaryYear1) },
      { label: "Saal 2", a: num(A.salaryYear2), b: num(B.salaryYear2) },
      { label: "Saal 3", a: num(A.salaryYear3), b: num(B.salaryYear3) },
    ];
    salaryMax = Math.max(1, ...salaryRows.map((r) => Math.max(r.a, r.b)));
  }

  return (
    <div className="oc-wrap">
      <div className="oc-inner">
        <h2>Path Compare</h2>
        <p className="oc-sub">
          Do raaste likho (jaise MBA vs Job). Parakh AI agle 3 saal ka andaza dikhayega.
        </p>

        <div className="oc-samples">
          <button onClick={fillSample}>Sample bharo</button>
        </div>

        <div className="pc-inputs">
          <input
            className="pc-input"
            value={optionA}
            onChange={(e) => setOptionA(e.target.value)}
            maxLength={1500}
            placeholder="Option A (jaise: MBA)"
          />
          <input
            className="pc-input"
            value={optionB}
            onChange={(e) => setOptionB(e.target.value)}
            maxLength={1500}
            placeholder="Option B (jaise: Job)"
          />
        </div>
        <textarea
          className="oc-text"
          rows={3}
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          maxLength={1500}
          placeholder="Apne baare mein (optional): padhai, marks, shehar, budget..."
        />
        <div className="oc-row">
          <span className="oc-count"></span>
          <button
            className="oc-go"
            onClick={compare}
            disabled={loading || !optionA.trim() || !optionB.trim()}
          >
            {loading ? "Compare ho raha hai..." : "Compare karo"}
          </button>
        </div>

        {error && <div className="oc-error">{error}</div>}

        {result && A && B && (
          <div className="oc-card">
            <div className="pc-cards">
              <OptionCard o={A} color="a" />
              <OptionCard o={B} color="b" />
            </div>

            <Chart
              title="Kamai (lakh per saal, andaza)"
              rows={salaryRows}
              max={salaryMax}
              nameA={A.name}
              nameB={B.name}
            />
            <Chart
              title="Stress level (1 se 10)"
              rows={[{ label: "Stress", a: num(A.stress), b: num(B.stress) }]}
              max={10}
              nameA={A.name}
              nameB={B.name}
            />

            <div className="oc-salary">
              <h4>Parakh ki raay</h4>
              <p>{result.verdict}</p>
            </div>

            <p className="oc-disclaimer">
              Ye sirf rough andaza hai. AI guide hai, guarantee nahi. Apne bade logon aur
              asli data se bhi check karo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}