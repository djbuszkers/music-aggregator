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

// Words that should stay lowercase in title case (unless first word)
const LOWERCASE_WORDS = new Set(["a", "an", "the", "and", "but", "or", "nor", "for", "so", "yet", "at", "by", "in", "of", "on", "to", "as"]);

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+)/)
    .map((word, i) => {
      if (/^\s+$/.test(word)) return word;
      if (i === 0 || !LOWERCASE_WORDS.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join("");
}

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
    return { artist: toTitleCase(format1[1].trim()), title: toTitleCase(format1[2].trim()) };
  }

  // Format 2: "ALBUM REVIEW: ARTIST – TITLE"
  const format2 = rawTitle.match(/^album\s+review\s*:\s*(.+?)\s*[–—-]+\s*(.+)$/i);
  if (format2) {
    return { artist: toTitleCase(format2[1].trim()), title: toTitleCase(format2[2].trim()) };
  }

  // Format 3: "ALBUM REVIEW – ARTIST – TITLE" (both separators are dashes)
  const format3 = rawTitle.match(/^album\s+review\s*[–—-]+\s*(.+?)\s*[–—-]+\s*(.+)$/i);
  if (format3) {
    return { artist: toTitleCase(format3[1].trim()), title: toTitleCase(format3[2].trim()) };
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

// Ordered from most to least specific to avoid false positives (e.g. match "post-punk" before "punk")
const GENRE_KEYWORDS: [RegExp, string][] = [
  [/\bpost[- ]punk\b/i, "POST-PUNK"],
  [/\bpost[- ]rock\b/i, "POST ROCK"],
  [/\bdream[- ]pop\b/i, "DREAM POP"],
  [/\bsynth[- ]pop\b/i, "SYNTH-POP"],
  [/\bindie[- ]pop\b/i, "INDIE POP"],
  [/\bnoise[- ]rock\b/i, "NOISE ROCK"],
  [/\bdub[- ]techno\b/i, "DUB TECHNO"],
  [/\bdeep[- ]house\b/i, "DEEP HOUSE"],
  [/\btech[- ]house\b/i, "TECH HOUSE"],
  [/\buk[- ]drill\b/i, "UK DRILL"],
  [/\bneo[- ]soul\b/i, "NEO-SOUL"],
  [/\bafrobeat/i, "AFROBEAT"],
  [/\bdarkwave\b/i, "DARKWAVE"],
  [/\bshoegaze\b/i, "SHOEGAZE"],
  [/\bindustrial\b/i, "INDUSTRIAL"],
  [/\bgoth(?:ic)?\b/i, "GOTHIC"],
  [/\bfolk\b/i, "FOLK"],
  [/\bjazz\b/i, "JAZZ"],
  [/\bpunk\b/i, "PUNK"],
  [/\bindietronica\b/i, "INDIE DANCE"],
  [/\bindie\b/i, "INDIE"],
  [/\belectronic(?:a)?\b/i, "ELECTRONIC"],
  [/\bambient\b/i, "AMBIENT"],
  [/\bexperimental\b/i, "EXPERIMENTAL"],
  [/\bhip[- ]hop\b/i, "HIP-HOP"],
  [/\brap\b/i, "RAP"],
  [/\br&b\b/i, "R&B"],
  [/\bsoul\b/i, "SOUL"],
  [/\bfunk\b/i, "FUNK"],
  [/\bdisco\b/i, "DISCO"],
  [/\bclassical\b/i, "CLASSICAL"],
  [/\bmetal\b/i, "METAL"],
  [/\brock\b/i, "ROCK"],
  [/\bpop\b/i, "POP"],
];

function detectGenresFromText(text: string): string[] {
  const found: string[] = [];
  for (const [pattern, genre] of GENRE_KEYWORDS) {
    if (pattern.test(text) && !found.includes(genre)) {
      found.push(genre);
    }
    if (found.length >= 3) break; // cap at 3 to avoid noise
  }
  return found;
}

async function scrapeArticle(url: string): Promise<{ coverImage: string | null; snippet: string | null; reviewText: string }> {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const coverImage = $('meta[property="og:image"]').attr("content") || null;

  const paragraphs: string[] = [];
  $(".postcontent p, .entry-content p, article p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 30) paragraphs.push(text);
  });

  const reviewText = paragraphs.join(" ");
  const snippet = reviewText.length > 0
    ? (reviewText.length > 650 ? reviewText.substring(0, 650) + "..." : reviewText)
    : null;

  return { coverImage, snippet, reviewText };
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
    let detectedGenres: string[] = [];

    try {
      const details = await scrapeArticle(item.link);
      coverImage = details.coverImage;
      snippet = details.snippet;
      detectedGenres = detectGenresFromText(details.reviewText);
    } catch {
      console.log(`Failed to fetch article details for ${artist} - ${title}`);
    }

    const allGenres = [...detectedGenres, ...genreCandidates];

    const release: ReleaseInput = {
      source_id: source.id,
      artist,
      title,
      label: null,
      genre: allGenres.length > 0 ? normalizeGenre(allGenres.join(", ")) : null,
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
