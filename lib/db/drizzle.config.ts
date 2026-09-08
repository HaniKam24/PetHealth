import { defineConfig } from "drizzle-kit";
import path from "path";
import { config } from "dotenv";

config({ path: path.join(__dirname, "../../.env"), quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // drizzle-kit resolves this via fast-glob, which requires forward slashes
  // even on Windows — a plain path.join here leaves backslashes and silently
  // matches zero files ("No schema files found for path config").
  schema: path.join(__dirname, "./src/schema/index.ts").split(path.sep).join("/"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
