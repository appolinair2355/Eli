const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // tes fichiers HTML dans /public

const LICENCE_FILE = path.join(__dirname, "licences.json");

// ----------- API : Vérifier une licence -----------
app.post("/api/check-licence", (req, res) => {
  try {
    const { licence } = req.body;
    if (!licence) {
      return res.json({ valid: false, message: "Licence manquante." });
    }

    const licences = JSON.parse(fs.readFileSync(LICENCE_FILE, "utf8"));
    const found = licences.find(l => l.key === licence);

    if (!found) {
      return res.json({ valid: false, message: "Licence invalide !" });
    }

    if (!found.active) {
      return res.json({ valid: false, message: "Licence désactivée." });
    }

    if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
      return res.json({ valid: false, message: "Licence expirée." });
    }

    return res.json({ valid: true });
  } catch (err) {
    console.error("Erreur check-licence:", err);
    return res.status(500).json({ valid: false, message: "Erreur serveur." });
  }
});

// ----------- API : Liste des licences -----------
app.get("/api/licences", (req, res) => {
  try {
    const licences = JSON.parse(fs.readFileSync(LICENCE_FILE, "utf8"));
    res.json(licences);
  } catch (err) {
    console.error("Erreur lecture licences.json:", err);
    res.status(500).json({ message: "Impossible de charger les licences." });
  }
});

// ----------- API : Générer une nouvelle licence (admin seulement) -----------
app.post("/api/add-licence", (req, res) => {
  try {
    const { key, categorie, expiresAt } = req.body;
    if (!key) return res.status(400).json({ message: "Clé de licence manquante." });

    let licences = JSON.parse(fs.readFileSync(LICENCE_FILE, "utf8"));

    // Vérifier si existe déjà
    if (licences.find(l => l.key === key)) {
      return res.status(400).json({ message: "Cette licence existe déjà." });
    }

    const newLicence = {
      key,
      categorie: categorie || "Standard",
      active: true,
      expiresAt: expiresAt || null
    };

    licences.push(newLicence);
    fs.writeFileSync(LICENCE_FILE, JSON.stringify(licences, null, 2));

    res.json({ message: "Licence ajoutée avec succès", licence: newLicence });
  } catch (err) {
    console.error("Erreur add-licence:", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// ----------- Démarrage du serveur -----------
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
