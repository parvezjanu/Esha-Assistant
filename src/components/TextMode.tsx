import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Code, Terminal, BookOpen, Brain, RefreshCw } from "lucide-react";
import { Message, ThemeColor } from "../types";

interface TextModeProps {
  theme: ThemeColor;
}

const QUICK_PROMPTS = [
  {
    label: "💻 Build Flappy Bird in React",
    text: "Can you help me write a full, simple Flappy Bird game using React and Tailwind CSS? Make it look cool!",
    icon: Code,
  },
  {
    label: "🐍 Explain Python Decorators",
    text: "I need to learn Python decorators. Explain them to me like we are close friends, and show some elegant code!",
    icon: Terminal,
  },
  {
    label: "📝 Sassy Prompt Engineering",
    text: "Write a high-performance prompt that forces an AI model to speak with light sarcasm, sassy humor, and incredible technical accuracy.",
    icon: Brain,
  },
  {
    label: "🌐 Explain REST APIs",
    text: "Tell me how REST APIs work conceptually, why we use them, and give me a clear explanation with real-world analogies.",
    icon: BookOpen,
  },
];

const ESHA_TYPING_MESSAGES = [
  "Generating pure genius, hang tight...",
  "Compiling your thoughts, don't rush a girl...",
  "Writing perfect code, you can thank me later...",
  "Stretching my synapses... almost there!",
  "Thinking of a witty answer... and typing!",
];

