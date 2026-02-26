import { Sandbox } from "@e2b/code-interpreter";

interface SandboxEntry {
  sandbox: Sandbox;
  lastUsed: number;
}

// Persist across hot reloads in dev (same pattern as lib/prisma.ts)
const globalForE2B = globalThis as unknown as {
  e2bSandboxes: Map<string, SandboxEntry>;
  e2bCleanupInterval: ReturnType<typeof setInterval> | null;
};

if (!globalForE2B.e2bSandboxes) {
  globalForE2B.e2bSandboxes = new Map();
}

const sandboxes = globalForE2B.e2bSandboxes;

const SANDBOX_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour idle (dev environment)
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000; // sweep every 2 min

/**
 * Get or create a sandbox for a conversation.
 * All threads within the same conversation share one sandbox.
 */
async function getSandbox(conversationId: string): Promise<Sandbox> {
  const existing = sandboxes.get(conversationId);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.sandbox;
  }

  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    throw new Error("E2B_API_KEY is not configured");
  }

  const sandbox = await Sandbox.create({ apiKey });

  sandboxes.set(conversationId, {
    sandbox,
    lastUsed: Date.now(),
  });

  return sandbox;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  textResults: string;
  images: Array<{ format: "png" | "jpeg" | "svg"; data: string }>;
  error: { name: string; message: string; traceback: string } | null;
}

/**
 * Execute Python code in a conversation's sandbox.
 * Handles dead-sandbox recovery transparently.
 */
export async function executeCode(
  conversationId: string,
  code: string
): Promise<ExecutionResult> {
  let sandbox: Sandbox;

  try {
    sandbox = await getSandbox(conversationId);
  } catch (err) {
    return makeError("SandboxError", err);
  }

  try {
    return await runInSandbox(sandbox, code);
  } catch {
    // Sandbox may have died (E2B timeout). Remove stale entry, retry once.
    sandboxes.delete(conversationId);
    try {
      sandbox = await getSandbox(conversationId);
      return await runInSandbox(sandbox, code);
    } catch (retryErr) {
      return makeError("SandboxError", retryErr);
    }
  }
}

async function runInSandbox(
  sandbox: Sandbox,
  code: string
): Promise<ExecutionResult> {
  const execution = await sandbox.runCode(code);

  const images = execution.results
    .filter((r) => r.png || r.jpeg || r.svg)
    .map((r) => {
      if (r.png) return { format: "png" as const, data: r.png };
      if (r.jpeg) return { format: "jpeg" as const, data: r.jpeg };
      if (r.svg) return { format: "svg" as const, data: r.svg };
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const textResults = execution.results
    .filter((r) => r.text)
    .map((r) => r.text)
    .join("\n");

  return {
    stdout: execution.logs.stdout.join("\n"),
    stderr: execution.logs.stderr.join("\n"),
    textResults,
    images,
    error: execution.error
      ? {
          name: execution.error.name,
          message: execution.error.value,
          traceback: execution.error.traceback,
        }
      : null,
  };
}

function makeError(name: string, err: unknown): ExecutionResult {
  return {
    stdout: "",
    stderr: "",
    textResults: "",
    images: [],
    error: {
      name,
      message: err instanceof Error ? err.message : "Unknown error",
      traceback: "",
    },
  };
}

/** Explicitly close a sandbox (e.g. when conversation is deleted). */
export async function closeSandbox(conversationId: string) {
  const entry = sandboxes.get(conversationId);
  if (entry) {
    try {
      await entry.sandbox.kill();
    } catch {
      // sandbox may already be dead
    }
    sandboxes.delete(conversationId);
  }
}

/** Get sandbox info for VS Code connection. */
export async function getSandboxInfo(
  conversationId: string
): Promise<{ sandboxId: string } | null> {
  const entry = sandboxes.get(conversationId);
  if (!entry) return null;
  return { sandboxId: entry.sandbox.sandboxId };
}

/** Run a shell command in the sandbox. */
export async function runCommand(
  conversationId: string,
  cmd: string,
  cwd?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const sandbox = await getSandbox(conversationId);
  try {
    const result = await sandbox.commands.run(cmd, {
      cwd,
      requestTimeoutMs: 120_000,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  } catch (err: unknown) {
    // If sandbox died, retry once
    sandboxes.delete(conversationId);
    const fresh = await getSandbox(conversationId);
    const result = await fresh.commands.run(cmd, {
      cwd,
      requestTimeoutMs: 120_000,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  }
}

/** Read a file from the sandbox. */
export async function readSandboxFile(
  conversationId: string,
  path: string
): Promise<string> {
  const sandbox = await getSandbox(conversationId);
  return await sandbox.files.read(path, { format: "text" });
}

/** Write a file to the sandbox. Creates dirs as needed. */
export async function writeSandboxFile(
  conversationId: string,
  path: string,
  content: string
): Promise<void> {
  const sandbox = await getSandbox(conversationId);
  await sandbox.files.write(path, content);
}

/** List directory contents in the sandbox. */
export async function listSandboxDir(
  conversationId: string,
  path: string
): Promise<Array<{ name: string; type: string }>> {
  const sandbox = await getSandbox(conversationId);
  const entries = await sandbox.files.list(path);
  return entries.map((e) => ({
    name: e.name,
    type: e.type ?? "file",
  }));
}

// Periodic cleanup of idle sandboxes
function startCleanup() {
  if (globalForE2B.e2bCleanupInterval) return;
  globalForE2B.e2bCleanupInterval = setInterval(async () => {
    const now = Date.now();
    for (const [id, entry] of sandboxes.entries()) {
      if (now - entry.lastUsed > SANDBOX_TIMEOUT_MS) {
        try {
          await entry.sandbox.kill();
        } catch {
          // ignore
        }
        sandboxes.delete(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

startCleanup();
