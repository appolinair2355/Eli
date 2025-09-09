/* server.js – Render.com – port 10000 */
require("dotenv").config();
const express = require("express");
const { OpenAI } = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.use(express.static("public"));

/* ---------- ordre COMPLET 2–As (sans variation emoji) ---------- */
const order = [
  // ♠
  "A♠","K♠","Q♠","J♠","10♠","9♠","8♠","7♠","6♠","5♠","4♠","3♠","2♠",
  // ♦
  "A♦","K♦","Q♦","J♦","10♦","9♦","8♦","7♦","6♦","5♦","4♦","3♦","2♦",
  // ♣
  "A♣","K♣","Q♣","J♣","10♣","9♣","8♣","7♣","6♣","5♣","4♣","3♣","2♣",
  // ♥
  "A♥","K♥","Q♥","J♥","10♥","9♥","8♥","7♥","6♥","5♥","4♥","3♥","2♥"
];

/* ---------- normalisation robuste ---------- */
function normalize(str = "") {
  return String(str)
    .replace(/\ufe0f/g, "")      // variation selector invisible
    .replace(/T/g, "10")         // T → 10
    .replace(/1\D?0/g, "10")     // "1 0" ou "1-0" → "10"
    .replace(/\s+/g, " ")        // espaces multiples → 1 espace
    .trim();
}

/* ---------- regex carte : (10|2-9|A|J|Q|K) suivi d'un symbole ♥♦♣♠ ---------- */
const CARD_RE = /(10|[2-9]|[AJQK])[♠♦♣♥]/g;

/* ---------- traitement cartes ---------- */
function processCardData(input) {
  const lines = normalize(input).split(/\r?\n/).filter(Boolean);
  const hands = [];

  for (const rawLine of lines) {
    // on enlève les tags bruyants puis on normalise
    const line = normalize(
      rawLine.replace(/✅|🔵#R|#R|#T\d+|—|–|-/g, " ")
    );

    // on essaie d'extraire N° et total si présents
    const head = line.match(/#N?(\d+)\.(\d+)/);
    const num = head ? head[1] : "?";
    const total = head ? head[2] : "?";

    // on scanne TOUTES les parenthèses de la ligne (il peut y en avoir 2)
    const parens = [...line.matchAll(/\(([^)]*)\)/g)];
    if (parens.length === 0) continue;

    for (const p of parens) {
      const inside = normalize(p[1]);

      // on extrait toutes les cartes avec la regex
      const cards = [...inside.matchAll(CARD_RE)].map(m => m[0]);
      if (cards.length === 0) continue;

      for (const key of cards) {
        hands.push({
          key,
          line: `#N${num}.${total}(${inside})`
        });
      }
    }
  }

  if (!hands.length) return "(Aucune main valide trouvée)";

  // tri selon l’ordre global (normalisé)
  const normOrder = order.map(normalize);
  hands.sort((a, b) => normOrder.indexOf(a.key) - normOrder.indexOf(b.key));

  // regrouper par carte
  const grouped = [];
  let last = null;
  for (const h of hands) {
    if (h.key !== last) grouped.push({ key: h.key, lines: [] });
    grouped[grouped.length - 1].lines.push(h.line);
    last = h.key;
  }

  // construire la sortie (évite doublons de lignes par carte)
  const out = [];
  for (const g of grouped) {
    out.push(g.key);
    out.push(...[...new Set(g.lines)]);
    out.push("");
  }
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
  if (q === "prénom" || q.includes("prénom") || q.includes("prenom"))
    return res.type("text/plain").send("Kouamé");
  if (q.includes("nom complet") || q.includes("qui es-tu"))
    return res.type("text/plain").send("Sossou Kouamé");

  const devKeywords = [
    "développeur","developpeur","créateur","auteur","qui a fait","qui est l'auteur"
  ];
  if (devKeywords.some(kw => q.includes(kw))) {
    return res
      .type("text/plain")
      .send("SOSSOU Kouamé Appolinaire est le développeur de cette IA. Né en Côte d’Ivoire, technicien supérieur en génie civil, il crée aussi des bots Telegram. WhatsApp : +229 01 67 92 40 76.");
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
