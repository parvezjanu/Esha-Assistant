import { useState } from "react";
import { AppMode, ThemeColor } from "./types";
import { VoiceMode } from "./components/VoiceMode";
import { TextMode } from "./components/TextMode";
import { Mic, MessageSquare, Palette, Sparkles } from "lucide-react";

export default function App() {
  const [mode, setMode] = useState<AppMode>("voice");
  const [theme, setTheme] = useState<ThemeColor>("pink");

  // Get dynamic styles depending on active theme color aura
  const getThemeStyles = (col: ThemeColor) => {
    switch (col) {
      case "pink":
        return {
          glowText: "text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.7)]",
          bgOverlay: "from-pink-950/10",
          borderActive: "border-pink-500 text-pink-400 bg-pink-500/10",
          badgeColor: "bg-pink-500/20 text-pink-300 border-pink-500/30",
        };
      case "blue":
        return {
          glowText: "text-sky-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.7)]",
          bgOverlay: "from-sky-950/10",
          borderActive: "border-sky-500 text-sky-400 bg-sky-500/10",
          badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
        };
      case "green":
        return {
          glowText: "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]",
          bgOverlay: "from-emerald-950/10",
          borderActive: "border-emerald-500 text-emerald-400 bg-emerald-500/10",
          badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        };
      case "purple":
        return {
          glowText: "text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]",
          bgOverlay: "from-violet-950/10",
          borderActive: "border-violet-500 text-violet-400 bg-violet-500/10",
          badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
        };
    }
  };

  const styles = getThemeStyles(theme);

  return (
    <div className={`relative min-h-screen bg-[#070a13] text-slate-100 flex flex-col overflow-hidden transition-all duration-1000 bg-gradient-to-b ${styles.bgOverlay} to-[#070a13]`}>
      
      {/* Background Decorative Grid Line overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0b_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Futuristic Header */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-slate-400 absolute animate-pulse" />
            <div className={`h-8 w-8 rounded-lg border border-slate-800 flex items-center justify-center bg-slate-900/60 font-mono text-sm font-black`}>
              E
            </div>
          </div>
          
          <div className="flex flex-col">
            <h1 className={`text-2xl font-black tracking-[0.2em] font-sans ${styles.glowText}`}>
              ESHA
            </h1>
            <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">
              Neural Synapse V2.1
            </span>
          </div>
        </div>

        {/* Dual Mode Switcher */}
        <div className="flex bg-slate-950 border border-slate-800/80 rounded-full p-1 max-w-xs shrink-0 shadow-inner">
          <button
            onClick={() => setMode("voice")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
              mode === "voice"
                ? `${styles.borderActive} font-extrabold shadow-sm`
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Voice Link</span>
          </button>
          
          <button
            onClick={() => setMode("text")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
              mode === "text"
                ? `${styles.borderActive} font-extrabold shadow-sm`
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Text Chat</span>
          </button>
        </div>

        {/* Theme Aura Toggle / Color Indicator */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 bg-slate-950/60 border border-slate-900 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-500">
            <Palette className="h-3.5 w-3.5 text-slate-400" />
            <span>Aura:</span>
            <span className="font-bold text-slate-300 capitalize">{theme}</span>
          </div>
          
          <div className="flex gap-1">
            {(["pink", "blue", "green", "purple"] as ThemeColor[]).map((col) => (
              <button
                key={col}
                onClick={() => setTheme(col)}
                style={{
                  backgroundColor:
                    col === "pink"
                      ? "#ec4899"
                      : col === "blue"
                        ? "#0ea5e9"
                        : col === "green"
                          ? "#10b981"
                          : "#8b5cf6",
                }}
                className={`h-3.5 w-3.5 rounded-full border cursor-pointer transition-all duration-300 hover:scale-125 ${
                  theme === col ? "border-white scale-110 ring-2 ring-slate-800" : "border-transparent opacity-60"
                }`}
                title={`Switch aura to ${col}`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Main Interactive Stage */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center w-full">
        {mode === "voice" ? (
          <VoiceMode theme={theme} onThemeChange={setTheme} />
        ) : (
          <TextMode theme={theme} />
        )}
      </main>
    </div>
  );
}
