import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ESTE ES EL MODELO CORRECTO PARA TU SDK
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post("/ia", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Falta el campo 'message'." });
    }

    // ⭐⭐⭐ ESTA ES LA LINEA CORRECTA ⭐⭐⭐
    const result = await model.generateContent(message);

    const reply = result?.response?.text() || "Sin respuesta del modelo";

    return res.json({ reply });

  } catch (error) {
    console.error("ERROR EN IA:", error);
    res.status(500).json({ reply: "Error en el servidor IA." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("Servidor IA funcionando en puerto " + PORT)
);
