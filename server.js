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

// server.js
const express = require('express');
const fetch = require('node-fetch'); // o usa el SDK de Gemini si lo prefieres
const cors = require('cors');

const app = express();
app.use(cors()); // permite que el navegador acceda al servidor
app.use(express.json());

let agendaPersistente = []; // agenda global en memoria (persistencia mínima, reinicia al reiniciar servidor)

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;

  try {
    // Llamada a Gemini
    const gRes = await fetch('https://api.ai.google/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        input: prompt,
        // opcional: enviar contexto para memoria básica
        context: agendaPersistente.map(t => `${t.fecha} ${t.hora}: ${t.titulo} - ${t.texto}`)
      })
    });

    const json = await gRes.json();
    const respuesta = json.output_text || 'Respuesta de Gemini';

    // Analizar posibles nuevas tareas que Gemini devuelva
    // Esperamos que Gemini devuelva JSON válido dentro de su respuesta
    // Ejemplo: {"titulo":"Reunión con Juan","fecha":"2025-11-21","hora":"10:00","texto":"Reunión importante"}
    let nuevasTareas = [];
    try {
      const match = respuesta.match(/\{.*\}/s); // busca un JSON en el texto
      if(match){
        const tarea = JSON.parse(match[0]);
        if(Array.isArray(tarea)){
          nuevasTareas = tarea;
        } else {
          nuevasTareas = [tarea];
        }
      }
    } catch(e) {
      // no se encontró JSON válido, se ignora
      nuevasTareas = [];
    }

    // Añadir nuevas tareas a la agenda
    if(nuevasTareas.length > 0){
      agendaPersistente = agendaPersistente.concat(nuevasTareas);
      // opcional: ordenar por fecha/hora
      agendaPersistente.sort((a,b)=>{
        const t1 = new Date(`${a.fecha}T${a.hora}`);
        const t2 = new Date(`${b.fecha}T${b.hora}`);
        return t1-t2;
      });
    }

    // Respuesta final para el cliente
    res.json({
      text: respuesta.replace(/\{.*\}/s, ''), // quitar JSON de la respuesta visible
      agenda: agendaPersistente
    });

  } catch(err){
    console.error(err);
    res.status(500).send('Error en el servidor: ' + err.toString());
  }
});

app.listen(3000, ()=>console.log('Proxy Gemini en puerto 3000'));


