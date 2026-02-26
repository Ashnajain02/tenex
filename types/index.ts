export type ThreadStatus = "ACTIVE" | "MERGED" | "ARCHIVED";
export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export interface Thread {
  id: string;
  conversationId: string;
  parentThreadId: string | null;
  parentMessageId: string | null;
  highlightedText: string | null;
  status: ThreadStatus;
  depth: number;
  createdAt: Date;
  mergedAt: Date | null;
}

export interface Message {
  id: string;
  threadId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
}

export interface MergeEvent {
  id: string;
  sourceThreadId: string;
  targetThreadId: string;
  afterMessageId: string;
  summary: string | null;
  createdAt: Date;
}

export interface TangentWindowState {
  threadId: string;
  parentThreadId: string;
  parentMessageId: string;
  highlightedText: string;
  depth: number;
}