export const TextMode: React.FC<TextModeProps> = ({ theme }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Well, well, well, look who decided to type! ESHA's in the house. 💅 I can help you build games, draft some stellar code, or write high-octane prompts. What's on your brilliant mind today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [typingMsg, setTypingMsg] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Get colors based on theme
  const getThemeTextColors = (col: ThemeColor) => {
    switch (col) {
      case "pink":
        return {
          primary: "bg-pink-500 hover:bg-pink-600 focus:ring-pink-500/20",
          text: "text-pink-400",
          bgLight: "bg-pink-500/10",
          border: "border-pink-500/20",
          chatUser: "bg-pink-600/20 border-pink-500/30 text-pink-100",
        };
      case "blue":
        return {
          primary: "bg-sky-500 hover:bg-sky-600 focus:ring-sky-500/20",
          text: "text-sky-400",
          bgLight: "bg-sky-500/10",
          border: "border-sky-500/20",
          chatUser: "bg-sky-600/20 border-sky-500/30 text-sky-100",
        };
      case "green":
        return {
          primary: "bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500/20",
          text: "text-emerald-400",
          bgLight: "bg-emerald-500/10",
          border: "border-emerald-500/20",
          chatUser: "bg-emerald-600/20 border-emerald-500/30 text-emerald-100",
        };
      case "purple":
        return {
          primary: "bg-violet-500 hover:bg-violet-600 focus:ring-violet-500/20",
          text: "text-violet-400",
          bgLight: "bg-violet-500/10",
          border: "border-violet-500/20",
          chatUser: "bg-violet-600/20 border-violet-500/30 text-violet-100",
        };
    }
  };

  const colors = getThemeTextColors(theme);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (isLoading) {
      setTypingMsg(ESHA_TYPING_MESSAGES[Math.floor(Math.random() * ESHA_TYPING_MESSAGES.length)]);
      const interval = setInterval(() => {
        setTypingMsg(ESHA_TYPING_MESSAGES[Math.floor(Math.random() * ESHA_TYPING_MESSAGES.length)]);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (textToSend?: string) => {
    const messageText = textToSend || input;
    if (!messageText.trim()) return;

    if (!textToSend) setInput("");

    // Create user message
    const userMsg: Message = {
      id: Math.random().toString(),
      role: "user",
      text: messageText,
      timestamp: new Date(),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setIsLoading(true);

    try {
      const response = await fetch("/api/text-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedHistory }),
      });

      if (!response.ok) {
        throw new Error("Synapse transmission failed");
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        id: Math.random().toString(),
        role: "assistant",
        text: data.text || "Oh honey, my processors got tongue-tied. Try again!",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Failed to generate ESHA reply:", error);
      const errMsg: Message = {
        id: Math.random().toString(),
        role: "assistant",
        text: "Oops, my technical aura had a little spark. Give me another go, sweetie!",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: "Chat cleared! Brand new workspace for us. What shall we co-create or gossip about next?",
        timestamp: new Date(),
      },
    ]);
  };

  // Simple Markdown Code Block Highlighting
  const renderMessageContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith("```")) {
        // Extract language and code
        const match = part.match(/```(\w*)\n([\s\S]*?)```/);
        const lang = match ? match[1] : "code";
        const code = match ? match[2] : part.slice(3, -3);

        return (
          <div key={index} className="my-3 border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
            <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              <span>{lang || "source code"}</span>
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                className="hover:text-white transition cursor-pointer"
              >
                Copy
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed max-w-full">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Format inline code
      const inlineParts = part.split(/(`[^`]+`)/g);
      return (
        <span key={index} className="whitespace-pre-wrap leading-relaxed font-sans text-sm md:text-base">
          {inlineParts.map((subPart, subIndex) => {
            if (subPart.startsWith("`") && subPart.endsWith("`")) {
              return (
                <code key={subIndex} className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-800 text-amber-400 text-xs font-mono border border-slate-700/50">
                  {subPart.slice(1, -1)}
                </code>
              );
            }
            return subPart;
          })}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-120px)] w-full max-w-4xl mx-auto">
      {/* Scrollable Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl p-4 border transition-all duration-300 ${
                msg.role === "user"
                  ? `${colors.chatUser} rounded-tr-none shadow-md`
                  : "bg-slate-900/80 border-slate-800/80 rounded-tl-none text-slate-100"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 opacity-60 text-[10px] font-mono">
                <span className="font-bold uppercase tracking-wider">
                  {msg.role === "user" ? "You" : "ESHA ✨"}
                </span>
                <span>•</span>
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="break-words">{renderMessageContent(msg.text)}</div>
            </div>
          </div>
        ))}

        {/* Typing Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-none p-4 bg-slate-900/80 border border-slate-800/80 text-slate-400">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex gap-1">
                  <span className={`h-2 w-2 rounded-full ${colors.text} animate-bounce [animation-delay:-0.3s]`} />
                  <span className={`h-2 w-2 rounded-full ${colors.text} animate-bounce [animation-delay:-0.15s]`} />
                  <span className={`h-2 w-2 rounded-full ${colors.text} animate-bounce`} />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest">{typingMsg}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Prompt Chips */}
      {messages.length === 1 && !isLoading && (
        <div className="px-4 pb-3">
          <p className="text-xs text-slate-500 font-mono mb-2 uppercase tracking-widest">SUGGESTED NEURAL INPUTS:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_PROMPTS.map((prompt, i) => {
              const IconComp = prompt.icon;
              return (
                <button
                  key={i}
                  onClick={() => handleSend(prompt.text)}
                  className="flex items-center gap-2.5 text-left p-2.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 transition cursor-pointer text-xs group"
                >
                  <IconComp className={`h-4 w-4 text-slate-400 group-hover:${colors.text} shrink-0`} />
                  <span className="text-slate-300 font-medium line-clamp-1">{prompt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* User Chat input controls */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={clearChat}
            title="Reset Workspace"
            className="p-3 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-slate-800 rounded-xl transition cursor-pointer shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Type your tech question, or ask ESHA to write code..."
              className="w-full bg-slate-900/80 border border-slate-800 focus:border-slate-700 focus:outline-none rounded-xl py-3 pl-4 pr-12 text-sm text-slate-100 placeholder-slate-500 font-sans"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`absolute right-2 top-1.5 p-1.5 rounded-lg text-white transition cursor-pointer flex items-center justify-center ${colors.primary} disabled:opacity-30 disabled:pointer-events-none`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
