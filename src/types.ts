export type AppMode = "voice" | "text";

export type ThemeColor = "pink" | "blue" | "green" | "purple";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

export type LiveState = "idle" | "connecting" | "listening" | "speaking";

export interface ToolLog {
  id: string;
  name: string;
  args: any;
  status: "executing" | "completed" | "failed";
  timestamp: Date;
  explanation?: string;
}
