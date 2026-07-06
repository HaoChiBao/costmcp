#!/usr/bin/env node
/**
 * Regenerate packages/db/src/database.types.ts from Supabase.
 * Requires Supabase MCP or: npx supabase gen types typescript --project-id bylrekkhwcwosdmcgfsg
 */
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const PROJECT_REF = "bylrekkhwcwosdmcgfsg";
const OUT = "packages/db/src/database.types.ts";

try {
  const types = execSync(
    `npx supabase@latest gen types typescript --project-id ${PROJECT_REF}`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  writeFileSync(OUT, types);
  console.log(`Wrote ${OUT}`);
} catch (err) {
  console.error(
    "Failed to generate types. Run `npx supabase login` first, or use Supabase MCP generate_typescript_types.",
  );
  process.exit(1);
}
