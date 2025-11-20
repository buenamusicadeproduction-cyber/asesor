import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors()); // <---- habilita CORS
app.use(express.json());

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  if(!prompt) return res.status(400).json({ text: 'Falta prompt' });

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();

    const parts = data.candidates?.[0]?.content?.parts;
    const text = parts?.map(p => p.text).join(" ") || "(Sin respuesta)";

    res.json({ text });
  } catch(err) {
    console.error(err);
    res.status(500).json({ text: 'Error interno del servidor' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Servidor proxy listo en puerto ${PORT}`));


