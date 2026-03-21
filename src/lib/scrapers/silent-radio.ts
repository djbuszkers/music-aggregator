import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { getSourceByName, insertRelease, updateSourceLastFetched } from "../db";
import { normalizeGenre } from "../utils";
import type { ReleaseInput } from "../types";

const parser = new Parser({
  customFields: {
    item: [["content:encoded", "contentEncoded"]],
  },
});

// Titles are like:
//   "ALBUM REVIEW – ARTIST: ALBUM TITLE"
//   "ALBUM REVIEW: ARTIST – ALBUM TITLE"
function parseArtistTitle(rawTitle: string): { artist: string; title: string } | null {
  // Must be an album review — skip live reviews, roundups, etc.
  if (!/^album\s+review/i.test(rawTitle)) return null;
  if (/roundup|week ending/i.test(rawTitle)) return null;

  // Format 1: "ALBUM REVIEW – ARTIST: TITLE"
  const format1 = rawTitle.match(/^album\s+review\s*[–—-]+\s*(.+?):\s*(.+)$/i);
  if (format1) {
    return { artist: format1[1].trim(), title: format1[2].trim() };
  }

  // Format 2: "ALBUM REVIEW: ARTIST – TITLE"
  const format2 = rawTitle.match(/^album\s+review\s*:\s*(.+?)\s*[–—-]+\s*(.+)$/i);
  if (format2) {
    return { artist: format2[1].trim(), title: format2[2].trim() };
  }

  // Format 3: "ALBUM REVIEW – ARTIST – TITLE" (both separators are dashes)
  const format3 = rawTitle.match(/^album\s+review\s*[–—-]+\s*(.+?)\s*[–—-]+\s*(.+)$/i);
  if (format3) {
    return { artist: format3[1].trim(), title: format3[2].trim() };
  }

  return null;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function scrapeArticle(url: string): Promise<{ coverImage: string | null; snippet: string | null }> {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const coverImage = $('meta[property="og:image"]').attr("content") || null;

  let snippet: string | null = null;
  $(".postcontent p, .entry-content p, article p").each((_, el) => {
    if (snippet) return;
    const text = $(el).text().trim();
    if (text.length > 80) {
      snippet = text.length > 650 ? text.substring(0, 650) + "..." : text;
    }
  });

  return { coverImage, snippet };
}

// RSS categories include artist/label names — filter out known non-genre tags
const SKIP_CATEGORIES = new Set(["albums", "reviews", "features", "news", "live", "slider", "uncategorized"]);

function extractGenresFromCategories(categories: string[]): string[] {
  return categories.filter(c => !SKIP_CATEGORIES.has(c.toLowerCase()) && c.length < 30);
}

export async function scrapeSilentRadio(): Promise<number> {
  const source = await getSourceByName("Silent Radio");
  if (!source) {
    console.error("Silent Radio source not found in database");
    return 0;
  }

  console.log("Fetching Silent Radio RSS feed...");

  const feed = await parser.parseURL("https://www.silentradio.co.uk/feed/rss/");
  let newCount = 0;

  for (const item of feed.items) {
    if (!item.title || !item.link || !item.pubDate) continue;

    const publishedAt = new Date(item.pubDate).toISOString();
    if (!publishedAt.startsWith("2026")) {
      console.log(`Skipping (not 2026): ${item.title}`);
      continue;
    }

    const parsed = parseArtistTitle(item.title);
    if (!parsed) {
      console.log(`Skipping (not a standard review): ${item.title}`);
      continue;
    }
    const { artist, title } = parsed;

    const categories: string[] = Array.isArray(item.categories) ? item.categories : [];
    const genreCandidates = extractGenresFromCategories(categories);

    let coverImage: string | null = null;
    let snippet: string | null = null;

    try {
      const details = await scrapeArticle(item.link);
      coverImage = details.coverImage;
      snippet = details.snippet;
    } catch {
      console.log(`Failed to fetch article details for ${artist} - ${title}`);
    }

    const release: ReleaseInput = {
      source_id: source.id,
      artist,
      title,
      label: null,
      genre: genreCandidates.length > 0 ? normalizeGenre(genreCandidates.join(", ")) : null,
      cover_image: coverImage,
      review_url: item.link,
      review_snippet: snippet,
      published_at: publishedAt,
    };

    const inserted = await insertRelease(release);
    if (inserted) {
      newCount++;
      console.log(`Added: ${artist} - ${title}`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  await updateSourceLastFetched(source.id);
  console.log(`Silent Radio: ${newCount} new releases added`);
  return newCount;
}
