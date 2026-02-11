import * as cheerio from "cheerio";
import { getSourceByName, insertRelease, updateSourceLastFetched } from "../db";
import { normalizeGenre } from "../utils";
import type { ReleaseInput } from "../types";

const GENRE_KEYWORDS: Record<string, string> = {
  "neo-soul": "neo-soul",
  "neo soul": "neo-soul",
  "r&b": "r&b",
  "rhythm and blues": "r&b",
  "hip-hop": "hip-hop",
  "hip hop": "hip-hop",
  "rap": "hip-hop",
  "soul": "soul",
  "funk": "funk",
  "jazz": "jazz",
  "gospel": "soul",
  "afrobeat": "world",
  "afrobeats": "world",
  "reggae": "dub",
};

interface ArchivePost {
  title: string;
  slug: string;
  post_date: string;
  canonical_url: string;
}

function parseAlbumReviewTitle(title: string): { artist: string; albumTitle: string } | null {
  // Format: "Album Review: [Album] by [Artist]"
  const match = title.match(/^Album Review:\s*(.+)\s+by\s+(.+)$/i);
  if (!match) return null;

  // Split on last " by " to handle album titles containing "by"
  const fullText = title.replace(/^Album Review:\s*/i, "");
  const lastByIndex = fullText.lastIndexOf(" by ");
  if (lastByIndex === -1) return null;

  const albumTitle = fullText.substring(0, lastByIndex).trim();
  const artist = fullText.substring(lastByIndex + 4).trim();

  return { artist, albumTitle };
}

function detectGenresFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  for (const [keyword, genre] of Object.entries(GENRE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      found.add(genre);
    }
  }

  return Array.from(found);
}

function extractStarRating(html: string): number | null {
  // Count filled star characters (★)
  const stars = (html.match(/★/g) || []).length;
  return stars > 0 ? stars : null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

interface ArticleDetails {
  coverImage: string | null;
  reviewSnippet: string | null;
  genres: string[];
  starRating: number | null;
}

async function scrapeArticlePage(url: string): Promise<ArticleDetails> {
  const html = await fetchPage(url);
  if (!html) {
    return { coverImage: null, reviewSnippet: null, genres: [], starRating: null };
  }

  const $ = cheerio.load(html);

  // Cover image from og:image
  const coverImage = $('meta[property="og:image"]').attr("content") || null;

  // Review snippet: collect substantial paragraphs from article body
  let reviewText = "";
  const bodySelectors = [".body p", "article p", ".post-content p", ".entry-content p"];
  for (const selector of bodySelectors) {
    const paragraphs = $(selector);
    if (paragraphs.length > 0) {
      paragraphs.each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 100) {
          reviewText += (reviewText ? " " : "") + text;
        }
      });
      if (reviewText) break;
    }
  }

  const reviewSnippet = reviewText
    ? (reviewText.length > 650 ? reviewText.substring(0, 650) + "..." : reviewText)
    : null;

  // Detect genres from review text
  const fullText = $("article").text() || $(".body").text() || "";
  const genres = detectGenresFromText(fullText);

  // Star rating
  const starRating = extractStarRating(html);

  return { coverImage, reviewSnippet, genres, starRating };
}

/**
 * Fetches album review posts from Substack's archive API.
 * Paginates through results until we hit posts older than 2026.
 */
async function fetchAlbumReviewPosts(): Promise<ArchivePost[]> {
  const posts: ArchivePost[] = [];
  const batchSize = 50;
  let offset = 0;

  while (true) {
    const url = `https://www.shatterthestandards.com/api/v1/archive?sort=new&offset=${offset}&limit=${batchSize}`;
    console.log(`  Fetching archive offset=${offset}...`);

    const data = (await fetchJson(url)) as Array<{
      title?: string;
      slug?: string;
      post_date?: string;
      canonical_url?: string;
    }>;

    if (!Array.isArray(data) || data.length === 0) break;

    let foundPre2026 = false;
    for (const post of data) {
      if (!post.title || !post.post_date || !post.canonical_url) continue;

      // Stop paginating once we hit pre-2026 posts
      if (!post.post_date.startsWith("2026")) {
        foundPre2026 = true;
        continue;
      }

      // Only album reviews (skip mixtape reviews, roundups, etc.)
      if (!post.title.toLowerCase().startsWith("album review:")) continue;

      posts.push({
        title: post.title,
        slug: post.slug || "",
        post_date: post.post_date,
        canonical_url: post.canonical_url,
      });
    }

    // If we've seen pre-2026 posts, we're past all 2026 content
    if (foundPre2026) break;

    offset += batchSize;

    // Safety limit
    if (offset > 500) break;

    await new Promise(r => setTimeout(r, 300));
  }

  return posts;
}

export async function scrapeShatterTheStandards(): Promise<number> {
  const source = await getSourceByName("Shatter the Standards");
  if (!source) {
    console.error("Shatter the Standards source not found in database");
    return 0;
  }

  console.log("Fetching Shatter the Standards album reviews via archive API...");

  const posts = await fetchAlbumReviewPosts();
  console.log(`Found ${posts.length} album review(s) from 2026`);

  let newCount = 0;

  for (const post of posts) {
    const parsed = parseAlbumReviewTitle(post.title);
    if (!parsed) {
      console.log(`Could not parse title: ${post.title}`);
      continue;
    }

    const { artist, albumTitle } = parsed;
    const publishedAt = new Date(post.post_date).toISOString();

    // Fetch article page details
    let details: ArticleDetails;
    try {
      details = await scrapeArticlePage(post.canonical_url);
    } catch (err) {
      console.log(`Failed to fetch details for ${artist} - ${albumTitle}`);
      details = { coverImage: null, reviewSnippet: null, genres: [], starRating: null };
    }

    const genre = normalizeGenre(details.genres.join(", "));

    const rawData = details.starRating
      ? JSON.stringify({ starRating: details.starRating })
      : null;

    const release: ReleaseInput = {
      source_id: source.id,
      artist,
      title: albumTitle,
      genre,
      cover_image: details.coverImage,
      review_url: post.canonical_url,
      review_snippet: details.reviewSnippet,
      published_at: publishedAt,
      raw_data: rawData,
    };

    const inserted = await insertRelease(release);
    if (inserted) {
      newCount++;
      console.log(`Added: ${artist} - ${albumTitle} (${genre || "no genre"})${details.starRating ? ` [${details.starRating}★]` : ""}`);
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 300));
  }

  await updateSourceLastFetched(source.id);
  console.log(`Shatter the Standards: ${newCount} new releases added`);

  return newCount;
}
