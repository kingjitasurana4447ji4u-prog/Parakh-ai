const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

app.get("/api/hello", (req, res) => {
  res.json({ message: "Namaste! Parakh AI backend chal raha hai." });
});

app.post("/api/chat", async (req, res) => {
  const { message, language } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Pehle kuch likho." });
  }
  if (message.length > 6000) {
    return res.status(400).json({ error: "Message bahut lamba hai." });
  }

  const style =
    language === "hinglish"
      ? "Reply in simple Hinglish (Hindi written in English letters)."
      : "Reply in simple English.";

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: message,
      config: {
        systemInstruction:
          "You are Parakh AI, a friendly career companion for Indian students and freshers. " +
          style,
      },
    });
    res.json({ reply: response.text });
  } catch (err) {
    res.status(500).json({ error: "AI abhi busy hai, thodi der baad try karo." });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log("Backend chal raha hai: http://localhost:" + PORT);
});