const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const dns = require("dns").promises;
const net = require("net");
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const { DatabaseSync } = require("node:sqlite");

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
console.log("Model use ho raha hai:", MODEL);
console.log("API key mili?", process.env.GEMINI_API_KEY ? "haan" : "NAHI");

// Database: users, chats aur applications yahan save hongi
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
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// Purani tables mein user_id column jodo (agar pehle se hai to error ignore)
function addUserColumn(table) {
  try {
    db.exec("ALTER TABLE " + table + " ADD COLUMN user_id INTEGER");
  } catch (err) {
    // column pehle se maujood hai
  }
}
addUserColumn("conversations");
addUserColumn("applications");

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
      console.log("GEMINI ERROR (try " + attempt + "):", String(err && err.message ? err.message : err).slice(0, 600));
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  return null;
}

const BUSY = "AI abhi busy hai, thodi der baad try karo.";
const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const CHAT_ATTACHMENT_TYPES = {
  pdf: { mimeType: "application/pdf", signature: Buffer.from("%PDF-") },
  jpg: { mimeType: "image/jpeg", signature: Buffer.from([0xff, 0xd8, 0xff]) },
  jpeg: { mimeType: "image/jpeg", signature: Buffer.from([0xff, 0xd8, 0xff]) },
  png: { mimeType: "image/png", signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  webp: { mimeType: "image/webp", signature: Buffer.from("RIFF"), secondary: Buffer.from("WEBP") },
};

function hasExpectedFileSignature(buffer, type) {
  if (!buffer.subarray(0, type.signature.length).equals(type.signature)) return false;
  return !type.secondary || buffer.subarray(8, 12).equals(type.secondary);
}

// ---------- Login helpers ----------
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function makeSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  return token;
}

// Jis route par ye lagega, wahan login zaroori hoga
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Pehle login karo." });
  }
  const user = db
    .prepare(
      "SELECT users.id AS id, users.name AS name, users.email AS email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ?"
    )
    .get(token);
  if (!user) {
    return res.status(401).json({ error: "Login khatam ho gaya, dobara login karo." });
  }
  req.user = { id: user.id, name: user.name, email: user.email };
  req.token = token;
  next();
}

// ---------- Job link padhne ke helpers (safe fetch) ----------
const LINK_FAIL = "Ye link khul nahi paaya, offer ka text paste karo.";

// Computer ke andar ke ya private addresses pehchano
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
    if (p[0] >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return false;
  }
  return true;
}

async function assertPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("private");
    return;
  }
  const addrs = await dns.lookup(host, { all: true });
  if (addrs.length === 0) throw new Error("no address");
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new Error("private");
  }
}

// Body ko 1 MB tak hi padho
async function readLimited(response, maxBytes) {
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    chunks.push(value);
    if (total >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

function htmlToText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageText(startUrl) {
  let current = startUrl;
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(current);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocol");
    if (u.port && u.port !== "80" && u.port !== "443") throw new Error("port");
    await assertPublicHost(u.hostname);

    const r = await fetch(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ParakhAI/1.0)",
        Accept: "text/html,text/plain",
      },
    });

    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      current = new URL(r.headers.get("location"), u).toString();
      continue;
    }
    if (!r.ok) throw new Error("status " + r.status);

    const type = (r.headers.get("content-type") || "").toLowerCase();
    if (!type.includes("text/html") && !type.includes("text/plain")) {
      throw new Error("type");
    }
    const body = await readLimited(r, 1000000);
    return type.includes("text/html") ? htmlToText(body) : body.replace(/\s+/g, " ").trim();
  }
  throw new Error("too many redirects");
}

app.get("/api/hello", (req, res) => {
  res.json({ message: "Namaste! Parakh AI backend chal raha hai." });
});

