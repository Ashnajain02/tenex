import { streamText, generateText, tool, stepCountIs, zodSchema } from "ai";
import { z } from "zod";
import { tavily } from "@tavily/core";
import { chatModel, getSystemPrompt } from "@/lib/ai";
import { auth } from "@/lib/auth";
import { buildContextForThread } from "@/lib/context-builder";
import { prisma } from "@/lib/prisma";
import {
  runCommand,
  readSandboxFile,
  writeSandboxFile,
  listSandboxDir,
} from "@/lib/e2b";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { threadId, messages } = await req.json();

  // Verify thread ownership
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: { conversation: true },
  });

  if (!thread || thread.conversation.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  // Build the full recursive context for this thread
  const contextMessages = await buildContextForThread(threadId);

  // Extract the latest user message from the client payload
  const latestMessage = messages[messages.length - 1];
  const latestContent =
    latestMessage.parts
      ?.filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join("") ||
    latestMessage.content ||
    "";

  // Persist the user message
  await prisma.message.create({
    data: { threadId, role: "USER", content: latestContent },
  });

  // Tavily client — only created if API key is present
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  const tavilyClient = tavilyApiKey ? tavily({ apiKey: tavilyApiKey }) : null;

  const conversationId = thread.conversationId;
  const hasE2B = !!process.env.E2B_API_KEY;

  const result = streamText({
    model: chatModel,
    system: getSystemPrompt(),
    messages: [...contextMessages, { role: "user", content: latestContent }],

    // ── Web search tool ──────────────────────────────────────────────
    tools: {
      webSearch: tool({
        description:
          "Search the web for real-time information. Use this whenever the user asks about current events, recent news, live data, today's date, weather, prices, sports scores, or anything requiring up-to-date knowledge.",
        inputSchema: zodSchema(z.object({
          query: z.string().describe("A clear, concise search query"),
        })),
        execute: async ({ query }: { query: string }) => {
          if (!tavilyClient) {
            return {
              error:
                "Web search is not configured. Add TAVILY_API_KEY to your .env file.",
            };
          }
          try {
            const response = await tavilyClient.search(query, {
              maxResults: 7,
              searchDepth: "advanced",
              includeAnswer: true,
              days: 90,
            });
            return {
              answer: response.answer ?? null,
              results: response.results.slice(0, 5).map((r) => ({
                title: r.title,
                url: r.url,
                snippet: r.content?.slice(0, 1000),
              })),
            };
          } catch {
            return { error: "Search request failed" };
          }
        },
      }),

      // ── Dev environment tools (require E2B_API_KEY) ────────────────
      ...(hasE2B
        ? {
            runCommand: tool({
              description:
                "Run a shell command in the cloud sandbox (e.g. git clone, npm install, pytest, ls, cat). Returns stdout, stderr, and exit code.",
              inputSchema: zodSchema(
                z.object({
                  command: z.string().describe("Shell command to execute"),
                  workingDirectory: z
                    .string()
                    .optional()
                    .describe("Working directory (default: /home/user)"),
                })
              ),
              execute: async ({
                command,
                workingDirectory,
              }: {
                command: string;
                workingDirectory?: string;
              }) => {
                try {
                  return await runCommand(
                    conversationId,
                    command,
                    workingDirectory
                  );
                } catch (err: unknown) {
                  return {
                    stdout: "",
                    stderr:
                      err instanceof Error ? err.message : "Command failed",
                    exitCode: 1,
                  };
                }
              },
            }),

            readFile: tool({
              description:
                "Read a file's contents from the cloud sandbox filesystem.",
              inputSchema: zodSchema(
                z.object({
                  path: z
                    .string()
                    .describe("Absolute path to the file in the sandbox"),
                })
              ),
              execute: async ({ path }: { path: string }) => {
                try {
                  const content = await readSandboxFile(conversationId, path);
                  return { content };
                } catch (err: unknown) {
                  return {
                    error:
                      err instanceof Error ? err.message : "Failed to read file",
                  };
                }
              },
            }),

            writeFile: tool({
              description:
                "Write content to a file in the cloud sandbox. Creates the file and any needed directories if they don't exist.",
              inputSchema: zodSchema(
                z.object({
                  path: z
                    .string()
                    .describe("Absolute path to the file in the sandbox"),
                  content: z.string().describe("File content to write"),
                })
              ),
              execute: async ({
                path,
                content,
              }: {
                path: string;
                content: string;
              }) => {
                try {
                  await writeSandboxFile(conversationId, path, content);
                  return { success: true, path };
                } catch (err: unknown) {
                  return {
                    error:
                      err instanceof Error
                        ? err.message
                        : "Failed to write file",
                  };
                }
              },
            }),

            listDir: tool({
              description:
                "List files and directories at the given path in the cloud sandbox.",
              inputSchema: zodSchema(
                z.object({
                  path: z
                    .string()
                    .describe(
                      "Directory path to list (default: /home/user)"
                    ),
                })
              ),
              execute: async ({ path }: { path: string }) => {
                try {
                  const entries = await listSandboxDir(
                    conversationId,
                    path || "/home/user"
                  );
                  return { entries };
                } catch (err: unknown) {
                  return {
                    error:
                      err instanceof Error
                        ? err.message
                        : "Failed to list directory",
                  };
                }
              },
            }),
          }
        : {}),
    },

    // Allow up to 10 tool-call steps for complex dev workflows
    stopWhen: stepCountIs(10),

    async onFinish({ text }) {
      // Only persist if there is actual assistant text (tool-only steps produce no text)
      if (text) {
        await prisma.message.create({
          data: { threadId, role: "ASSISTANT", content: text },
        });
      }

      // Bump conversation's updatedAt so it surfaces first in the sidebar
      await prisma.conversation.update({
        where: { id: thread.conversationId },
        data: { updatedAt: new Date() },
      });

      // Auto-title: generate a short name after the first exchange on the main thread
      if (thread.depth === 0 && thread.conversation.title === "New Conversation") {
        const msgCount = await prisma.message.count({ where: { threadId } });
        if (msgCount <= 3) {
          try {
            const { text: rawTitle } = await generateText({
              model: chatModel,
              prompt: `In 4 words or fewer, write a short title for a conversation that starts with this message: "${latestContent.slice(0, 300)}". Reply with only the title — no quotes, no punctuation at the end.`,
            });
            const title = rawTitle.trim().replace(/^["']|["']$/g, "").slice(0, 50);
            if (title) {
              await prisma.conversation.update({
                where: { id: thread.conversationId },
                data: { title },
              });
            }
          } catch {
            // silently skip if title generation fails
          }
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
