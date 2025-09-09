/* server.js – Render.com – port 10000 */
require("dotenv").config();
const express = require("express");
const path = require("path");
const { OpenAI } = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.use(express.static("public"));

/* ---------- ordre SANS 2–5 ---------- */
const order = [
  /* ♠️ */
  "A♠️","K♠️","Q♠️","J♠️","10♠️","9♠️","8♠️","7♠️","6♠️",
  /* ♦️ */
  "A♦️","K♦️","Q♦️","J♦️","10♦️","9♦️","8♦️","7♦️","6♦️",
  /* ♣️ */
  "A♣️","K♣️","Q♣️","J♣️","10♣️","9♣️","8♣️","7♣️","6♣️",
  /* ♥️ */
  "A♥️","K♥️","Q♥️","J♥️","10♥️","9♥️","8♥️","7♥️","6♥️"
];

/* ---------- traitement cartes ---------- */
function processCardData(input) {
  const lines = input.trim().split("\n").filter(Boolean);
  const hands = [];

  for (const line of lines) {
    // Supprimer les tags inutiles
    const cleanLine = line.replace(/✅|🔵#R|#T\d+|-/g, "").trim();

    // Extraire la première parenthèse
    const m = cleanLine.match(/#N?(\d+)\.(\d+)\(([^)]+)\)/);
    if (!m) continue;

    const [, num, total, cards] = m;

    // Chercher toutes les cartes valides dans cette main
    const foundKeys = order.filter(c => cards.includes(c));
    if (!foundKeys.length) continue;

    // Ajouter une copie de la main pour chaque carte valide
    for (const key of foundKeys) {
      hands.push({
        key,
        line: `#N${num}.${total}(${cards})`
      });
    }
  }

  if (!hands.length) return "(Aucune main valide trouvée)";

  // Trier selon l’ordre global
  hands.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  // Regrouper
  const grouped = [];
  let lastKey = null;
  for (const h of hands) {
    if (h.key !== lastKey) {
      grouped.push({ key: h.key, lines: [] });
    }
    grouped[grouped.length - 1].lines.push(h.line);
    lastKey = h.key;
  }

  // Construire sortie
  const out = [];
  grouped.forEach(g => {
    out.push(g.key);
    out.push(...[...new Set(g.lines)]); // éviter doublons
    out.push("");
  });

  return out.join("\n").trim();
}

/* ---------- routes ---------- */
app.post("/process", (req, res) => {
  try {
    const result = processCardData(req.body.data || "");
    res.json({ success: true, result });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post("/ask", async (req, res) => {
  const { data, question } = req.body;
  if (!question) return res.status(400).json({ error: "Question manquante" });

  const q = question.toLowerCase().trim();

  if (q === "nom" || q.includes("nom")) return res.type("text/plain").send("Sossou");
  if (q === "prénom" || q.includes("prénom") || q === "prenom")
    return res.type("text/plain").send("Kouamé");
  if (q.includes("nom complet") || q.includes("qui es-tu"))
    return res.type("text/plain").send("Sossou Kouamé");

  const devKeywords = [
    "développeur",
    "developpeur",
    "créateur",
    "auteur",
    "qui a fait",
    "qui est l'auteur"
  ];
  if (devKeywords.some(kw => q.includes(kw))) {
    return res
      .type("text/plain")
      .send(
        "SOSSOU Kouamé Appolinaire est le développeur de cette IA. Né en Côte d’Ivoire, technicien supérieur en génie civil, il crée aussi des bots Telegram. WhatsApp : +229 01 67 92 40 76."
      );
  }

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu es un assistant spécialisé dans l’analyse de mains de cartes. Réponds en français." },
        { role: "user", content: `Mains :\n${data}\n\nQuestion : ${question}` }
      ],
      stream: true
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) res.write(delta);
    }
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Serveur démarré sur le port ${PORT}`));
