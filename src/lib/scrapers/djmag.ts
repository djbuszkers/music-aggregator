import * as cheerio from 'cheerio';
import { getSourceByName, insertRelease, updateSourceLastFetched } from '../db';

const BASE_URL = 'https://djmag.com';

const CATEGORIES = [
  '/reviews/albums',
  '/reviews/singles-eps',
] as const;

// Genre allowlist — EPs without any of these genres are skipped
const ALLOWED_GENRES = new Set([
  'jazz', 'jazz fusion', 'soul', 'r&b', 'hip hop', 'hip-hop',
  'electronic', 'electronica', 'ambient', 'experimental', 'funk',
  'neo soul', 'neo-soul', 'afrobeat', 'afro', 'house', 'deep house',
  'garage', 'uk garage', 'drum and bass', 'drum & bass', 'downtempo',
  'trip hop', 'trip-hop', 'dub', 'reggae', 'world', 'latin',
  'afrobeats', 'broken beat', 'future beats',
]);

function normalizeGenre(raw: string): string {
  return raw
    .toUpperCase()
    .replace('HIP HOP', 'HIP-HOP')
    .replace('TRIP HOP', 'TRIP-HOP')
    .replace('DRUM AND BASS', 'DRUM & BASS')
    .replace('DRUM &AMP; BASS', 'DRUM & BASS')
    .replace('NEO SOUL', 'NEO-SOUL');
}

function looksLikeEP(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes(' ep') || t.endsWith(' ep') || t === 'ep';
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Listing page ─────────────────────────────────────────────────────────────
// Extracts review URLs from /reviews/albums and /reviews/singles-eps
// Pagination: ?bst=1&page=N&minmax=0-0 (page 0 = no param)

async function fetchListingPage(categoryPath: string, page: number): Promise<string[]> {
  const url =
    page === 0
      ? `${BASE_URL}${categoryPath}`
      : `${BASE_URL}${categoryPath}?bst=1&page=${page}&minmax=0-0`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OctoCrate/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);

  const $ = cheerio.load(await res.text());
  const hrefs = new Set<string>();

  $('a[href^="/reviews/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    // Skip category and filter links — real reviews have slug after /reviews/
    const segments = href.split('/').filter(Boolean);
    if (segments.length >= 2 && segments[1] !== 'albums' && segments[1] !== 'singles-eps' && segments[1] !== 'compilations') {
      hrefs.add(href);
    }
  });

  return Array.from(hrefs);
}

// ─── Individual review page ────────────────────────────────────────────────────

interface ReviewDetail {
  artist: string;
  title: string;
  label: string;
  genres: string[];
  coverImage: string;
  snippet: string;
  publishedAt: string;
  reviewUrl: string;
}

