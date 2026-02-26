import { create } from "zustand";

interface ChatState {
  activeThreadId: string | null;
  activeConversationId: string | null;
  setActiveThread: (threadId: string, conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeThreadId: null,
  activeConversationId: null,
  setActiveThread: (threadId, conversationId) =>
    set({ activeThreadId: threadId, activeConversationId: conversationId }),
}));
