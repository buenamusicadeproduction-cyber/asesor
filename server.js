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

// ---------- MEMORIA PERSISTENTE DE LA AGENDA ----------
let agendaPersistente = [];

// ---------- FUNCIONES ----------
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function fechaRelativaToISO(texto) {
  // reemplazo en prompt antes de mandarlo a Gemini
  const hoy = new Date();

  if (/mañana/i.test(texto)) {
    const d = new Date(hoy); d.setDate(hoy.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (/pasado mañana/i.test(texto)) {
    const d = new Date(hoy); d.setDate(hoy.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }

  return null; // si no se detecta nada, se deja a Gemini
}

function agendaToContext() {
  if (agendaPersistente.length === 0) return "Agenda vacía.";
  return agendaPersistente
    .map((t) => `${t.fecha} ${t.hora} — ${t.titulo}: ${t.texto}`)
    .join("\n");
}

function ordenarAgenda() {
  agendaPersistente.sort((a, b) => {
    const t1 = new Date(`${a.fecha}T${a.hora}`);
    const t2 = new Date(`${b.fecha}T${b.hora}`);
    return t1 - t2;
  });
}

// ---------- API ----------
app.post("/api/generate", async (req, res) => {
  let { prompt } = req.body;
  if (!prompt) return res.status(400).json({ text: "Falta prompt" });

  // -------- INTERPRETAR FECHAS RELATIVAS ANTES DE ENVIAR A GEMINI --------
  const fechaRel = fechaRelativaToISO(prompt);
  if (fechaRel) {
    prompt += ` (Interpretado: fecha = ${fechaRel})`;
  }

  // -------- INSTRUCCIONES A GEMINI ----------
  const systemPrompt =
    `Hoy es: ${hoyISO()}

Reglas:
1) Cuando el usuario diga "mañana", "pasado mañana", "el lunes", "el viernes", etc., interpreta usando la fecha REAL de hoy (${hoyISO()}). **No uses 2024.**
2) Si el usuario pide CREAR una cita, al final incluye EXACTAMENTE un bloque JSON con esta forma:
{
  "accion": "crear",
  "fecha": "AAAA-MM-DD",
  "hora": "HH:MM",
  "titulo": "Texto corto",
  "texto": "Descripción breve"
}
3) Si el usuario pide BORRAR una cita, incluye un JSON así:
{
  "accion": "borrar",
  "titulo": "texto para buscar",
  "fecha": "opcional",
  "hora": "opcional"
}
4) No incluyas explicación dentro del JSON.
5) La respuesta normal para el usuario debe ir **antes**, fuera del JSON.
6) No inventes fechas antiguas (como 2024).`;

  const mensaje =
    "Agenda actual del usuario:\n" +
    agendaToContext() +
    "\n\n" +
    systemPrompt +
    "\n\nUsuario: " +
    prompt;

  try {
    // -------- LLAMADA A GEMINI --------
    const response = await fetch(
      `${GEMINI_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: mensaje }] }] }),
      }
    );

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts;
    const fullText =
      parts?.map((p) => p.text).join(" ") || "(Sin respuesta)";

    // -------- EXTRAER JSON --------
    const match = fullText.match(/\{[\s\S]*\}/);
    let accion = null;

    if (match) {
      try {
        accion = JSON.parse(match[0]);
      } catch {}
    }

    // -------- PROCESAR ACCIÓN --------
    if (accion) {
      if (accion.accion === "crear") {
        agendaPersistente.push({
          fecha: accion.fecha,
          hora: accion.hora,
          titulo: accion.titulo,
          texto: accion.texto,
        });
        ordenarAgenda();
      }

      if (accion.accion === "borrar") {
        agendaPersistente = agendaPersistente.filter((t) => {
          // se borra si coincide por título
          const coincideTitulo =
            t.titulo.toLowerCase().includes(
              (accion.titulo || "").toLowerCase()
            );

          const coincideFecha =
            !accion.fecha || t.fecha === accion.fecha;

          const coincideHora =
            !accion.hora || t.hora === accion.hora;

          return !(coincideTitulo && coincideFecha && coincideHora);
        });
      }
    }

    // -------- TEXTO LIMPIO PARA MOSTRAR --------
    const textoLimpio = fullText.replace(/\{[\s\S]*\}/, "").trim();

    res.json({
      text: textoLimpio,
      agenda: agendaPersistente,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ text: "Error interno del servidor" });
  }
});

// ---------- INICIO ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Servidor listo en puerto ${PORT}`)
);
