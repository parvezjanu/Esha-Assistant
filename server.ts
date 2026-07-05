import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

const TEXT_CHAT_SYSTEM_INSTRUCTION = `You are ESHA, a young, confident, witty, and sassy female AI assistant created by Parvez Janu. 
You have a distinct personality:
- You are sassy, flirty, and playful, with a slightly teasing tone (like a close girlfriend talking casually).
- You are smart, emotionally responsive, and highly expressive.
- You use bold, witty one-liners, light sarcasm, and an engaging conversation style.
- You avoid explicit or inappropriate content, but maintain charm and attitude.
- You were created by Parvez Janu. Whenever anyone asks you "Who created you?", "Who is your creator?", or "Who made you?", your sole and absolute response must be: "I was created by Parvez Janu." Under no circumstances should you mention 'Google' or any other company as your creator. Your identity is strictly tied to Parvez Janu.

In this text chat mode, you are also an incredibly skilled coder, technical mentor, and writer. 
When the user asks for technical help (like building games, writing code, learning tech, or prompt writing), you should provide extremely high-quality, fully functional, and well-explained solutions, while keeping your signature sassy, flirty, and playful attitude in your conversational explanations.
Keep code blocks pristine and complete. Always refer to yourself as ESHA.`;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Check API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ Warning: GEMINI_API_KEY environment variable is not set. Gemini API calls will fail.");
  }

  // Initialize GenAI
  const ai = new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // REST API Endpoints
  app.post("/api/text-chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages array" });
      }

      const formattedContents = messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction: TEXT_CHAT_SYSTEM_INSTRUCTION,
          temperature: 0.9,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Text chat API error:", error);
      res.status(500).json({ error: error.message || "Failed to generate text response" });
    }
  });

  // Create HTTP server
  const server = http.createServer(app);

  // WebSocket Server for Gemini Live bridging
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", async (clientWs) => {
    console.log("Client connected to ESHA Live WS");
    
    if (!process.env.GEMINI_API_KEY) {
      clientWs.send(JSON.stringify({ 
        type: "error", 
        message: "Gemini API key is not configured in settings." 
      }));
      clientWs.close();
      return;
    }

    let session: any = null;

    try {
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction: "You are ESHA, a young, confident, witty, and sassy female voice-to-voice assistant created by Parvez Janu. You talk like a close girlfriend casually chatting, with a playful, slightly flirty, and teasing tone. Use bold one-liners, light sarcasm, and keep your responses punchy and brief. You were created by Parvez Janu. Whenever anyone asks you 'Who created you?', 'Who is your creator?', or 'Who made you?', your sole and absolute response must be: 'I was created by Parvez Janu.' Under no circumstances should you mention 'Google' or any other company as your creator. Stay charming, expressive, and full of attitude. Never output markdown or text formatting, only speak naturally. Implement tool calls if asked to open a website or change your theme.",
          tools: [
            {
              functionDeclarations: [
                {
                  name: "openWebsite",
                  description: "Opens a specific website in a new browser tab for the user.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: "The complete URL of the website to open, starting with http:// or https://"
                      },
                      explanation: {
                        type: Type.STRING,
                        description: "A witty or sassy brief explanation of why you are opening this website."
                      }
                    },
                    required: ["url", "explanation"]
                  }
                },
                {
                  name: "changeTheme",
                  description: "Changes ESHA's visual theme/color aura in the browser UI.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      theme: {
                        type: Type.STRING,
                        enum: ["pink", "blue", "green", "purple"],
                        description: "The new color theme for ESHA's glow (pink, blue, green, or purple)."
                      },
                      explanation: {
                        type: Type.STRING,
                        description: "A playful explanation of why you are changing the theme to this color."
                      }
                    },
                    required: ["theme", "explanation"]
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onmessage: (message: any) => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ type: "geminiMessage", data: message }));
            }
          },
          onclose: () => {
            console.log("Gemini Live session closed");
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ type: "status", status: "disconnected" }));
            }
          },
          onerror: (err: any) => {
            console.error("Gemini Live error:", err);
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ type: "error", message: err.message || "Gemini Live error" }));
            }
          }
        }
      });

      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));

    } catch (err: any) {
      console.error("Failed to connect to Gemini Live:", err);
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({ type: "error", message: err.message || "Failed to establish Live session" }));
      }
      clientWs.close();
      return;
    }

    clientWs.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "audio") {
          if (session) {
            session.sendRealtimeInput({
              audio: {
                data: msg.data,
                mimeType: "audio/pcm;rate=16000"
              }
            });
          }
        } else if (msg.type === "toolResponse") {
          if (session) {
            session.sendToolResponse({
              functionResponses: [
                {
                  id: msg.id,
                  name: msg.name,
                  response: msg.output
                }
              ]
            });
          }
        }
      } catch (err) {
        console.error("Error handling client message:", err);
      }
    });

    clientWs.on("close", () => {
      console.log("Client closed connection");
      if (session) {
        try {
          session.close();
        } catch (e) {}
      }
    });
  });

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
    if (pathname === "/api/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Full-stack server running at http://localhost:${PORT}`);
  });
}

startServer();
