import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Source, Release, ReleaseInput } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "music.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initDb(db);
  }
  return db;
}

function initDb(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      scraper_type TEXT NOT NULL CHECK(scraper_type IN ('rss', 'cheerio', 'puppeteer')),
      last_fetched TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      artist TEXT NOT NULL,
      title TEXT NOT NULL,
      label TEXT,
      cover_image TEXT,
      review_url TEXT NOT NULL UNIQUE,
      review_snippet TEXT,
      published_at TEXT NOT NULL,
      scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
      raw_data TEXT,
      FOREIGN KEY (source_id) REFERENCES sources(id)
    );

    CREATE INDEX IF NOT EXISTS idx_releases_published_at ON releases(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_releases_source_id ON releases(source_id);
  `);

  // Insert default sources if they don't exist
  const insertSource = database.prepare(`
    INSERT OR IGNORE INTO sources (name, url, scraper_type)
    VALUES (?, ?, ?)
  `);

  insertSource.run("Nowa Muzyka", "https://www.nowamuzyka.pl/feed/", "rss");
  insertSource.run("Bandcamp Daily", "https://daily.bandcamp.com/album-of-the-day", "cheerio");
  insertSource.run("Inverted Audio", "https://inverted-audio.com/review/", "cheerio");

  // Update Bandcamp URL if it was previously set to the RSS feed
  database.prepare(`
    UPDATE sources SET url = ?, scraper_type = ? WHERE name = ?
  `).run("https://daily.bandcamp.com/album-of-the-day", "cheerio", "Bandcamp Daily");
  insertSource.run("Resident Advisor", "https://ra.co/reviews", "puppeteer");
  insertSource.run("Boomkat", "https://boomkat.com/weekly-roundup", "puppeteer");

  // Update Boomkat URL if it was previously set to the old URL
  database.prepare(`
    UPDATE sources SET url = ? WHERE name = ?
  `).run("https://boomkat.com/weekly-roundup", "Boomkat");

  // Add AOTY columns if they don't exist
  const columns = database.prepare("PRAGMA table_info(releases)").all() as { name: string }[];
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes("aoty_critic_score")) {
    database.exec("ALTER TABLE releases ADD COLUMN aoty_critic_score REAL");
  }
  if (!columnNames.includes("aoty_user_score")) {
    database.exec("ALTER TABLE releases ADD COLUMN aoty_user_score REAL");
  }
  if (!columnNames.includes("aoty_url")) {
    database.exec("ALTER TABLE releases ADD COLUMN aoty_url TEXT");
  }
}

export function getSources(): Source[] {
  const db = getDb();
  return db.prepare("SELECT * FROM sources WHERE is_active = 1").all() as Source[];
}

export function getSourceByName(name: string): Source | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM sources WHERE name = ?").get(name) as Source | undefined;
}

export function updateSourceLastFetched(sourceId: number): void {
  const db = getDb();
  db.prepare("UPDATE sources SET last_fetched = CURRENT_TIMESTAMP WHERE id = ?").run(sourceId);
}

export function getReleases(sourceId?: number, limit = 15, offset = 0, genre?: string): Release[] {
  const db = getDb();
  let query = `
    SELECT r.*, s.name as source_name
    FROM releases r
    JOIN sources s ON r.source_id = s.id
    WHERE r.published_at >= '2026-01-01'
  `;
  const params: (number | string)[] = [];

  if (sourceId) {
    query += " AND r.source_id = ?";
    params.push(sourceId);
  }

  if (genre) {
    query += " AND r.genre LIKE ?";
    params.push(`%${genre}%`);
  }

  query += " ORDER BY r.published_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return db.prepare(query).all(...params) as Release[];
}

export function getTotalReleases(sourceId?: number, genre?: string): number {
  const db = getDb();
  let query = `
    SELECT COUNT(*) as count
    FROM releases r
    WHERE r.published_at >= '2026-01-01'
  `;
  const params: (number | string)[] = [];

  if (sourceId) {
    query += " AND r.source_id = ?";
    params.push(sourceId);
  }

  if (genre) {
    query += " AND r.genre LIKE ?";
    params.push(`%${genre}%`);
  }

  const result = db.prepare(query).get(...params) as { count: number };
  return result.count;
}

export function getDistinctGenres(): string[] {
  const db = getDb();
  const results = db.prepare(`
    SELECT DISTINCT genre FROM releases
    WHERE genre IS NOT NULL AND published_at >= '2026-01-01'
    ORDER BY genre
  `).all() as { genre: string }[];

  // Extract individual genres from comma-separated values
  const genreSet = new Set<string>();
  for (const row of results) {
    const genres = row.genre.split(", ");
    for (const g of genres) {
      genreSet.add(g.trim());
    }
  }

  return Array.from(genreSet).sort();
}

export function insertRelease(release: ReleaseInput): boolean {
  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO releases (source_id, artist, title, label, genre, cover_image, review_url, review_snippet, published_at, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      release.source_id,
      release.artist,
      release.title,
      release.label ?? null,
      release.genre ?? null,
      release.cover_image ?? null,
      release.review_url,
      release.review_snippet ?? null,
      release.published_at,
      release.raw_data ?? null
    );
    return true;
  } catch (error) {
    // Likely a duplicate (UNIQUE constraint on review_url)
    if ((error as Error).message?.includes("UNIQUE constraint")) {
      return false;
    }
    throw error;
  }
}

export function getLastUpdated(): string | null {
  const db = getDb();
  const result = db.prepare("SELECT MAX(scraped_at) as last_updated FROM releases").get() as { last_updated: string | null };
  return result?.last_updated ?? null;
}

export function updateReleaseAOTY(
  releaseId: number,
  criticScore: number | null,
  userScore: number | null,
  aotyUrl: string
): void {
  const db = getDb();
  db.prepare(`
    UPDATE releases
    SET aoty_critic_score = ?, aoty_user_score = ?, aoty_url = ?
    WHERE id = ?
  `).run(criticScore, userScore, aotyUrl, releaseId);
}

export function getReleasesWithoutAOTY(limit = 10): Release[] {
  const db = getDb();
  return db.prepare(`
    SELECT r.*, s.name as source_name
    FROM releases r
    JOIN sources s ON r.source_id = s.id
    WHERE r.aoty_url IS NULL
    ORDER BY r.published_at DESC
    LIMIT ?
  `).all(limit) as Release[];
}
