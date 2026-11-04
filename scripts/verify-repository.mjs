import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const forbiddenPaths = [
  /(^|\/)\.DS_Store$/,
  /(^|\/)\.env(?!\.example$)/,
  /(^|\/)(node_modules|\.next|out|coverage|playwright-report)(\/|$)/,
  /(^|\/)(build|dist)(\/|$)/,
];
const forbiddenTracked = tracked.filter((path) => forbiddenPaths.some((pattern) => pattern.test(path)));

if (forbiddenTracked.length > 0) {
  throw new Error(`Generated, local, or secret-prone files are tracked:\n${forbiddenTracked.join("\n")}`);
}

const textNames = new Set(["Dockerfile", "compose.yaml", ".env.example", ".gitignore", ".dockerignore"]);
const textExtensions = new Set([".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".ts", ".tsx", ".txt", ".yaml", ".yml"]);
const sensitivePatterns = [
  { label: "macOS personal path", pattern: /\/Users\/[A-Za-z0-9._-]+\// },
  { label: "Linux personal path", pattern: /\/home\/[A-Za-z0-9._-]+\// },
  { label: "Windows personal path", pattern: /[A-Za-z]:\\Users\\[^\\\s]+\\/ },
  { label: "private key", pattern: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/ },
];

for (const path of tracked) {
  if (!textNames.has(path) && !textExtensions.has(extname(path))) continue;
  const content = await readFile(path, "utf8");
  for (const { label, pattern } of sensitivePatterns) {
    if (pattern.test(content)) throw new Error(`${path} contains a ${label}.`);
  }
}

const dockerfile = await readFile("Dockerfile", "utf8");
const workspaceCopy = dockerfile.indexOf("COPY packages/rules/package.json packages/rules/package.json");
const cleanInstall = dockerfile.indexOf("RUN npm ci");

if (workspaceCopy < 0 || cleanInstall < 0 || workspaceCopy > cleanInstall) {
  throw new Error("Docker dependencies must copy the rules workspace manifest before npm ci.");
}

console.log(`Repository hygiene passed for ${tracked.length} tracked files.`);
