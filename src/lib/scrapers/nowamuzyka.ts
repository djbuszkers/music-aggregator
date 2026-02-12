import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { getSourceByName, insertRelease, updateSourceLastFetched } from "../db";
import { normalizeGenre } from "../utils";
import { extractBandcampAlbumId } from "../bandcamp";
import type { ReleaseInput } from "../types";

const parser = new Parser({
  customFields: {
    item: ["content:encoded", "enclosure"],
  },
});

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

async function fetchOgImage(url: string): Promise<string | null> {
  const html = await fetchPage(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  // Try og:image first
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) return ogImage;

  // Fallback to first article image
  const articleImg = $("article img, .entry-content img").first().attr("src");
  if (articleImg) return articleImg;

  return null;
}

function extractBandcampUrl(content: string): string | null {
  // Look for Bandcamp album URLs in the content
  // Pattern: https://artist.bandcamp.com/album/album-name
  const match = content.match(/https?:\/\/[a-z0-9-]+\.bandcamp\.com\/album\/[a-z0-9-]+/i);
  return match ? match[0] : null;
}

async function fetchBandcampData(bandcampUrl: string): Promise<{ genres: string | null; label: string | null; albumId: string | null }> {
  const html = await fetchPage(bandcampUrl);
  if (!html) return { genres: null, label: null, albumId: null };

  const $ = cheerio.load(html);

  // Extract label from JSON-LD structured data
  let label: string | null = null;
  try {
    const ldJsonScript = $('script[type="application/ld+json"]').html();
    if (ldJsonScript) {
      const ldJson = JSON.parse(ldJsonScript);
      label = ldJson.albumRelease?.[0]?.recordLabel?.name || null;
    }
  } catch {
    // JSON-LD parsing failed, continue without label
  }

  // Extract tags from bandcamp.com/discover/TAG URLs
  const tagRegex = /bandcamp\.com\/discover\/([a-z0-9-]+)/gi;
  const tags = new Set<string>();
  let tagMatch;

  while ((tagMatch = tagRegex.exec(html)) !== null) {
    const tag = tagMatch[1];
    // Filter out location-based tags and keep music genres
    if (tag && !isNonGenreTag(tag)) {
      tags.add(tag.replace(/-/g, " "));
    }
  }

  const genres = tags.size > 0 ? Array.from(tags).join(", ") : null;

  // Extract album ID for embed player
  const albumId = extractBandcampAlbumId(html);

  return { genres, label, albumId };
}

function isNonGenreTag(tag: string): boolean {
  // Location-based tags and other non-genre tags to filter out
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
    // Other non-genre descriptors
    "vinyl", "lp", "ep", "album", "compilation", "remix", "reissue",
    "analogue", "synthesiser", "synthesizer", "modular synth", "modular"
  ];

  const tagLower = tag.toLowerCase();
  return nonGenreTags.includes(tagLower);
}

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  "content:encoded"?: string;
  content?: string;
  enclosure?: { url?: string };
}

function extractCoverImage(content: string): string | null {
  // Try to find image in content
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    return imgMatch[1];
  }
  return null;
}

function parseArtistTitle(title: string): { artist: string; title: string } {
  // Common formats: "Artist - Album Title" or "Artist – Album Title"
  const separators = [" - ", " – ", " — ", ": "];

  for (const sep of separators) {
    if (title.includes(sep)) {
      const [artist, ...rest] = title.split(sep);
      return {
        artist: artist.trim(),
        title: rest.join(sep).trim(),
      };
    }
  }

  // If no separator found, use entire title as both
  return { artist: "Various", title: title.trim() };
}

function extractSnippet(content: string): string | null {
  // Strip HTML tags and get first ~200 characters
  const text = content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > 650) {
    return text.substring(0, 650) + "...";
  }
  return text || null;
}

export async function scrapeNowaMuzyka(): Promise<number> {
  const source = await getSourceByName("Nowa Muzyka");
  if (!source) {
    console.error("Nowa Muzyka source not found in database");
    return 0;
  }

  console.log("Fetching Nowa Muzyka RSS feed...");

  const feed = await parser.parseURL(source.url);
  let newCount = 0;

  for (const item of feed.items as RSSItem[]) {
    if (!item.title || !item.link) {
      continue;
    }

    const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

    // Only include 2026 items
    if (!publishedAt.startsWith("2026")) {
      console.log(`Skipping (not 2026): ${item.title} (${publishedAt.substring(0, 10)})`);
      continue;
    }

    const { artist, title } = parseArtistTitle(item.title);
    const content = item["content:encoded"] || item.content || "";
    let coverImage = extractCoverImage(content) || item.enclosure?.url || null;
    const snippet = extractSnippet(content);

    // Fetch og:image from article page if no cover found
    if (!coverImage && item.link) {
      coverImage = await fetchOgImage(item.link);
    }

    // Extract genre, label, and album ID from Bandcamp if available
    let genre: string | null = null;
    let label: string | null = null;
    let bcUrl: string | null = null;
    let bcAlbumId: string | null = null;
    const bandcampUrl = extractBandcampUrl(content);
    if (bandcampUrl) {
      console.log(`  Fetching data from ${bandcampUrl}...`);
      const bandcampData = await fetchBandcampData(bandcampUrl);
      genre = bandcampData.genres;
      label = bandcampData.label;
      if (bandcampData.albumId) {
        bcUrl = bandcampUrl;
        bcAlbumId = bandcampData.albumId;
        console.log(`  Found Bandcamp album ID: ${bcAlbumId}`);
      }
    }

    const release: ReleaseInput = {
      source_id: source.id,
      artist,
      title,
      label,
      genre: normalizeGenre(genre),
      cover_image: coverImage,
      review_url: item.link,
      review_snippet: snippet,
      published_at: publishedAt,
      raw_data: JSON.stringify(item),
      bandcamp_url: bcUrl,
      bandcamp_album_id: bcAlbumId,
    };

    const inserted = await insertRelease(release);
    if (inserted) {
      newCount++;
      console.log(`Added: ${artist} - ${title} (${genre || "no genre"})`);
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  await updateSourceLastFetched(source.id);
  console.log(`Nowa Muzyka: ${newCount} new releases added`);

  return newCount;
}
