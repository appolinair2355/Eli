// server.js
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 10000; // ✅ forcé sur 10000

app.use(bodyParser.json());
app.use(express.static("public"));

// Config OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Route API /ask
app.post("/ask", async (req, res) => {
  const { data, question } = req.body;

  if (!data || !question) {
    return res.status(400).json({ success: false, error: "Données ou question manquantes." });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant spécialisé dans l’analyse et le classement des cartes. Réponds toujours en français clair."
        },
        {
          role: "user",
          content: `Voici mes données brutes :\n${data}\n\n${question}`
        }
      ]
    });

    const output = completion.choices[0].message.content;
    res.json({ success: true, result: output });
  } catch (err) {
    console.error("Erreur OpenAI:", err.response?.data || err.message);
    res.json({ success: false, error: err.message || "Erreur API" });
  }
});

// Lancement du serveur
app.listen(port, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${port}`);
});
