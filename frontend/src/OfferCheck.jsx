import { useState } from "react";

const API = "http://localhost:5000";

const SCAM_SAMPLE = `Congratulations! You are selected for Data Entry Executive at Global Tech Solutions.
Salary: Rs 45,000 per month, work from home, no experience needed.
To confirm your joining, pay Rs 2,500 registration fee and Rs 3,000 laptop security deposit (refundable).
Contact our HR only on WhatsApp: +91 98XXXXXX10. Offer valid for 24 hours only.
Email: globaltech.hr2024@gmail.com`;

const GOOD_SAMPLE = `Offer Letter - Nexora Technologies Pvt. Ltd.
Position: Graduate Engineer Trainee, Pune office.
Annual CTC: Rs 4,50,000 (Fixed Rs 3,60,000 + Variable Rs 90,000).
Probation: 6 months. Notice period: 60 days. No service bond.
Joining date: 1 July 2027. Interview rounds completed: aptitude, technical, HR.
Please confirm by replying to hr@nexora-tech.com. No fee is required at any stage.`;

const arr = (x) => (Array.isArray(x) ? x : []);

function scoreColor(score) {
  if (score < 35) return "#16a34a";
  if (score < 65) return "#f97316";
  return "#dc2626";
}

function List({ title, items, kind }) {
  if (items.length === 0) return null;
  return (
    <div className={"oc-list " + kind}>
      <h4>{title}</h4>
      <ul>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

export default function OfferCheck({ language }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function check() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(API + "/api/offer-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kuch gadbad ho gayi.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Backend se connect nahi hua. Server chal raha hai?");
    }
    setLoading(false);
  }

  const score = result ? Number(result.riskScore) || 0 : 0;
  const salary = result && result.salary ? result.salary : null;

  return (
    <div className="oc-wrap">
      <div className="oc-inner">
        <h2>Offer Check</h2>
        <p className="oc-sub">
          Job ya internship ka message / offer letter yahan paste karo. Parakh AI scam risk
          check karega.
        </p>

        <div className="oc-samples">
          <button onClick={() => setText(SCAM_SAMPLE)}>Scam sample</button>
          <button onClick={() => setText(GOOD_SAMPLE)}>Genuine sample</button>
        </div>

        <textarea
          className="oc-text"
          rows={9}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Yahan offer paste karo..."
        />
        <div className="oc-row">
          <span className="oc-count">{text.length} / 6000</span>
          <button className="oc-go" onClick={check} disabled={loading || !text.trim()}>
            {loading ? "Check ho raha hai..." : "Offer check karo"}
          </button>
        </div>

        {error && <div className="oc-error">{error}</div>}

        {result && (
          <div className="oc-card">
            <div className="oc-top">
              <div className="oc-score" style={{ borderColor: scoreColor(score), color: scoreColor(score) }}>
                {score}
                <small>/100</small>
              </div>
              <div>
                <div className="oc-verdict" style={{ color: scoreColor(score) }}>
                  {result.verdict}
                </div>
                <p>{result.summary}</p>
              </div>
            </div>

            <List title="Red flags" items={arr(result.redFlags)} kind="bad" />
            <List title="Good signs" items={arr(result.goodSigns)} kind="good" />

            {salary && (
              <div className="oc-salary">
                <h4>Salary breakdown (andaza)</h4>
                <p>
                  <b>Advertised:</b> {salary.advertised}
                </p>
                <p>
                  <b>In-hand (estimate):</b> {salary.inHandEstimate}
                </p>
                {salary.note && <p className="oc-note">{salary.note}</p>}
              </div>
            )}

            <List title="Ab kya karein" items={arr(result.nextSteps)} kind="steps" />

            <p className="oc-disclaimer">
              AI guide hai, guarantee nahi. Company verify karo, job ke liye kabhi paisa mat do.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}