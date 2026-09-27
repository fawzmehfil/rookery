import { cp, mkdir } from "node:fs/promises";

const standaloneRoot = ".next/standalone";

await mkdir(`${standaloneRoot}/.next`, { recursive: true });
await cp(".next/static", `${standaloneRoot}/.next/static`, { recursive: true });
await cp("public", `${standaloneRoot}/public`, { recursive: true });
