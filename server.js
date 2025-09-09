// server.js
import express from "express";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());
app.use(express.static("public"));

/* ---------- route IA OpenAI ---------- */
app.post("/ask", async (req, res) => {
  const { data, question } = req.body;
  if (!question) return res.status(400).json({ error: "Question manquante" });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Tu es un assistant spécialisé dans l’analyse de mains de cartes. Réponds en français."
        },
        {
          role: "user",
          content: `Voici les données brutes :\n${data}\n\n${question}`
        }
      ],
    });

    const output = completion.choices[0].message.content;
    res.json({ success: true, result: output });
  } catch (err) {
    console.error("Erreur OpenAI:", err);
    res.json({ success: false, error: err.message });
  }
});

/* ---------- démarrage serveur ---------- */
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
