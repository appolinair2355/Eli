const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public")); // chat.html, cle.html

const LICENCES_FILE = path.join(__dirname, "licences.json");

// Durée des catégories en millisecondes
const DURATIONS = {
  "10min": 10 * 60 * 1000,
  "30min": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "20h": 20 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000
};

// Charger licences
function loadLicences() {
  if (!fs.existsSync(LICENCES_FILE)) return { licences: [] };
  return JSON.parse(fs.readFileSync(LICENCES_FILE, "utf-8"));
}

// Sauvegarder licences
function saveLicences(data) {
  fs.writeFileSync(LICENCES_FILE, JSON.stringify(data, null, 2));
}

// Générer une nouvelle licence aléatoire
function generateLicence(category) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const random3 = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  const random6 = Array.from({ length: 6 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  const hour = new Date().getHours();
  return `${hour}2025${random3}Sossoufi#@${random6}`;
}

// Vérifier les expirations → remplacer par nouvelles
function checkExpirations() {
  const data = loadLicences();
  let changed = false;

  data.licences.forEach((lic) => {
    if (lic.status === "used" && lic.startTime && lic.durationMs) {
      const endTime = lic.startTime + lic.durationMs;
      if (Date.now() > endTime) {
        // Expirée → remplacer par une nouvelle
        lic.code = generateLicence(lic.category);
        lic.status = "available";
        delete lic.startTime;
        delete lic.durationMs;
        changed = true;
      }
    }
  });

  if (changed) saveLicences(data);
}

// Vérifier licence utilisateur
app.post("/api/check-licence", (req, res) => {
  const { licence } = req.body;
  const data = loadLicences();
  const lic = data.licences.find((l) => l.code === licence);

  if (!lic) return res.json({ valid: false, message: "Licence invalide ❌" });

  if (lic.status === "used") return res.json({ valid: false, message: "Licence déjà utilisée ❌" });

  if (lic.status === "available") {
    lic.status = "used";
    lic.startTime = Date.now();
    lic.durationMs = DURATIONS[lic.category];
    saveLicences(data);
    return res.json({ valid: true, message: "Licence activée ✅", duration: lic.durationMs });
  }

  res.json({ valid: false, message: "Licence invalide ❌" });
});

// Forcer régénération (admin)
app.get("/generate-licences", (req, res) => {
  const categories = Object.keys(DURATIONS);
  let licences = [];

  categories.forEach((cat) => {
    for (let i = 0; i < 10; i++) {
      licences.push({
        code: generateLicence(cat),
        category: cat,
        status: "available"
      });
    }
  });

  saveLicences({ licences });
  res.json({ message: "Nouvelles licences générées ✅", licences });
});

// Vérification périodique des expirations
setInterval(checkExpirations, 30 * 1000); // toutes les 30 secondes

// Serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
