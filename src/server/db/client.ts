import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connect(url: string) {
  return drizzle(postgres(url, { prepare: false, max: 3 }), { schema });
}

let database: ReturnType<typeof connect> | undefined;

export function getDatabase() {
  if (database) return database;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for hosted variant persistence.");
  database = connect(url);
  return database;
}
