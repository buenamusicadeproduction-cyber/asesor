import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Inicializa Google Gemini correctamente
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Endpoint IA
app.post("/ia", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Mensaje vacío." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: message }]
        }
      ]
    });

    const output = result.response.text();
    res.json({ reply: output });

  } catch (error) {
    console.error("ERROR EN IA:", error);
    res.status(500).json({ reply: "Error en el servidor IA." });
  }
});

// Puerto
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor IA funcionando en puerto " + PORT));
