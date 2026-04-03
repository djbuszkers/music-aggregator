import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const id = parseInt(process.argv[2], 10);
if (isNaN(id)) {
  console.error("Usage: npx tsx scripts/delete-release.ts <id>");
  process.exit(1);
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const result = await db.execute({ sql: "DELETE FROM releases WHERE id = ?", args: [id] });
  if ((result.rowsAffected ?? 0) > 0) {
    console.log(`Deleted release ${id}`);
  } else {
    console.log(`Release ${id} not found`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
