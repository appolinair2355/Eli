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

/* ---------- ordre des cartes (6 → A) ---------- */
const order = [
  "A♠", "K♠", "Q♠", "J♠", "10♠", "9♠", "8♠", "7♠", "6♠",
  "A♦", "K♦", "Q♦", "J♦", "10♦", "9♦", "8♦", "7♦", "6♦",
  "A♣", "K♣", "Q♣", "J♣", "10♣", "9♣", "8♣", "7♣", "6♣",
  "A♥", "K♥", "Q♥", "J♥", "10♥", "9♥", "8♥", "7♥", "6♥"
];

/* ---------- traitement manuel des cartes ---------- */
function processCardData(input) {
  const lines = input.trim().split("\n").filter(Boolean);
  const hands = [];

  for (const line of lines) {
    // supprimer tags inutiles
    const cleanLine = line.replace(/✅|🔵#R|#T\d+|-/g, "").trim();

    // garder uniquement la première parenthèse
    const m = cleanLine.match(/(#N?\d+\.\d+\([^)]*\))/);
    if (!m) continue;

    const full = m[1];

    // extraire les cartes
    const cards = full.match(/([AKQJ]|10|9|8|7|6)[♠♦♣♥]/g);
    if (!cards) continue;

    // ajouter chaque carte valide
    for (const c of cards) {
      if (order.includes(c)) {
        hands.push({ key: c, line: full });
      }
    }
  }

  if (!hands.length) return "(Aucune main valide trouvée)";

  // trier selon l’ordre global
  hands.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  // regrouper
  const grouped = [];
  let lastKey = null;
  for (const h of hands) {
    if (h.key !== lastKey) {
      grouped.push({ key: h.key, lines: [] });
    }
    grouped[grouped.length - 1].lines.push(h.line);
    lastKey = h.key;
  }

  // construire sortie
  const out = [];
  grouped.forEach(g => {
    out.push(g.key);
    out.push(...[...new Set(g.lines)]); // éviter doublons
    out.push("");
  });

  return out.join("\n").trim();
}

/* ---------- route locale (tri manuel) ---------- */
app.post("/process", (req, res) => {
  try {
    const result = processCardData(req.body.data || "");
    res.json({ success: true, result });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

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
          content: `Mains :\n${data}\n\nQuestion : ${question}`
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
