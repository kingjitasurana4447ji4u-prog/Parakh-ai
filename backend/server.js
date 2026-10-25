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

// Database: chats yahan save hongi
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
`);

app.get("/api/hello", (req, res) => {
  res.json({ message: "Namaste! Parakh AI backend chal raha hai." });
});

// Saari chats ki list
app.get("/api/conversations", (req, res) => {
  const rows = db
    .prepare("SELECT id, title FROM conversations ORDER BY id DESC")
    .all();
  res.json(rows);
});

// Nayi chat banao
app.post("/api/conversations", (req, res) => {
  const result = db.prepare("INSERT INTO conversations DEFAULT VALUES").run();
  res.json({ id: Number(result.lastInsertRowid), title: "New chat" });
});

// Ek chat ke saare messages
app.get("/api/conversations/:id/messages", (req, res) => {
  const id = Number(req.params.id);
  const rows = db
    .prepare("SELECT role, text FROM messages WHERE conversation_id = ? ORDER BY id")
    .all(id);
  res.json(rows);
});

// Chat delete karo
app.delete("/api/conversations/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  res.json({ ok: true });
});

// Message bhejo, Gemini se jawab lo, dono save karo
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
    res.status(500).json({ error: "AI abhi busy hai, thodi der baad try karo." });
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

  const lang =
    language === "hinglish"
      ? "simple Hinglish (Hindi written in English letters)"
      : "simple English";

  const instruction = `You are Parakh AI, an expert at spotting fake job and internship offers in India.
The user pastes a job message or offer letter. Analyse it for scam risk.
Look for: registration or security fees, payment before joining, WhatsApp/Telegram-only recruiters,
free email domains (gmail, yahoo) used by a "company", urgency pressure, unrealistic salary for the role,
service bonds, very long notice periods, unpaid probation, no interview, vague company details.
Write all text fields in ${lang}. Keep each point short and clear.
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

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: text,
        config: {
          systemInstruction: instruction,
          responseMimeType: "application/json",
        },
      });
      const clean = (response.text || "").replace(/```json|```/g, "").trim();
      const data = JSON.parse(clean);
      return res.json(data);
    } catch (err) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  res.status(500).json({ error: "AI abhi busy hai, thodi der baad try karo." });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log("Backend chal raha hai: http://localhost:" + PORT);
});