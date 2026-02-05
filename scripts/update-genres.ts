import { createClient } from "@libsql/client";
import { normalizeGenre } from "../src/lib/utils";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://music-aggregator-djbuszkers.aws-eu-west-1.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function updateGenres() {
  console.log("Fetching all releases...");
  
  const result = await db.execute("SELECT id, genre FROM releases WHERE genre IS NOT NULL");
  
  console.log(`Found ${result.rows.length} releases with genres`);
  
  let updated = 0;
  let unchanged = 0;
  let cleared = 0;
  
  for (const row of result.rows) {
    const id = row.id as number;
    const oldGenre = row.genre as string;
    const newGenre = normalizeGenre(oldGenre);
    
    if (newGenre === oldGenre) {
      unchanged++;
      continue;
    }
    
    if (newGenre === null) {
      console.log(`[CLEAR] ID ${id}: "${oldGenre}" → null`);
      cleared++;
    } else {
      console.log(`[UPDATE] ID ${id}: "${oldGenre}" → "${newGenre}"`);
      updated++;
    }
    
    await db.execute({
      sql: "UPDATE releases SET genre = ? WHERE id = ?",
      args: [newGenre, id],
    });
  }
  
  console.log("\n--- Summary ---");
  console.log(`Updated: ${updated}`);
  console.log(`Cleared (no valid genres): ${cleared}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Total processed: ${result.rows.length}`);
}

updateGenres()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
