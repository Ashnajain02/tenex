import { create } from "zustand";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
}

interface ConversationState {
  conversations: Conversation[];
  loading: boolean;
  fetchConversations: () => Promise<void>;
  addConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  loading: false,

  fetchConversations: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const conversations = await res.json();
        set({ conversations });
      }
    } finally {
      set({ loading: false });
    }
  },

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
    })),

  renameConversation: (id, title) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    })),
}));
