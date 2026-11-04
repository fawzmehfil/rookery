import { spawn } from "node:child_process";

const hostname = "127.0.0.1";
const port = process.env.ROOKERY_VERIFY_PORT ?? "3100";
const origin = `http://${hostname}:${port}`;
const output = [];
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  env: {
    ...process.env,
    HOSTNAME: hostname,
    NODE_ENV: "production",
    PORT: port,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (chunk) => output.push(chunk.toString()));
server.stderr.on("data", (chunk) => output.push(chunk.toString()));

try {
  const health = await waitForHealth();
  assertEqual(health.status, "ok", "health status");
  assertEqual(health.service, "rookery-web", "health service");
  await assertPage("/");
  await assertPage("/editor");
  console.log(`Production smoke passed at ${origin}: /api/health, /, /editor`);
} catch (error) {
  const serverOutput = output.join("").trim();
  if (serverOutput) console.error(serverOutput);
  throw error;
} finally {
  await stopServer();
}

async function waitForHealth() {
  let lastError;

  for (let attempt = 1; attempt <= 40; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Production server exited early with code ${server.exitCode}.`);
    }

    try {
      const response = await fetch(`${origin}/api/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2_000),
      });

      if (response.ok) return response.json();
      lastError = new Error(`Health endpoint returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Production server did not become healthy: ${String(lastError)}`);
}

async function assertPage(pathname) {
  const response = await fetch(`${origin}${pathname}`, {
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error(`${pathname} returned unexpected content type ${contentType || "none"}.`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`Unexpected ${label}: expected ${expected}, received ${String(actual)}.`);
  }
}

async function stopServer() {
  if (server.exitCode !== null) return;

  server.kill("SIGTERM");
  const stopped = await Promise.race([
    new Promise((resolve) => server.once("exit", () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 2_000)),
  ]);

  if (!stopped && server.exitCode === null) server.kill("SIGKILL");
}
