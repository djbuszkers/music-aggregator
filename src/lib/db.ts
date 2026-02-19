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
      FOREIGN KEY (source_id) REFERENCES sources(id)
    )
  `);

  // Add Spotify columns if they don't exist
  try {
    await database.execute(`ALTER TABLE releases ADD COLUMN spotify_url TEXT`);
  } catch {
    // Column already exists
  }
  try {
    await database.execute(`ALTER TABLE releases ADD COLUMN spotify_id TEXT`);
  } catch {
    // Column already exists
  }
  try {
    await database.execute(`ALTER TABLE releases ADD COLUMN youtube_url TEXT`);
  } catch {
    // Column already exists
  }
  try {
    await database.execute(`ALTER TABLE releases ADD COLUMN youtube_id TEXT`);
  } catch {
    // Column already exists
  }
  try {
    await database.execute(`ALTER TABLE releases ADD COLUMN bandcamp_url TEXT`);
  } catch {
    // Column already exists
  }
  try {
    await database.execute(`ALTER TABLE releases ADD COLUMN bandcamp_album_id TEXT`);
  } catch {
    // Column already exists
  }
  try {
    await database.execute(`ALTER TABLE releases ADD COLUMN deezer_url TEXT`);
  } catch {
    // Column already exists
  }
  try {
    await database.execute(`ALTER TABLE releases ADD COLUMN deezer_id TEXT`);
  } catch {
    // Column already exists
  }
  try {
    await database.execute(`ALTER TABLE releases ADD COLUMN is_inky_tip INTEGER DEFAULT 0`);
  } catch {
    // Column already exists
  }
  try {
    await database.execute(`ALTER TABLE releases ADD COLUMN inky_tip_note TEXT`);
  } catch {
    // Column already exists
  }
  try {
    await database.execute(`ALTER TABLE releases ADD COLUMN release_type TEXT`);
  } catch {
    // Column already exists
  }

  await database.execute(`CREATE INDEX IF NOT EXISTS idx_releases_published_at ON releases(published_at DESC)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_releases_source_id ON releases(source_id)`);

  // Insert default sources if they don't exist
  const sources = [
    ["Nowa Muzyka", "https://www.nowamuzyka.pl/feed/", "rss"],
    ["Bandcamp Daily", "https://daily.bandcamp.com/album-of-the-day", "cheerio"],
    ["Inverted Audio", "https://inverted-audio.com/review/", "cheerio"],
    ["Resident Advisor", "https://ra.co/reviews", "puppeteer"],
    ["Boomkat", "https://boomkat.com/weekly-roundup", "puppeteer"],
    ["Shatter the Standards", "https://www.shatterthestandards.com/feed", "cheerio"],
    ["DJ Mag", "https://djmag.com/reviews", "cheerio"],
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

export async function getReleases(sourceId?: number, limit = 15, offset = 0, genres?: string[], inkyTipsOnly?: boolean, releaseType?: string): Promise<Release[]> {
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

  if (genres && genres.length > 0) {
    const conditions = genres.map(() => "r.genre LIKE ?");
    query += ` AND (${conditions.join(" OR ")})`;
    for (const g of genres) {
      args.push(`%${g}%`);
    }
  }

  if (inkyTipsOnly) {
    query += " AND r.is_inky_tip = 1";
  }

  if (releaseType) {
    query += " AND r.release_type = ?";
    args.push(releaseType);
  }

  query += " ORDER BY r.published_at DESC LIMIT ? OFFSET ?";
  args.push(limit, offset);

  const result = await database.execute({ sql: query, args });
  return result.rows as unknown as Release[];
}

export async function getTotalReleases(sourceId?: number, genres?: string[], inkyTipsOnly?: boolean, releaseType?: string): Promise<number> {
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

  if (genres && genres.length > 0) {
    const conditions = genres.map(() => "r.genre LIKE ?");
    query += ` AND (${conditions.join(" OR ")})`;
    for (const g of genres) {
      args.push(`%${g}%`);
    }
  }

  if (inkyTipsOnly) {
    query += " AND r.is_inky_tip = 1";
  }

  if (releaseType) {
    query += " AND r.release_type = ?";
    args.push(releaseType);
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

  // Check for cross-source duplicate (same artist + title, case-insensitive)
  const existing = await database.execute({
    sql: `SELECT id, review_snippet, label FROM releases WHERE LOWER(TRIM(artist)) = LOWER(TRIM(?)) AND LOWER(TRIM(title)) = LOWER(TRIM(?))`,
    args: [release.artist, release.title],
  });

  if (existing.rows.length > 0) {
    const existingSnippet = (existing.rows[0].review_snippet as string) ?? "";
    const newSnippet = release.review_snippet ?? "";

    if (newSnippet.length > existingSnippet.length) {
      // New review is longer — update the existing row
      await database.execute({
        sql: `
          UPDATE releases SET source_id = ?, artist = ?, title = ?, label = ?, genre = ?, cover_image = ?, review_url = ?, review_snippet = ?, published_at = ?, raw_data = ?,
          bandcamp_url = COALESCE(?, bandcamp_url), bandcamp_album_id = COALESCE(?, bandcamp_album_id),
          release_type = COALESCE(?, release_type)
          WHERE id = ?
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
          release.bandcamp_url ?? null,
          release.bandcamp_album_id ?? null,
          release.release_type ?? null,
          existing.rows[0].id,
        ],
      });
      return true;
    }

    // Existing snippet is longer or equal — but backfill missing fields
    const backfills: string[] = [];
    const backfillArgs: (string | number)[] = [];
    if (release.label && !existing.rows[0].label) {
      backfills.push("label = ?");
      backfillArgs.push(release.label);
    }
    if (release.bandcamp_url) {
      backfills.push("bandcamp_url = COALESCE(bandcamp_url, ?)");
      backfillArgs.push(release.bandcamp_url);
    }
    if (release.bandcamp_album_id) {
      backfills.push("bandcamp_album_id = COALESCE(bandcamp_album_id, ?)");
      backfillArgs.push(release.bandcamp_album_id);
    }
    if (release.release_type) {
      backfills.push("release_type = COALESCE(release_type, ?)");
      backfillArgs.push(release.release_type);
    }
    if (backfills.length > 0) {
      backfillArgs.push(existing.rows[0].id as number);
      await database.execute({
        sql: `UPDATE releases SET ${backfills.join(", ")} WHERE id = ?`,
        args: backfillArgs,
      });
    }
    return false;
  }

  try {
    await database.execute({
      sql: `
        INSERT INTO releases (source_id, artist, title, label, genre, cover_image, review_url, review_snippet, published_at, raw_data, bandcamp_url, bandcamp_album_id, release_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        release.bandcamp_url ?? null,
        release.bandcamp_album_id ?? null,
        release.release_type ?? null,
      ],
    });
    return true;
  } catch (error) {
    const errMsg = (error as Error).message || "";
    const errCode = (error as { code?: string }).code || "";
    if (errMsg.includes("UNIQUE constraint") || errMsg.includes("SQLITE_CONSTRAINT") || errCode === "SQLITE_CONSTRAINT") {
      // Same review_url already exists — backfill label if missing
      if (release.label) {
        try {
          await database.execute({
            sql: `UPDATE releases SET label = ? WHERE review_url = ? AND (label IS NULL OR label = '')`,
            args: [release.label, release.review_url],
          });
        } catch {
          // Ignore update errors during backfill
        }
      }
      return false;
    }
    throw error;
  }
}

export async function getReleasesWithoutSpotify(): Promise<Release[]> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute(`
    SELECT r.*, s.name as source_name
    FROM releases r
    JOIN sources s ON r.source_id = s.id
    WHERE r.spotify_url IS NULL AND r.published_at >= '2026-01-01'
    ORDER BY r.published_at DESC
  `);
  return result.rows as unknown as Release[];
}

export async function updateReleaseSpotify(releaseId: number, spotifyUrl: string, spotifyId: string, releaseType?: string | null): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: `UPDATE releases SET spotify_url = ?, spotify_id = ?, release_type = COALESCE(?, release_type) WHERE id = ?`,
    args: [spotifyUrl, spotifyId, releaseType ?? null, releaseId],
  });
}

export async function getReleasesWithoutYouTube(): Promise<Release[]> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute(`
    SELECT r.*, s.name as source_name
    FROM releases r
    JOIN sources s ON r.source_id = s.id
    WHERE r.youtube_url IS NULL AND r.published_at >= '2026-01-01'
    ORDER BY r.published_at DESC
  `);
  return result.rows as unknown as Release[];
}

export async function updateReleaseYouTube(releaseId: number, youtubeUrl: string, youtubeId: string): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: `UPDATE releases SET youtube_url = ?, youtube_id = ? WHERE id = ?`,
    args: [youtubeUrl, youtubeId, releaseId],
  });
}

export async function getReleasesWithoutBandcamp(): Promise<Release[]> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute(`
    SELECT r.*, s.name as source_name
    FROM releases r
    JOIN sources s ON r.source_id = s.id
    WHERE r.bandcamp_album_id IS NULL AND r.published_at >= '2026-01-01'
    ORDER BY r.published_at DESC
  `);
  return result.rows as unknown as Release[];
}

export async function updateReleaseBandcamp(releaseId: number, bandcampUrl: string, bandcampAlbumId: string): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: `UPDATE releases SET bandcamp_url = ?, bandcamp_album_id = ? WHERE id = ?`,
    args: [bandcampUrl, bandcampAlbumId, releaseId],
  });
}

export async function getReleasesWithoutDeezer(): Promise<Release[]> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute(`
    SELECT r.*, s.name as source_name
    FROM releases r
    JOIN sources s ON r.source_id = s.id
    WHERE r.deezer_url IS NULL AND r.published_at >= '2026-01-01'
    ORDER BY r.published_at DESC
  `);
  return result.rows as unknown as Release[];
}

export async function getReleasesWithoutLabel(): Promise<Release[]> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute(`
    SELECT r.*, s.name as source_name
    FROM releases r
    JOIN sources s ON r.source_id = s.id
    WHERE (r.label IS NULL OR r.label = '') AND r.published_at >= '2026-01-01'
    ORDER BY r.published_at DESC
  `);
  return result.rows as unknown as Release[];
}

export async function updateReleaseLabel(releaseId: number, label: string): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: `UPDATE releases SET label = ? WHERE id = ? AND (label IS NULL OR label = '')`,
    args: [label, releaseId],
  });
}

export async function updateReleaseDeezer(releaseId: number, deezerUrl: string, deezerId: string): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: `UPDATE releases SET deezer_url = ?, deezer_id = ? WHERE id = ?`,
    args: [deezerUrl, deezerId, releaseId],
  });
}

export async function getReleasesWithoutReleaseType(): Promise<Release[]> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute(`
    SELECT r.*, s.name as source_name
    FROM releases r
    JOIN sources s ON r.source_id = s.id
    WHERE r.release_type IS NULL AND r.published_at >= '2026-01-01'
    ORDER BY r.published_at DESC
  `);
  return result.rows as unknown as Release[];
}

export async function updateReleaseType(releaseId: number, releaseType: string): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: `UPDATE releases SET release_type = ? WHERE id = ?`,
    args: [releaseType, releaseId],
  });
}

export async function getReleaseById(id: number): Promise<(Release & { source_url?: string }) | null> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute({
    sql: `
      SELECT r.*, s.name as source_name, s.url as source_url
      FROM releases r
      JOIN sources s ON r.source_id = s.id
      WHERE r.id = ?
    `,
    args: [id],
  });
  return (result.rows[0] as unknown as (Release & { source_url?: string })) ?? null;
}

export async function getLastUpdated(): Promise<string | null> {
  await ensureInitialized();
  const database = getDb();
  const result = await database.execute("SELECT MAX(scraped_at) as last_updated FROM releases");
  return (result.rows[0]?.last_updated as string) ?? null;
}

