import { createClient, Client } from "@libsql/client";
import type { Source, Release, ReleaseInput } from "./types";

let db: Client | null = null;
let initialized = false;

export function getDb(): Client {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL || "libsql://music-aggregator-djbuszkers.aws-eu-west-1.turso.io",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return db;
}

async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
}

export async function initDb(): Promise<void> {
  const database = getDb();

  await database.execute(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      scraper_type TEXT NOT NULL CHECK(scraper_type IN ('rss', 'cheerio', 'puppeteer')),
      last_fetched TEXT,
      is_active INTEGER DEFAULT 1
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      artist TEXT NOT NULL,
      title TEXT NOT NULL,
      label TEXT,
      genre TEXT,
      cover_image TEXT,
      review_url TEXT NOT NULL UNIQUE,
      review_snippet TEXT,
      published_at TEXT NOT NULL,
      scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
      raw_data TEXT,
      aoty_critic_score REAL,
      aoty_user_score REAL,
      aoty_url TEXT,
      FOREIGN KEY (source_id) REFERENCES sources(id)
    )
  `);

  await database.execute(`CREATE INDEX IF NOT EXISTS idx_releases_published_at ON releases(published_at DESC)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_releases_source_id ON releases(source_id)`);

  // Insert default sources if they don't exist
  const sources = [
    ["Nowa Muzyka", "https://www.nowamuzyka.pl/feed/", "rss"],
    ["Bandcamp Daily", "https://daily.bandcamp.com/album-of-the-day", "cheerio"],
    ["Inverted Audio", "https://inverted-audio.com/review/", "cheerio"],
    ["Resident Advisor", "https://ra.co/reviews", "puppeteer"],
    ["Boomkat", "https://boomkat.com/weekly-roundup", "puppeteer"],
  ];

  for (const [name, url, scraper_type] of sources) {
    await database.execute({
      sql: `INSERT OR IGNORE INTO sources (name, url, scraper_type) VALUES (?, ?, ?)`,
      args: [name, url, scraper_type],
    });
  }

  // Update URLs if needed
  await database.execute({
    sql: `UPDATE sources SET url = ?, scraper_type = ? WHERE name = ?`,
    args: ["https://daily.bandcamp.com/album-of-the-day", "cheerio", "Bandcamp Daily"],
  });
  await database.execute({
    sql: `UPDATE sources SET url = ? WHERE name = ?`,
    args: ["https://boomkat.com/weekly-roundup", "Boomkat"],
  });
}

export async function getSources(): Promise<Source[]> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute("SELECT * FROM sources WHERE is_active = 1");
  return result.rows as unknown as Source[];
}

export async function getSourceByName(name: string): Promise<Source | undefined> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute({
    sql: "SELECT * FROM sources WHERE name = ?",
    args: [name],
  });
  return result.rows[0] as unknown as Source | undefined;
}

export async function updateSourceLastFetched(sourceId: number): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: "UPDATE sources SET last_fetched = CURRENT_TIMESTAMP WHERE id = ?",
    args: [sourceId],
  });
}

export async function getReleases(sourceId?: number, limit = 15, offset = 0, genre?: string): Promise<Release[]> {
  await ensureInitialized();
  const database = getDb();
  let query = `
    SELECT r.*, s.name as source_name
    FROM releases r
    JOIN sources s ON r.source_id = s.id
    WHERE r.published_at >= '2026-01-01'
  `;
  const args: (number | string)[] = [];

  if (sourceId) {
    query += " AND r.source_id = ?";
    args.push(sourceId);
  }

  if (genre) {
    query += " AND r.genre LIKE ?";
    args.push(`%${genre}%`);
  }

  query += " ORDER BY r.published_at DESC LIMIT ? OFFSET ?";
  args.push(limit, offset);

  const result = await database.execute({ sql: query, args });
  return result.rows as unknown as Release[];
}

export async function getTotalReleases(sourceId?: number, genre?: string): Promise<number> {
  await ensureInitialized();
  const database = getDb();
  let query = `
    SELECT COUNT(*) as count
    FROM releases r
    WHERE r.published_at >= '2026-01-01'
  `;
  const args: (number | string)[] = [];

  if (sourceId) {
    query += " AND r.source_id = ?";
    args.push(sourceId);
  }

  if (genre) {
    query += " AND r.genre LIKE ?";
    args.push(`%${genre}%`);
  }

  const result = await database.execute({ sql: query, args });
  return Number(result.rows[0]?.count ?? 0);
}

export async function getDistinctGenres(): Promise<string[]> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute(`
    SELECT DISTINCT genre FROM releases
    WHERE genre IS NOT NULL AND published_at >= '2026-01-01'
    ORDER BY genre
  `);

  const genreSet = new Set<string>();
  for (const row of result.rows) {
    const genres = String(row.genre).split(", ");
    for (const g of genres) {
      genreSet.add(g.trim());
    }
  }

  return Array.from(genreSet).sort();
}

export async function insertRelease(release: ReleaseInput): Promise<boolean> {
  await ensureInitialized();
  const database = getDb();
  try {
    await database.execute({
      sql: `
        INSERT INTO releases (source_id, artist, title, label, genre, cover_image, review_url, review_snippet, published_at, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        release.source_id,
        release.artist,
        release.title,
        release.label ?? null,
        release.genre ?? null,
        release.cover_image ?? null,
        release.review_url,
        release.review_snippet ?? null,
        release.published_at,
        release.raw_data ?? null,
      ],
    });
    return true;
  } catch (error) {
    if ((error as Error).message?.includes("UNIQUE constraint")) {
      return false;
    }
    throw error;
  }
}

export async function getLastUpdated(): Promise<string | null> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute("SELECT MAX(scraped_at) as last_updated FROM releases");
  return (result.rows[0]?.last_updated as string) ?? null;
}

export async function updateReleaseAOTY(
  releaseId: number,
  criticScore: number | null,
  userScore: number | null,
  aotyUrl: string
): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: `
      UPDATE releases
      SET aoty_critic_score = ?, aoty_user_score = ?, aoty_url = ?
      WHERE id = ?
    `,
    args: [criticScore, userScore, aotyUrl, releaseId],
  });
}

export async function getReleasesWithoutAOTY(limit = 10): Promise<Release[]> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute({
    sql: `
      SELECT r.*, s.name as source_name
      FROM releases r
      JOIN sources s ON r.source_id = s.id
      WHERE r.aoty_url IS NULL
      ORDER BY r.published_at DESC
      LIMIT ?
    `,
    args: [limit],
  });
  return result.rows as unknown as Release[];
}
