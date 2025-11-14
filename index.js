import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Inicializa Gemini correctamente
const genAI = new GoogleGenerativeAI(process.env.example);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash"
});

// Función correcta para llamar al modelo
async function callGemini(prompt) {
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

app.post("/api/interpret", async (req, res) => {
  try {
    const text = req.body.text || "";

    const prompt = `
Eres un asistente que analiza una instrucción en español y devuelves únicamente un JSON con estos campos:
- title (string)
- datetime (ISO string o null)
- duration_min (integer o null)
- urgency (1-5)
- action ("create"|"update"|"cancel")
- clarify (array)

Devuelve SOLO el JSON.

Frase del usuario: "${text}"
`;

    const output = await callGemini(prompt);

    let parsed;
    try {
      parsed = JSON.parse(output);
    } catch {
      const m = output.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { raw: output };
    }

    res.json({ ok: true, parsed });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Servidor Gemini escuchando en puerto", PORT));
