/*import express from 'express';
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
app.listen(PORT, ()=>console.log(`Servidor proxy listo en puerto ${PORT}`));*/

// server.js - ES Module
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Agenda persistente en memoria
let agendaPersistente = [];

/**
 * POST /api/generate
 * Recibe { prompt } del cliente.
 * Llama a Gemini y devuelve { text, agenda }.
 * Gemini puede devolver nuevas tareas en JSON en la respuesta.
 */
app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;

  try {
    // Incluimos la agenda actual en el contexto
    const contextText = agendaPersistente
      .map(t => `${t.fecha} ${t.hora}: ${t.titulo} - ${t.texto}`)
      .join('\n');

    const gRes = await fetch('https://api.ai.google/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        input: `Contexto de agenda:\n${contextText}\n\nUsuario: ${prompt}`
      })
    });

    const json = await gRes.json();
    const respuesta = json.output_text || 'Respuesta de Gemini';

    // Intentamos parsear tareas nuevas si Gemini devuelve JSON
    let nuevasTareas = [];
    try {
      const match = respuesta.match(/\{.*\}/s); // busca JSON en la respuesta
      if(match){
        const tarea = JSON.parse(match[0]);
        if(Array.isArray(tarea)) nuevasTareas = tarea;
        else nuevasTareas = [tarea];
      }
    } catch(e){
      nuevasTareas = [];
    }

    // Añadir nuevas tareas a la agenda y ordenar cronológicamente
    if(nuevasTareas.length > 0){
      agendaPersistente = agendaPersistente.concat(nuevasTareas);
      agendaPersistente.sort((a,b)=>{
        const t1 = new Date(`${a.fecha}T${a.hora}`);
        const t2 = new Date(`${b.fecha}T${b.hora}`);
        return t1 - t2;
      });
    }

    // Devolver texto de Gemini + agenda actualizada
    res.json({
      text: respuesta.replace(/\{.*\}/s, '').trim(),
      agenda: agendaPersistente
    });

  } catch(err){
    console.error('Error en /api/generate:', err);
    res.status(500).send('Error en el servidor: ' + err.toString());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy Gemini corriendo en puerto ${PORT}`));
