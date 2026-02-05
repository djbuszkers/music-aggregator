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

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

function extractBandcampUrl(content: string): string | null {
  const match = content.match(/https?:\/\/[a-z0-9-]+\.bandcamp\.com\/album\/[a-z0-9-]+/i);
  return match ? match[0] : null;
}

function isNonGenreTag(tag: string): boolean {
  const nonGenreTags = [
    // Cities
    "paris", "london", "berlin", "new york", "los angeles", "tokyo",
    "chicago", "detroit", "amsterdam", "brooklyn", "manchester", "seattle",
    "portland", "oakland", "atlanta", "miami", "denver", "austin",
    "philadelphia", "boston", "san francisco", "minneapolis", "nashville",
    "warsaw", "vienna", "cologne", "hamburg", "munich", "barcelona",
    // Countries/Regions
    "uk", "usa", "france", "germany", "japan", "canada", "australia",
    "poland", "united kingdom", "netherlands",
    // Labels (common ones)
    "kompakt", "affin", "warp", "ninja tune", "hyperdub", "planet mu",
    "ghostly", "r&s", "ostgut ton", "mute", "raster noton", "editions mego",
    "a strangely isolated place", "asip",
    // Artist names commonly appearing as tags
    "markus guentner", "shackleton", "craven faults", "luke hess",
    // Other non-genre descriptors
    "vinyl", "lp", "ep", "album", "compilation", "remix", "reissue",
    "analogue", "synthesiser", "synthesizer", "modular synth", "modular"
  ];

  const tagLower = tag.toLowerCase();
  return nonGenreTags.includes(tagLower);
}

async function fetchBandcampGenres(bandcampUrl: string): Promise<string | null> {
  const html = await fetchPage(bandcampUrl);
  if (!html) return null;

  const tagMatches = html.matchAll(/bandcamp\.com\/discover\/([a-z0-9-]+)/gi);
  const tags = new Set<string>();

  for (const match of tagMatches) {
    const tag = match[1];
    if (tag && !isNonGenreTag(tag)) {
      tags.add(tag.replace(/-/g, " "));
    }
  }

  if (tags.size === 0) return null;

  return Array.from(tags).join(", ");
}

async function main() {
  // Get Nowa Muzyka source ID
  const source = db.prepare("SELECT id FROM sources WHERE name = 'Nowa Muzyka'").get() as { id: number } | undefined;
  if (!source) {
    console.error("Nowa Muzyka source not found");
    return;
  }

  // Get all Nowa Muzyka releases (re-fetch all to clean up non-genre tags)
  const releases = db.prepare(`
    SELECT id, artist, title, raw_data
    FROM releases
    WHERE source_id = ?
  `).all(source.id) as { id: number; artist: string; title: string; raw_data: string }[];

  console.log(`Found ${releases.length} Nowa Muzyka releases without genre\n`);

  const update = db.prepare('UPDATE releases SET genre = ? WHERE id = ?');
  let updated = 0;

  for (const release of releases) {
    if (!release.raw_data) continue;

    try {
      const rawData = JSON.parse(release.raw_data);
      const content = rawData["content:encoded"] || rawData.content || "";

      const bandcampUrl = extractBandcampUrl(content);
      if (!bandcampUrl) {
        console.log(`${release.artist} - ${release.title}: No Bandcamp URL found`);
        continue;
      }

      console.log(`${release.artist} - ${release.title}: Fetching from ${bandcampUrl}...`);

      const genre = await fetchBandcampGenres(bandcampUrl);
      if (genre) {
        const normalized = normalizeGenre(genre);
        update.run(normalized, release.id);
        updated++;
        console.log(`  -> ${normalized}`);
      } else {
        console.log(`  -> No genres found`);
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.log(`${release.artist} - ${release.title}: Error - ${err}`);
    }
  }

  console.log(`\nUpdated ${updated} releases with genres`);
  db.close();
}

main();
