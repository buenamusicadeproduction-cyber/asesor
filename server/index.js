import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Inicializa Gemini (usa GEMINI_API_KEY en las env vars)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

// Helper para llamar al modelo (compatibilidad ligera)
async function callGemini(prompt) {
  if (!model) throw new Error("Cliente Gemini no inicializado. Comprueba la dependencia @google/generative-ai y la API key.");
  const result = await model.generateContent({
    input: prompt
  });
  if (result?.response?.text) return result.response.text();
  if (typeof result === 'string') return result;
  return JSON.stringify(result);
}

app.post("/api/interpret", async (req, res) => {
  try {
    const text = req.body.text || "";
    const prompt = `
Eres un asistente que analiza una instrucción en español y devuelves únicamente un JSON con estos campos:
- title (string): texto breve de la tarea
- datetime (ISO datetime string) o null
- duration_min (integer minutes) o null
- urgency (1-5)
- action ("create"|"update"|"cancel")
- clarify (array de {field, reason, question}) si hay dudas

Devuelve SOLO el JSON. Ejemplo:
{"title":"Recoger a mamá","datetime":"2025-11-12T16:10:00","duration_min":30,"urgency":4,"action":"create","clarify":[]}

Frase del usuario: "${text}"
`;
    const out = await callGemini(prompt);
    let parsed;
    try {
      parsed = JSON.parse(out);
    } catch (err) {
      const m = out.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else parsed = { raw: out };
    }
    res.json({ ok: true, parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Servidor Gemini escuchando en puerto", PORT));