// ---------- Signup / Login / Logout ----------
app.post("/api/signup", (req, res) => {
  const { name, email, password } = req.body;
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const pass = String(password || "");

  if (!cleanName || cleanName.length > 100) {
    return res.status(400).json({ error: "Apna naam likho (100 akshar tak)." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 200) {
    return res.status(400).json({ error: "Sahi email likho." });
  }
  if (pass.length < 6 || pass.length > 200) {
    return res.status(400).json({ error: "Password kam se kam 6 akshar ka rakho." });
  }

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail);
  if (exists) {
    return res.status(400).json({ error: "Ye email pehle se registered hai. Login karo." });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const result = db
    .prepare("INSERT INTO users (name, email, salt, password_hash) VALUES (?, ?, ?, ?)")
    .run(cleanName, cleanEmail, salt, hashPassword(pass, salt));
  const userId = Number(result.lastInsertRowid);
  const token = makeSession(userId);
  res.json({ token, user: { id: userId, name: cleanName, email: cleanEmail } });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = String(email || "").trim().toLowerCase();
  const pass = String(password || "");

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(cleanEmail);
  let ok = false;
  if (user && pass.length <= 200) {
    const a = Buffer.from(hashPassword(pass, user.salt), "hex");
    const b = Buffer.from(user.password_hash, "hex");
    ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  if (!ok) {
    return res.status(401).json({ error: "Email ya password galat hai." });
  }

  const token = makeSession(user.id);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/logout", requireAuth, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(req.token);
  res.json({ ok: true });
});

// ---------- Chat history (sirf apni chats) ----------
app.get("/api/conversations", requireAuth, (req, res) => {
  const rows = db
    .prepare("SELECT id, title FROM conversations WHERE user_id = ? ORDER BY id DESC")
    .all(req.user.id);
  res.json(rows);
});

app.post("/api/conversations", requireAuth, (req, res) => {
  const result = db
    .prepare("INSERT INTO conversations (user_id) VALUES (?)")
    .run(req.user.id);
  res.json({ id: Number(result.lastInsertRowid), title: "New chat" });
});

app.get("/api/conversations/:id/messages", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const convo = db
    .prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?")
    .get(id, req.user.id);
  if (!convo) {
    return res.status(404).json({ error: "Ye chat nahi mili." });
  }
  const rows = db
    .prepare("SELECT role, text FROM messages WHERE conversation_id = ? ORDER BY id")
    .all(id);
  res.json(rows);
});

app.delete("/api/conversations/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const convo = db
    .prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?")
    .get(id, req.user.id);
  if (!convo) {
    return res.status(404).json({ error: "Ye chat nahi mili." });
  }
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  res.json({ ok: true });
});

// ---------- Chat ----------
app.post("/api/chat", requireAuth, async (req, res) => {
  const { conversationId, message, language, attachment } = req.body || {};
  const id = Number(conversationId);
  const text = typeof message === "string" ? message.trim() : "";

  if (!id || (!text && !attachment)) {
    return res.status(400).json({ error: "Pehle kuch likho." });
  }
  if (text.length > 6000) {
    return res.status(400).json({ error: "Message bahut lamba hai." });
  }

  let fileData;
  let fileMimeType;
  let fileName;
  if (attachment) {
    if (
      typeof attachment.name !== "string" ||
      attachment.name.length > 180 ||
      typeof attachment.mimeType !== "string" ||
      typeof attachment.data !== "string" ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(attachment.data)
    ) {
      return res.status(400).json({ error: "File sahi format mein nahi hai." });
    }

    fileName = attachment.name.replace(/[\\/\u0000-\u001f]/g, "").trim();
    const extension = fileName.split(".").pop().toLowerCase();
    const fileType = CHAT_ATTACHMENT_TYPES[extension];
    if (!fileName || !fileType || attachment.mimeType !== fileType.mimeType) {
      return res.status(400).json({ error: "Sirf PDF, JPG, PNG ya WebP file attach karo." });
    }

    fileData = Buffer.from(attachment.data, "base64");
    if (
      fileData.length === 0 ||
      fileData.length > MAX_CHAT_ATTACHMENT_BYTES ||
      !hasExpectedFileSignature(fileData, fileType)
    ) {
      return res.status(400).json({ error: "File valid nahi hai ya 10 MB se badi hai." });
    }
    fileMimeType = fileType.mimeType;
  }

  const prompt = text ||
    (language === "hinglish"
      ? "Attached file ko padhkar iska summary aur main points batao."
      : "Read the attached file and summarize its main points.");
  const storedMessage = fileName ? `${prompt}\n[Attached: ${fileName}]` : prompt;

  const convo = db
    .prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?")
    .get(id, req.user.id);
  if (!convo) {
    return res.status(404).json({ error: "Ye chat nahi mili." });
  }

  db.prepare(
    "INSERT INTO messages (conversation_id, role, text) VALUES (?, 'user', ?)"
  ).run(id, storedMessage);

  if (convo.title === "New chat") {
    db.prepare("UPDATE conversations SET title = ? WHERE id = ?").run(
      (text || `Analyze ${fileName}`).slice(0, 40),
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
  if (fileData && contents.length > 0) {
    contents[contents.length - 1].parts.push({
      inlineData: { mimeType: fileMimeType, data: fileData.toString("base64") },
    });
  }
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
          style +
          (fileData
            ? " Analyze the attached PDF or image and answer using its visible/readable content. If any part is unclear, say so instead of guessing."
            : ""),
      },
    });
    const reply = response.text || "Jawab nahi mila, dobara try karo.";
    db.prepare(
      "INSERT INTO messages (conversation_id, role, text) VALUES (?, 'model', ?)"
    ).run(id, reply);
    res.json({ reply });
  } catch (err) {
    console.log("GEMINI ERROR (chat):", String(err && err.message ? err.message : err).slice(0, 600));
    res.status(500).json({ error: BUSY });
  }
});

