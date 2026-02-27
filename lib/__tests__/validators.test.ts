import { describe, it, expect } from "vitest";
import {
  createConversationSchema,
  createTangentSchema,
  sendMessageSchema,
  chatRequestSchema,
} from "../validators";

describe("validators", () => {
  describe("createConversationSchema", () => {
    it("accepts empty object", () => {
      const result = createConversationSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts optional title", () => {
      const result = createConversationSchema.safeParse({ title: "My Chat" });
      expect(result.success).toBe(true);
    });

    it("rejects title over 200 chars", () => {
      const result = createConversationSchema.safeParse({ title: "a".repeat(201) });
      expect(result.success).toBe(false);
    });
  });

  describe("createTangentSchema", () => {
    it("accepts valid tangent input", () => {
      const result = createTangentSchema.safeParse({
        parentThreadId: "thread-123",
        highlightedText: "some interesting text",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty parentThreadId", () => {
      const result = createTangentSchema.safeParse({
        parentThreadId: "",
        highlightedText: "text",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty highlightedText", () => {
      const result = createTangentSchema.safeParse({
        parentThreadId: "thread-123",
        highlightedText: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects highlightedText over 5000 chars", () => {
      const result = createTangentSchema.safeParse({
        parentThreadId: "thread-123",
        highlightedText: "a".repeat(5001),
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing fields", () => {
      const result = createTangentSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("sendMessageSchema", () => {
    it("accepts valid message with default role", () => {
      const result = sendMessageSchema.safeParse({ content: "Hello" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe("USER");
      }
    });

    it("accepts explicit role", () => {
      const result = sendMessageSchema.safeParse({
        content: "Hello",
        role: "ASSISTANT",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty content", () => {
      const result = sendMessageSchema.safeParse({ content: "" });
      expect(result.success).toBe(false);
    });

    it("rejects content over 50000 chars", () => {
      const result = sendMessageSchema.safeParse({ content: "a".repeat(50001) });
      expect(result.success).toBe(false);
    });

    it("rejects invalid role", () => {
      const result = sendMessageSchema.safeParse({
        content: "Hello",
        role: "INVALID",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("chatRequestSchema", () => {
    it("accepts valid chat request", () => {
      const result = chatRequestSchema.safeParse({
        threadId: "thread-123",
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing threadId", () => {
      const result = chatRequestSchema.safeParse({
        messages: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty threadId", () => {
      const result = chatRequestSchema.safeParse({
        threadId: "",
        messages: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid message role", () => {
      const result = chatRequestSchema.safeParse({
        threadId: "thread-123",
        messages: [
          {
            id: "msg-1",
            role: "invalid",
            parts: [],
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});