async function fetchReviewDetail(path: string): Promise<ReviewDetail | null> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OctoCrate/1.0)' },
  });
  if (!res.ok) {
    console.warn(`[djmag] HTTP ${res.status}: ${url}`);
    return null;
  }

  const $ = cheerio.load(await res.text());

  // Cover image — og:image is most reliable
  const coverImage =
    $('meta[property="og:image"]').attr('content') ||
    $('img[src*="music_reviews"]').first().attr('src') ||
    $('img[src*="styles/djm_25"]').first().attr('src') ||
    '';

  // Collect all ?s1= links in page order.
  // Pattern: reviewer (1st) → artist (2nd) → label (3rd) → genres (rest)
  const s1Links: string[] = [];
  $('a[href*="?s1="]').each((_, el) => {
    const text = $(el).text().trim();
    if (text && !s1Links.includes(text)) s1Links.push(text);
  });

  // Artist & title — from h1: artist is a ?s1= link inside h1, title is remaining text
  let artist = '';
  let title = '';
  const h1 = $('h1').first();
  const artistLink = h1.find('a[href*="?s1="]').first();
  if (artistLink.length) {
    artist = artistLink.text().trim();
    title = h1.text().replace(artist, '').trim();
  } else {
    // h1 has no link — artist is the 2nd ?s1= link (after reviewer)
    if (s1Links.length >= 2) {
      artist = s1Links[1];
      // Derive title by stripping artist from h1 text
      const h1Text = h1.text().trim();
      // h1 format: "Artist Title" (no separator) or "Artist - Title"
      if (h1Text.includes(' - ')) {
        const parts = h1Text.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      } else if (h1Text.toLowerCase().startsWith(artist.toLowerCase())) {
        title = h1Text.slice(artist.length).trim();
      } else {
        title = h1Text;
      }
    }
  }
  // Final fallback: og:title "Artist - Title | DJ Mag"
  if (!artist || !title) {
    const ogTitle = ($('meta[property="og:title"]').attr('content') || '').replace(' | DJ Mag', '');
    const ogParts = ogTitle.split(' - ');
    if (ogParts.length >= 2) {
      artist = ogParts[0].trim();
      title = ogParts.slice(1).join(' - ').trim();
    }
  }

  if (!artist || !title) {
    console.warn(`[djmag] Could not parse artist/title from ${url}`);
    return null;
  }

  // Identify reviewer, artist, label, and genres by position in s1Links.
  // Pattern: reviewer (1st) → artist (2nd) → label (3rd) → genres (rest)
  const artistIdx = s1Links.findIndex((l) => l.toLowerCase() === artist.toLowerCase());
  // Label is the first non-artist link after the artist position
  let label = '';
  let labelIdx = -1;
  for (let i = artistIdx + 1; i < s1Links.length; i++) {
    if (s1Links[i].toLowerCase() !== artist.toLowerCase()) {
      label = s1Links[i];
      labelIdx = i;
      break;
    }
  }

  // Genres — all s1 links after the label (or after artist if no label)
  const genreStartIdx = labelIdx >= 0 ? labelIdx + 1 : artistIdx + 1;
  const genres: string[] = [];
  for (let i = genreStartIdx; i < s1Links.length; i++) {
    const normalized = normalizeGenre(s1Links[i]);
    if (!genres.includes(normalized)) genres.push(normalized);
  }

  // Review snippet — collect all substantial paragraphs as the review body
  let snippet = '';
  const paragraphs: string[] = [];
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    // Skip short nav/metadata paragraphs; review paragraphs are typically 100+ chars
    if (text.length >= 80) paragraphs.push(text);
  });
  if (paragraphs.length > 0) {
    snippet = paragraphs.join(' ').slice(0, 650);
  }
  // Fallback to og:description
  if (snippet.length < 50) {
    snippet = ($('meta[property="og:description"]').attr('content') || '').slice(0, 650);
  }

  // Published date — try "Release date:" text first, then <time>, then article:published_time
  let publishedAt = '';
  const bodyText = $('body').text();
  const relDateMatch = bodyText.match(/Release date:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (relDateMatch) {
    const d = new Date(relDateMatch[1]);
    if (!isNaN(d.getTime())) publishedAt = d.toISOString().split('T')[0];
  }
  if (!publishedAt) {
    const timeAttr = $('time').first().attr('datetime');
    if (timeAttr) {
      publishedAt = new Date(timeAttr).toISOString().split('T')[0];
    }
  }
  if (!publishedAt) {
    const meta =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="date"]').attr('content') || '';
    if (meta) publishedAt = meta.split('T')[0];
  }
  if (!publishedAt) publishedAt = new Date().toISOString().split('T')[0];

  return { artist, title, label, genres, coverImage, snippet, publishedAt, reviewUrl: url };
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function scrapeDjMag(): Promise<number> {
  console.log('[djmag] Starting scrape...');

  const source = await getSourceByName('DJ Mag');
  if (!source) {
    console.error('[djmag] Source "DJ Mag" not found in DB');
    return 0;
  }

  const allUrls = new Set<string>();

  for (const category of CATEGORIES) {
    console.log(`[djmag] Fetching listing: ${category}`);
    try {
      for (let page = 0; page <= 1; page++) {
        const urls = await fetchListingPage(category, page);
        urls.forEach((u) => allUrls.add(u));
        console.log(`[djmag] ${category} page ${page}: ${urls.length} URLs`);
        await delay(500);
      }
    } catch (err) {
      console.error(`[djmag] Error fetching ${category}:`, err);
    }
    await delay(500);
  }

  console.log(`[djmag] ${allUrls.size} unique review URLs`);

  let added = 0;
  let skipped = 0;

  for (const path of Array.from(allUrls)) {
    await delay(600);

    const detail = await fetchReviewDetail(path);
    if (!detail) { skipped++; continue; }

    // Date filter: 2026 only
    if (!detail.publishedAt.startsWith('2026')) {
      console.log(`[djmag] Skip (pre-2026): ${detail.artist} — ${detail.title}`);
      skipped++;
      continue;
    }

    // Determine release type from URL category
    const isEpCategory = path.includes('singles-eps') ||
      detail.title.toLowerCase().includes(' ep');
    const releaseType = isEpCategory ? 'EP' : 'LP';

    // For EPs: skip if no genres match the allowlist (avoids pure club/techno EPs)
    const hasAllowedGenre = detail.genres.some((g) =>
      ALLOWED_GENRES.has(g.toLowerCase().replace(/-/g, ' '))
    );
    if (releaseType === 'EP' && !hasAllowedGenre) {
      console.log(`[djmag] Skip EP (no genre match): ${detail.artist} — ${detail.title}`);
      skipped++;
      continue;
    }

    // For EPs: skip if title looks like a single (no "EP" in name and from singles-eps)
    if (releaseType === 'EP' && !looksLikeEP(detail.title)) {
      console.log(`[djmag] Skip single: ${detail.artist} — ${detail.title}`);
      skipped++;
      continue;
    }

    const result = await insertRelease({
      source_id: source.id,
      artist: detail.artist,
      title: detail.title,
      label: detail.label || null,
      genre: detail.genres.length > 0 ? detail.genres.join(', ') : null,
      cover_image: detail.coverImage || null,
      review_url: detail.reviewUrl,
      review_snippet: detail.snippet || null,
      published_at: detail.publishedAt,
      release_type: releaseType,
    });

    if (result) {
      console.log(`[djmag] Added [${releaseType}]: ${detail.artist} — ${detail.title}`);
      added++;
    } else {
      console.log(`[djmag] ~ Duplicate: ${detail.artist} — ${detail.title}`);
      skipped++;
    }
  }

  await updateSourceLastFetched(source.id);
  console.log(`[djmag] Done. Added: ${added}, Skipped/duplicate: ${skipped}`);
  return added;
}
