/* server.js – Render.com – port 10000 */
require("dotenv").config();
const express = require("express");
const { OpenAI } = require("openai");

const app = express();
const PORT = process.env.PORT || 10000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.use(express.static("public"));

/* -------- ordre EXACT demandé (6 → A) -------- */
const ORDER_6A = [
  // ♠️
  "A♠️","K♠️","Q♠️","J♠️","10♠️","9♠️","8♠️","7♠️","6♠️",
  // ♦️
  "A♦️","K♦️","Q♦️","J♦️","10♦️","9♦️","8♦️","7♦️","6♦️",
  // ♣️
  "A♣️","K♣️","Q♣️","J♣️","10♣️","9♣️","8♣️","7♣️","6♣️",
  // ❤️
  "A❤️","K❤️","Q❤️","J❤️","10❤️","9❤️","8❤️","7❤️","6❤️"
];

/* -------- normalisation -------- */
function normalize(str = "") {
  return String(str)
    .replace(/\ufe0f/g, "")     // variation selector invisible
    .replace(/T/gi, "10")       // T → 10
    .replace(/1\D?0/g, "10")    // "1 0", "1-0" → 10
    .replace(/\s+/g, " ")
    .trim();
}

/* -------- utilitaires -------- */
const CARD_RE_6A = /(10|[6-9]|[AJQK])[♠️♦️♣️❤️]/g;

function firstParenContent(line) {
  const m = line.match(/ $([^)]*)$/);   // ✅ regexp fixée
  return m ? m[1] : "";
}

function extractNumTotal(line) {
  const m = line.match(/#N?(\d+)\.(\d+)/);
  return m ? { num: m[1], total: m[2] } : { num: "?", total: "?" };
}

/* -------- traitement déterministe -------- */
function analyzeHandsDeterministic(rawInput) {
  const lines = String(rawInput).split(/\r?\n/).map(normalize).filter(Boolean);
  const results = [];

  for (const raw of lines) {
    const clean = normalize(raw.replace(/✅|🔵#R|#R|#T\d+|—|–| - | -|-|•/g, " "));
    const inside = normalize(firstParenContent(clean));
    if (!inside) continue;

    const cards = [...inside.matchAll(CARD_RE_6A)].map(m => m[0]);
    if (!cards.length) continue;

    const { num, total } = extractNumTotal(clean);
    const lineOut = `#N${num}.${total}(${inside})`;

    for (const key of cards) results.push({ key, line: lineOut });
  }

  if (!results.length) return "(Aucune main valide trouvée dans la 1ère parenthèse)";

  const normOrder = ORDER_6A.map(normalize);
  results.sort((a, b) => normOrder.indexOf(normalize(a.key)) - normOrder.indexOf(normalize(b.key)));

  const out = [];
  let currentKey = null, bucket = new Set();
  const flush = () => {
    if (currentKey) { out.push(currentKey, ...bucket, ""); }
  };
  for (const r of results) {
    if (r.key !== currentKey) { flush(); currentKey = r.key; bucket = new Set(); }
    bucket.add(r.line);
  }
  flush();
  return out.join("\n").trim();
}

/* -------- routes -------- */
app.post("/process", (req, res) => {
  try {
    res.json({ success: true, result: analyzeHandsDeterministic(req.body.data || "") });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post("/ask", async (req, res) => {
  const { data, question } = req.body || {};
  const q = normalize(question || "").toLowerCase();

  if (q.startsWith("analyse ces mains")) {
    try {
      return res.type("text/plain; charset=utf-8").send(analyzeHandsDeterministic(data || ""));
    } catch (err) {
      return res.status(500).type("text/plain").send("Erreur analyse: " + err.message);
    }
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