// ---------- Job link se text lao (login zaroori) ----------
app.post("/api/fetch-job-link", requireAuth, async (req, res) => {
  const raw = String((req.body && req.body.url) || "").trim();
  if (!raw || raw.length > 500) {
    return res.status(400).json({ error: "Sahi link paste karo." });
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return res.status(400).json({ error: "Ye link sahi nahi hai. https:// se shuru hone wala link do." });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return res.status(400).json({ error: "Sirf http ya https link chalega." });
  }

  try {
    const text = await fetchPageText(parsed.toString());
    if (text.length < 200) {
      return res.status(422).json({ error: LINK_FAIL });
    }
    res.json({ text: text.slice(0, 6000) });
  } catch (err) {
    res.status(422).json({ error: LINK_FAIL });
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
  "companyName": "the company name exactly as written in the text, or null if no company name is given",
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

// ---------- My Applications (database, AI nahi, sirf apni) ----------
const STATUSES = ["Applied", "Interview", "Offer", "Rejected"];

app.get("/api/applications", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, company, role, applied_date AS appliedDate, status FROM applications WHERE user_id = ? ORDER BY id DESC"
    )
    .all(req.user.id);
  res.json(rows);
});

app.post("/api/applications", requireAuth, (req, res) => {
  const { company, role, appliedDate } = req.body;

  if (!company || !company.trim() || !role || !role.trim()) {
    return res.status(400).json({ error: "Company aur role dono likho." });
  }
  if (company.length > 100 || role.length > 100) {
    return res.status(400).json({ error: "Naam bahut lamba hai (100 akshar tak)." });
  }

  const date = String(appliedDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const result = db
    .prepare(
      "INSERT INTO applications (company, role, applied_date, user_id) VALUES (?, ?, ?, ?)"
    )
    .run(company.trim(), role.trim(), date, req.user.id);
  res.json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/applications/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: "Status galat hai." });
  }
  db.prepare("UPDATE applications SET status = ? WHERE id = ? AND user_id = ?").run(
    status,
    id,
    req.user.id
  );
  res.json({ ok: true });
});

app.delete("/api/applications/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM applications WHERE id = ? AND user_id = ?").run(id, req.user.id);
  res.json({ ok: true });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log("Backend chal raha hai: http://localhost:" + PORT);
});