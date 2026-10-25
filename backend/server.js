const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const { DatabaseSync } = require("node:sqlite");

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// Database: chats aur applications yahan save hongi
const db = new DatabaseSync(path.join(__dirname, "parakh.db"));
db.exec(`
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  applied_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Applied',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// ---------- Helpers (har tool yahi use karta hai) ----------
function langText(language) {
  return language === "hinglish"
    ? "simple Hinglish (Hindi written in English letters)"
    : "simple English";
}

// Gemini se JSON jawab lo, 3 baar try karo
async function askJson(instruction, contents) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: instruction,
          responseMimeType: "application/json",
        },
      });
      const clean = (response.text || "").replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch (err) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  return null;
}

const BUSY = "AI abhi busy hai, thodi der baad try karo.";

app.get("/api/hello", (req, res) => {
  res.json({ message: "Namaste! Parakh AI backend chal raha hai." });
});

// ---------- Chat history ----------
app.get("/api/conversations", (req, res) => {
  const rows = db
    .prepare("SELECT id, title FROM conversations ORDER BY id DESC")
    .all();
  res.json(rows);
});

app.post("/api/conversations", (req, res) => {
  const result = db.prepare("INSERT INTO conversations DEFAULT VALUES").run();
  res.json({ id: Number(result.lastInsertRowid), title: "New chat" });
});

app.get("/api/conversations/:id/messages", (req, res) => {
  const id = Number(req.params.id);
  const rows = db
    .prepare("SELECT role, text FROM messages WHERE conversation_id = ? ORDER BY id")
    .all(id);
  res.json(rows);
});

app.delete("/api/conversations/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  res.json({ ok: true });
});

// ---------- Chat ----------
app.post("/api/chat", async (req, res) => {
  const { conversationId, message, language } = req.body;
  const id = Number(conversationId);

  if (!id || !message || !message.trim()) {
    return res.status(400).json({ error: "Pehle kuch likho." });
  }
  if (message.length > 6000) {
    return res.status(400).json({ error: "Message bahut lamba hai." });
  }

  const convo = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
  if (!convo) {
    return res.status(404).json({ error: "Ye chat nahi mili." });
  }

  db.prepare(
    "INSERT INTO messages (conversation_id, role, text) VALUES (?, 'user', ?)"
  ).run(id, message);

  if (convo.title === "New chat") {
    db.prepare("UPDATE conversations SET title = ? WHERE id = ?").run(
      message.trim().slice(0, 40),
      id
    );
  }

  const rows = db
    .prepare(
      "SELECT role, text FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 20"
    )
    .all(id)
    .reverse();
  const contents = rows.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));
  while (contents.length > 0 && contents[0].role === "model") {
    contents.shift();
  }

  const style =
    language === "hinglish"
      ? "Reply in simple Hinglish (Hindi written in English letters)."
      : "Reply in simple English.";

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction:
          "You are Parakh AI, a friendly career companion for Indian students and freshers. " +
          style,
      },
    });
    const reply = response.text || "Jawab nahi mila, dobara try karo.";
    db.prepare(
      "INSERT INTO messages (conversation_id, role, text) VALUES (?, 'model', ?)"
    ).run(id, reply);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: BUSY });
  }
});

// ---------- Offer Check ----------
app.post("/api/offer-check", async (req, res) => {
  const { text, language } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Pehle offer ka text paste karo." });
  }
  if (text.length > 6000) {
    return res.status(400).json({ error: "Text bahut lamba hai (6000 akshar tak)." });
  }

  const instruction = `You are Parakh AI, an expert at spotting fake job and internship offers in India.
The user pastes a job message or offer letter. Analyse it for scam risk.
Look for: registration or security fees, payment before joining, WhatsApp/Telegram-only recruiters,
free email domains (gmail, yahoo) used by a "company", urgency pressure, unrealistic salary for the role,
service bonds, very long notice periods, unpaid probation, no interview, vague company details.
Write all text fields in ${langText(language)}. Keep each point short and clear.
Reply with ONLY valid JSON in exactly this shape:
{
  "riskScore": number from 0 to 100 (100 = definitely a scam),
  "verdict": "Likely safe" or "Be careful" or "Likely scam",
  "summary": "2 short sentences",
  "redFlags": ["..."],
  "goodSigns": ["..."],
  "salary": null or { "advertised": "...", "inHandEstimate": "...", "note": "..." },
  "nextSteps": ["..."]
}
Set "salary" to null if no salary is mentioned. If salary is mentioned, give a rough in-hand estimate
after typical Indian deductions (PF, tax) and say clearly that it is an estimate.`;

  const data = await askJson(instruction, text);
  if (!data) return res.status(500).json({ error: BUSY });
  res.json(data);
});

// ---------- Path Compare ----------
app.post("/api/path-compare", async (req, res) => {
  const { optionA, optionB, background, language } = req.body;

  if (!optionA || !optionA.trim() || !optionB || !optionB.trim()) {
    return res.status(400).json({ error: "Dono options likho." });
  }
  if (
    optionA.length > 1500 ||
    optionB.length > 1500 ||
    (background && background.length > 1500)
  ) {
    return res.status(400).json({ error: "Text bahut lamba hai (1500 akshar tak)." });
  }

  const instruction = `You are Parakh AI, a career guide for Indian students and freshers, especially from Tier-2 and Tier-3 cities.
The user gives two career options and optional background. Compare them over the next 3 years.
Be realistic and honest. All money is in lakh rupees per year (LPA) as plain numbers, for example 3.5.
"salaryYear1/2/3" means the rough income earned in that year (use 0 if the person would be studying
without income; mention fees or loans in the risks).
Write all text in ${langText(language)}. Keep each point short.
Reply with ONLY valid JSON in exactly this shape:
{
  "optionA": {
    "name": "short name",
    "salaryYear1": number, "salaryYear2": number, "salaryYear3": number,
    "skills": ["skills gained"],
    "stress": number from 1 to 10,
    "pros": ["..."],
    "risks": ["..."],
    "suits": "who this path suits, one sentence"
  },
  "optionB": { same shape as optionA },
  "verdict": "2-3 sentence balanced advice, not a guarantee"
}`;

  const prompt =
    "Option A: " + optionA + "\nOption B: " + optionB +
    "\nBackground: " + (background && background.trim() ? background : "not given");

  const data = await askJson(instruction, prompt);
  if (!data || !data.optionA || !data.optionB) {
    return res.status(500).json({ error: BUSY });
  }
  res.json(data);
});

// ---------- Skill Radar ----------
app.post("/api/skill-radar", async (req, res) => {
  const { skills, language } = req.body;

  if (!skills || !skills.trim()) {
    return res.status(400).json({ error: "Apni skills likho." });
  }
  if (skills.length > 1500) {
    return res.status(400).json({ error: "Text bahut lamba hai (1500 akshar tak)." });
  }

  const instruction = `You are Parakh AI, a career guide for Indian students and freshers.
The user lists their skills. For each skill, say whether demand in the Indian job market is
"growing", "stable" or "declining" over the next 3 years, why, and what to learn next.
Be honest and practical. Write all text in ${langText(language)}. Keep each point short.
Reply with ONLY valid JSON in exactly this shape:
{
  "summary": "2 short sentences about the overall skill set",
  "skills": [
    { "name": "skill", "trend": "growing" or "stable" or "declining", "why": "...", "learnNext": "..." }
  ]
}
Include at most 12 skills.`;

  const data = await askJson(instruction, skills);
  if (!data || !Array.isArray(data.skills)) {
    return res.status(500).json({ error: BUSY });
  }
  res.json(data);
});

// ---------- My Applications (database, AI nahi) ----------
const STATUSES = ["Applied", "Interview", "Offer", "Rejected"];

app.get("/api/applications", (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, company, role, applied_date AS appliedDate, status FROM applications ORDER BY id DESC"
    )
    .all();
  res.json(rows);
});

app.post("/api/applications", (req, res) => {
  const { company, role, appliedDate } = req.body;

  if (!company || !company.trim() || !role || !role.trim()) {
    return res.status(400).json({ error: "Company aur role dono likho." });
  }
  if (company.length > 100 || role.length > 100) {
    return res.status(400).json({ error: "Naam bahut lamba hai (100 akshar tak)." });
  }

  const date = String(appliedDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const result = db
    .prepare("INSERT INTO applications (company, role, applied_date) VALUES (?, ?, ?)")
    .run(company.trim(), role.trim(), date);
  res.json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/applications/:id", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: "Status galat hai." });
  }
  db.prepare("UPDATE applications SET status = ? WHERE id = ?").run(status, id);
  res.json({ ok: true });
});

app.delete("/api/applications/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM applications WHERE id = ?").run(id);
  res.json({ ok: true });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log("Backend chal raha hai: http://localhost:" + PORT);
});