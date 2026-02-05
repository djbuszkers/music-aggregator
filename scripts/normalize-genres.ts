import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'data', 'music.db'));

function normalizeGenre(genre: string | null): string | null {
  if (!genre) return null;

  const genres = genre
    .split(/[;/,]/)
    .map(g => g.trim())
    .filter(g => g.length > 0)
    .map(g => g.toUpperCase())
    .filter((g, i, arr) => arr.indexOf(g) === i);

  return genres.length > 0 ? genres.join(', ') : null;
}

// Get all releases with genres
const releases = db.prepare('SELECT id, genre FROM releases WHERE genre IS NOT NULL').all() as { id: number; genre: string }[];

const update = db.prepare('UPDATE releases SET genre = ? WHERE id = ?');

let updated = 0;
for (const release of releases) {
  const normalized = normalizeGenre(release.genre);
  if (normalized !== release.genre) {
    update.run(normalized, release.id);
    updated++;
    console.log(`${release.genre} -> ${normalized}`);
  }
}

console.log(`\nUpdated ${updated} releases`);
db.close();
