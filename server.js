import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ----- memoria persistente en RAM -----
let agendaPersistente = [];

// helper para formatear la agenda como contexto
function agendaToContext() {
  if (agendaPersistente.length === 0) return "Agenda vacía.";
  return agendaPersistente
    .map((t) => `${t.fecha} ${t.hora} — ${t.titulo}: ${t.texto}`)
    .join("\n");
}

app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ text: "Falta prompt" });

  try {
    // enviamos al modelo el contexto con toda la agenda
    const mensaje =
      "Contexto de agenda del usuario:\n" +
      agendaToContext() +
      "\n\n" +
      "Cuando el usuario te pida crear o modificar eventos, responde así:\n" +
      "1) Tu respuesta normal para mostrar al usuario.\n" +
      "2) Al final incluye SOLO UN bloque JSON con esta forma exacta si procede:\n" +
      `{
  "fecha":"AAAA-MM-DD",
  "hora":"HH:MM",
  "titulo":"Texto corto",
  "texto":"Descripción breve"
}\n` +
      "\nUsuario: " +
      prompt;

    const response = await fetch(
      `${GEMINI_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: mensaje }] }],
        }),
      }
    );

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts;
    const text = parts?.map((p) => p.text).join(" ") || "(Sin respuesta)";

    // ----- buscar JSON de nueva tarea -----
    let nuevasTareas = [];
    const match = text.match(/\{[\s\S]*\}/); // primer bloque JSON
    if (match) {
      try {
        const tarea = JSON.parse(match[0]);
        nuevasTareas = Array.isArray(tarea) ? tarea : [tarea];
      } catch (e) {
        console.log("JSON ignorado:", e);
      }
    }

    // ----- si hay nuevas tareas, guardarlas -----
    if (nuevasTareas.length > 0) {
      agendaPersistente = agendaPersistente.concat(nuevasTareas);
      // ordenar
      agendaPersistente.sort((a, b) => {
        const t1 = new Date(`${a.fecha}T${a.hora}`);
        const t2 = new Date(`${b.fecha}T${b.hora}`);
        return t1 - t2;
      });
    }

    // el texto mostrado al usuario se limpia de JSON
    const textoLimpio = text.replace(/\{[\s\S]*\}/, "").trim();

    res.json({
      text: textoLimpio,
      agenda: agendaPersistente,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ text: "Error interno del servidor" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Servidor proxy listo en puerto ${PORT}`)
);
