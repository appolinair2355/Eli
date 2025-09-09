import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static("public"));

// Route Chat normal
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Tu es un assistant utile qui répond clairement en français." },
          { role: "user", content: question }
        ]
      })
    });

    const data = await response.json();
    res.json({ answer: data.choices[0].message.content });

  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

// Route Traitement des cartes
app.post("/traiter", async (req, res) => {
  try {
    const { texte } = req.body;

    const instruction = `
Tu reçois du texte contenant des balises et des parenthèses. 
Ta tâche est de :
1. Supprimer toutes les balises (#N...) et les deuxièmes parenthèses.
2. Garder les cartes sous forme valeur+symbole (ex: 5♣, 10♦, K♥).
3. Classer les cartes par ordre croissant (2 → A).
4. Afficher clairement les mains extraites puis la liste finale triée.

Exemple :
Entrée brute :
#N1234.4(J♦5♣Q♥)

Résultat attendu :
Mains extraites :
1. J♦, 5♣, Q♥

Liste finale triée :
- 5♣
- J♦
- Q♥
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: instruction },
          { role: "user", content: texte }
        ]
      })
    });

    const data = await response.json();
    res.json({ resultat: data.choices[0].message.content });

  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

app.listen(port, () => {
  console.log(`✅ Serveur en ligne sur http://localhost:${port}`);
});
