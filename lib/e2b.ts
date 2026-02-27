import { Sandbox, type CommandHandle } from "@e2b/code-interpreter";

interface ProcessInfo {
  handle: CommandHandle;
  logFile: string;
  port: number;
}

interface SandboxEntry {
  sandbox: Sandbox;
  lastUsed: number;
  /** Background processes (dev servers, etc.) keyed by PID */
  processes: Map<number, ProcessInfo>;
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

const SANDBOX_TIMEOUT_MS = 5 * 60 * 1000; // 5 min idle
const CLEANUP_INTERVAL_MS = 60 * 1000; // sweep every 1 min

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
    processes: new Map(),
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

/** Get sandbox info (active status, ID). */
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
    const msg = err instanceof Error ? err.message : String(err);
    const errName = err instanceof Error ? err.constructor.name : "";

    // CommandExitError = command ran but exited non-zero — this is normal, not a dead sandbox
    if (errName === "CommandExitError" || msg.includes("exit status")) {
      // Extract result from the error if available
      const cmdErr = err as { result?: { stdout: string; stderr: string; exitCode: number } };
      if (cmdErr.result) {
        return {
          stdout: cmdErr.result.stdout || "",
          stderr: cmdErr.result.stderr || "",
          exitCode: cmdErr.result.exitCode ?? 1,
        };
      }
      return { stdout: "", stderr: msg, exitCode: 1 };
    }

    // Bad cwd, invalid args — return as failed command, don't retry
    if (msg.includes("does not exist") || msg.includes("invalid_argument") || msg.includes("InvalidArgumentError") || msg.includes("not_found")) {
      return { stdout: "", stderr: msg, exitCode: 1 };
    }

    // Otherwise sandbox may have died — retry once with a fresh sandbox
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

/** Start a long-running server process in the background and return a public URL. */
export async function startServer(
  conversationId: string,
  command: string,
  port: number = 3000,
  cwd?: string
): Promise<{ url: string; pid: number; logs: string; listening: boolean }> {
  const sandbox = await getSandbox(conversationId);
  const entry = sandboxes.get(conversationId)!;

  // Redirect all output to a log file so we can read it later
  const logFile = `/tmp/server-${port}-${Date.now()}.log`;
  const escapedCmd = command.replace(/'/g, "'\"'\"'");
  const handle = await sandbox.commands.run(
    `bash -c '${escapedCmd} >${logFile} 2>&1'`,
    { background: true, cwd }
  );

  entry.processes.set(handle.pid, { handle, logFile, port });

  // Wait for server to start (5s gives most servers enough time)
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Check if the port is actually listening
  let listening = false;
  try {
    const check = await sandbox.commands.run(
      `ss -tlnp 2>/dev/null | grep -q ':${port} ' && echo UP || echo DOWN`,
      { requestTimeoutMs: 5000 }
    );
    listening = check.stdout.trim() === "UP";
  } catch {
    // ss check failed — continue anyway
  }

  // Read whatever startup logs we have
  let logs = "";
  try {
    logs = await sandbox.files.read(logFile, { format: "text" });
  } catch {
    // log file may not exist yet
  }

  const host = sandbox.getHost(port);
  return {
    url: `https://${host}`,
    pid: handle.pid,
    logs: logs.slice(0, 3000) || "(no output captured yet)",
    listening,
  };
}

/** Get the public URL for a port already running in the sandbox. */
export async function getPreviewUrl(
  conversationId: string,
  port: number
): Promise<string> {
  const sandbox = await getSandbox(conversationId);
  const host = sandbox.getHost(port);
  return `https://${host}`;
}

/** Read the captured logs for a background server process. */
export async function getServerLogs(
  conversationId: string,
  pid: number
): Promise<{ logs: string; running: boolean }> {
  const sandbox = await getSandbox(conversationId);
  const entry = sandboxes.get(conversationId);
  const proc = entry?.processes.get(pid);

  // Read log file if we know it
  let logs = "";
  if (proc?.logFile) {
    try {
      logs = await sandbox.files.read(proc.logFile, { format: "text" });
    } catch {
      logs = "(could not read log file)";
    }
  }

  // Check if process is still running
  let running = false;
  try {
    const check = await sandbox.commands.run(`kill -0 ${pid} 2>/dev/null && echo YES || echo NO`, {
      requestTimeoutMs: 5000,
    });
    running = check.stdout.trim() === "YES";
  } catch {
    // assume dead
  }

  return { logs: logs.slice(0, 5000) || "(no output)", running };
}

/** Kill a background process by PID. */
export async function killProcess(
  conversationId: string,
  pid: number
): Promise<boolean> {
  const sandbox = await getSandbox(conversationId);
  const entry = sandboxes.get(conversationId);
  entry?.processes.delete(pid);
  return await sandbox.commands.kill(pid);
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
