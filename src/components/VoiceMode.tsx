import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Power, Globe, Palette, AlertCircle, Sparkles, Volume2 } from "lucide-react";
import { AudioStreamer } from "../lib/audioStreamer";
import { LiveState, ThemeColor, ToolLog } from "../types";

interface VoiceModeProps {
  theme: ThemeColor;
  onThemeChange: (theme: ThemeColor) => void;
}

export const VoiceMode: React.FC<VoiceModeProps> = ({ theme, onThemeChange }) => {
  const [liveState, setLiveState] = useState<LiveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [toolExplanation, setToolExplanation] = useState<string | null>(null);
  const [toolLogs, setToolLogs] = useState<ToolLog[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const audioStreamer = useRef<AudioStreamer | null>(null);
  const speakingTimeout = useRef<NodeJS.Timeout | null>(null);
  const subtitleTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get glow colors based on current theme
  const getThemeColors = (col: ThemeColor) => {
    switch (col) {
      case "pink":
        return {
          primary: "bg-pink-500",
          border: "border-pink-500",
          text: "text-pink-500",
          shadow: "shadow-[0_0_50px_rgba(236,72,153,0.5)]",
          glowClass: "neon-glow-pink",
          ringColor: "rgba(236,72,153,0.2)",
          ringActive: "rgba(236,72,153,0.6)",
        };
      case "blue":
        return {
          primary: "bg-sky-500",
          border: "border-sky-500",
          text: "text-sky-500",
          shadow: "shadow-[0_0_50px_rgba(14,165,233,0.5)]",
          glowClass: "neon-glow-blue",
          ringColor: "rgba(14,165,233,0.2)",
          ringActive: "rgba(14,165,233,0.6)",
        };
      case "green":
        return {
          primary: "bg-emerald-500",
          border: "border-emerald-500",
          text: "text-emerald-500",
          shadow: "shadow-[0_0_50px_rgba(16,185,129,0.5)]",
          glowClass: "neon-glow-green",
          ringColor: "rgba(16,185,129,0.2)",
          ringActive: "rgba(16,185,129,0.6)",
        };
      case "purple":
        return {
          primary: "bg-violet-500",
          border: "border-violet-500",
          text: "text-violet-500",
          shadow: "shadow-[0_0_50px_rgba(139,92,246,0.5)]",
          glowClass: "neon-glow-purple",
          ringColor: "rgba(139,92,246,0.2)",
          ringActive: "rgba(139,92,246,0.6)",
        };
    }
  };

  const colors = getThemeColors(theme);

  useEffect(() => {
    audioStreamer.current = new AudioStreamer();

    return () => {
      disconnectSession();
      if (audioStreamer.current) {
        audioStreamer.current.destroy();
      }
      if (speakingTimeout.current) clearTimeout(speakingTimeout.current);
      if (subtitleTimeout.current) clearTimeout(subtitleTimeout.current);
    };
  }, []);

  const toggleConnection = () => {
    if (liveState === "idle") {
      connectSession();
    } else {
      disconnectSession();
    }
  };

  const connectSession = async () => {
    setLiveState("connecting");
    setErrorMsg(null);
    setSubtitle(null);
    setToolExplanation(null);

    try {
      // Setup browser media recording permissions check
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      setErrorMsg("Microphone permission denied or unavailable.");
      setLiveState("idle");
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/live`;

    console.log("Connecting to WS:", wsUrl);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log("Client WS connection opened");
    };

    ws.current.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "status" && msg.status === "connected") {
          setLiveState("listening");
          // Start recording
          if (audioStreamer.current) {
            await audioStreamer.current.startRecording((base64Chunk) => {
              if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ type: "audio", data: base64Chunk }));
              }
            });
          }
        } else if (msg.type === "error") {
          setErrorMsg(msg.message);
          disconnectSession();
        } else if (msg.type === "geminiMessage") {
          const content = msg.data;

          // 1. Handle Turn Interruptions
          if (content.serverContent?.interrupted) {
            console.log("Model turn interrupted!");
            if (audioStreamer.current) {
              audioStreamer.current.stopPlayback();
            }
            setLiveState("listening");
            setSubtitle("... Interrupted ...");
            if (subtitleTimeout.current) clearTimeout(subtitleTimeout.current);
            subtitleTimeout.current = setTimeout(() => setSubtitle(null), 1500);
            return;
          }

          // 2. Handle Function/Tool Calls
          const toolCall = content.toolCall;
          if (toolCall && toolCall.functionCalls) {
            for (const call of toolCall.functionCalls) {
              handleToolCall(call);
            }
          }

          // 3. Handle Spoken Audio Playback
          const parts = content.serverContent?.modelTurn?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                setLiveState("speaking");
                if (audioStreamer.current) {
                  audioStreamer.current.playPCMChunk(part.inlineData.data);
                }

                // Smooth back-to-listening transition when speech stops
                if (speakingTimeout.current) clearTimeout(speakingTimeout.current);
                speakingTimeout.current = setTimeout(() => {
                  setLiveState("listening");
                }, 1300);
              }

              // Save transcription subtitles if returned by the model
              if (part.text) {
                setSubtitle(part.text);
                if (subtitleTimeout.current) clearTimeout(subtitleTimeout.current);
                subtitleTimeout.current = setTimeout(() => setSubtitle(null), 5000);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    ws.current.onerror = (err) => {
      console.error("WS error:", err);
      setErrorMsg("Neural synapse link interrupted.");
      disconnectSession();
    };

    ws.current.onclose = () => {
      console.log("WS connection closed");
      disconnectSession();
    };
  };

  const disconnectSession = () => {
    setLiveState("idle");
    if (ws.current) {
      if (ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
      ws.current = null;
    }
    if (audioStreamer.current) {
      audioStreamer.current.stopRecording();
      audioStreamer.current.stopPlayback();
    }
    if (speakingTimeout.current) clearTimeout(speakingTimeout.current);
  };

  const handleToolCall = async (call: any) => {
    const { name, args, id } = call;
    const logId = Math.random().toString(36).substring(7);

    // Add log
    const newLog: ToolLog = {
      id: logId,
      name,
      args,
      status: "executing",
      timestamp: new Date(),
      explanation: args.explanation,
    };
    setToolLogs((prev) => [newLog, ...prev.slice(0, 9)]);

    let output: any = { success: true };

    try {
      if (name === "openWebsite") {
        const { url, explanation } = args;
        setToolExplanation(explanation);
        
        // Open the URL securely
        window.open(url, "_blank");
        output = { opened: true, message: `Opened URL: ${url}` };
      } else if (name === "changeTheme") {
        const { theme: targetTheme, explanation } = args;
        setToolExplanation(explanation);
        onThemeChange(targetTheme);
        output = { success: true, theme: targetTheme };
      }

      // Complete log
      setToolLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, status: "completed" } : l))
      );
    } catch (err: any) {
      console.error("Tool execution failed:", err);
      output = { success: false, error: err.message || "Failed execution" };
      setToolLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, status: "failed" } : l))
      );
    }

    // Send toolResponse instantly
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "toolResponse",
          id: id,
          name: name,
          output: output,
        })
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-between flex-1 p-6 w-full max-w-lg mx-auto h-[calc(100vh-120px)]">
      {/* Visual Header / Aura status */}
      <div className="text-center mt-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className={`h-2.5 w-2.5 rounded-full ${liveState === "idle" ? "bg-slate-500 animate-pulse" : liveState === "connecting" ? "bg-amber-400 animate-bounce" : "bg-emerald-400 animate-ping"}`} />
          <span className="text-sm tracking-widest font-mono uppercase opacity-75">
            {liveState === "idle" ? "OFFLINE" : liveState === "connecting" ? "LINKING..." : `LIVE SYSTEM • ${liveState}`}
          </span>
        </div>
        <p className="text-xs text-slate-400 font-mono">
          {liveState === "idle" && "Link state: offline. Tap the core to engage neural sync."}
          {liveState === "connecting" && "Initializing 16kHz audio sync duplex channel..."}
          {liveState === "listening" && "ESHA is listening to your voice..."}
          {liveState === "speaking" && "ESHA is answering..."}
        </p>
      </div>

      {/* Holographic Interactive Orb Stage */}
      <div className="relative flex items-center justify-center my-6 h-64 w-64">
        {/* Pulsing visual halo backgrounds */}
        <AnimatePresence>
          {liveState !== "idle" && (
            <>
              {/* Outer Ring */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: liveState === "speaking" ? [1, 1.35, 1] : [1, 1.15, 1],
                  opacity: liveState === "speaking" ? [0.15, 0.4, 0.15] : [0.1, 0.25, 0.1],
                }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{
                  duration: liveState === "speaking" ? 0.8 : 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className={`absolute inset-0 rounded-full border border-dashed opacity-25 ${colors.border}`}
              />
              
              {/* Dynamic Aura Ring */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{
                  scale: liveState === "listening" ? [1, 1.1, 1] : liveState === "speaking" ? [1, 1.25, 0.9] : 1,
                  opacity: [0.1, 0.3, 0.1],
                }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{
                  duration: liveState === "speaking" ? 0.5 : 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ backgroundColor: colors.ringColor }}
                className="absolute inset-4 rounded-full filter blur-xl"
              />
            </>
          )}
        </AnimatePresence>

        {/* Core Interactive Ring Button */}
        <motion.button
          onClick={toggleConnection}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative z-10 flex items-center justify-center h-40 w-40 rounded-full bg-slate-900 border-2 shadow-inner cursor-pointer transition-all duration-500 ${colors.border} ${liveState !== "idle" ? colors.shadow : "shadow-none"}`}
          id="esha-mic-core"
        >
          {/* Inner core decorative nodes */}
          <div className="absolute inset-2 rounded-full border border-slate-800 flex items-center justify-center">
            {liveState === "idle" && (
              <Power className="h-10 w-10 text-slate-500 group-hover:text-slate-300" />
            )}
            {liveState === "connecting" && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className={`h-12 w-12 rounded-full border-2 border-t-transparent ${colors.border}`}
              />
            )}
            {liveState === "listening" && (
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                className={`flex items-center justify-center h-16 w-16 rounded-full bg-slate-800 ${colors.glowClass}`}
              >
                <Mic className="h-8 w-8 text-white" />
              </motion.div>
            )}
            {liveState === "speaking" && (
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                className={`flex items-center justify-center h-16 w-16 rounded-full bg-slate-800 ${colors.glowClass}`}
              >
                <Volume2 className="h-8 w-8 text-white" />
              </motion.div>
            )}
          </div>
        </motion.button>
      </div>

      {/* Subtitles & Tool Explanations */}
      <div className="w-full text-center h-20 px-2 flex flex-col justify-center items-center">
        <AnimatePresence mode="wait">
          {errorMsg ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-1.5 text-rose-500 text-sm font-mono bg-rose-950/20 px-4 py-2 rounded-lg border border-rose-900/30"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          ) : toolExplanation ? (
            <motion.div
              key={toolExplanation}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-amber-400 text-sm italic font-medium max-w-md px-4 py-1.5 bg-amber-950/10 border border-amber-900/20 rounded-lg"
            >
              <span className="font-mono text-xs uppercase text-amber-500 font-bold block mb-0.5">ESHA Tool Interaction</span>
              "{toolExplanation}"
            </motion.div>
          ) : subtitle ? (
            <motion.div
              key={subtitle}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-white text-base md:text-lg font-medium px-6 py-2 bg-slate-900/40 backdrop-blur rounded-full border border-slate-800/40 shadow-sm"
            >
              {subtitle}
            </motion.div>
          ) : (
            <motion.p
              key="tip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              className="text-xs text-slate-400 font-mono tracking-wide"
            >
              {liveState === "idle" ? "Press the power core to begin..." : "Speak naturally. Interrupt her whenever you want!"}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Futuristic Tool Action Log (Mini Terminal Drawer) */}
      <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 backdrop-blur-md h-36 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className={`h-3.5 w-3.5 ${colors.text}`} />
            <span className="text-xs font-mono font-bold tracking-wider">HOLOGRAPHIC TOOL LOGS</span>
          </div>
          <span className="text-[10px] font-mono opacity-50">SYSTEM ACTIVE</span>
        </div>
        
        <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1.5">
          {toolLogs.length === 0 ? (
            <p className="text-slate-600 italic">No actions executed yet. ESHA can open websites or change UI themes dynamically...</p>
          ) : (
            toolLogs.map((log) => (
              <div key={log.id} className="flex items-start justify-between border-b border-slate-900/50 pb-1">
                <div className="flex-1 min-w-0 pr-2">
                  <span className={`font-bold ${log.status === "completed" ? "text-emerald-400" : log.status === "failed" ? "text-rose-500" : "text-amber-400 animate-pulse"}`}>
                    [{log.name}]
                  </span>{" "}
                  <span className="text-slate-300">
                    {log.name === "openWebsite" ? `url: "${log.args.url}"` : `theme: "${log.args.theme}"`}
                  </span>
                  {log.explanation && (
                    <p className="text-slate-500 italic mt-0.5 font-sans">"{log.explanation}"</p>
                  )}
                </div>
                <span className="text-slate-500 shrink-0 uppercase text-[9px]">
                  {log.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
