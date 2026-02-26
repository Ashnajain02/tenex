import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

export const createTangentSchema = z.object({
  parentThreadId: z.string().min(1),
  highlightedText: z.string().min(1).max(5000),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(50000),
  role: z.enum(["USER", "ASSISTANT", "SYSTEM"]).default("USER"),
});

export const chatRequestSchema = z.object({
  threadId: z.string().min(1),
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant", "system"]),
      parts: z.array(
        z.object({
          type: z.string(),
          text: z.string().optional(),
        })
      ),
    })
  ),
});
