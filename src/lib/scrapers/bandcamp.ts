import * as cheerio from "cheerio";
import { getSourceByName, insertRelease, updateSourceLastFetched } from "../db";
import type { ReleaseInput } from "../types";

const BASE_URL = "https://daily.bandcamp.com";

interface BandcampRelease {
  artist: string;
  title: string;
  coverImage: string | null;
  reviewUrl: string;
  publishedAt: string;
}

function parseArtistTitle(text: string): { artist: string; title: string } | null {
  // Bandcamp format: Artist Name, "Album Title" (with curly quotes)
  // Handle various quote styles including Unicode curly quotes "" (U+201C, U+201D)
  const match = text.match(/^(.+?),\s*["""\u201C\u201D''\u2018\u2019«»](.+?)["""\u201C\u201D''\u2018\u2019«»]\s*$/);
  if (match) {
    return {
      artist: match[1].trim(),
      title: match[2].trim(),
    };
  }
  return null;
}

function parseDate(text: string): string {
  // Parse date like "January 31, 2026" or "February 02, 2026"
  const dateMatch = text.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (dateMatch) {
    const [, month, day, year] = dateMatch;
    const date = new Date(`${month} ${day}, ${year}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

async function fetchPageData(url: string): Promise<{ genre: string | null; description: string | null }> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { genre: null, description: null };

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract genre from div.genre a
    const genre = $("div.genre a").first().text().trim() || null;

    // Extract first paragraph from review body
    // The review paragraphs come after the player sidebar
    let description: string | null = null;
    $("p").each((_, el) => {
      if (description) return; // Already found
      const text = $(el).text().trim();
      // Look for substantial paragraphs that look like review content
      if (text.length > 100 && !text.includes("Buy") && !text.includes("Subscribe")) {
        description = text;
      }
    });

    return { genre, description };
  } catch (err) {
    return { genre: null, description: null };
  }
}

export async function scrapeBandcamp(): Promise<number> {
  const source = getSourceByName("Bandcamp Daily");
  if (!source) {
    console.error("Bandcamp Daily source not found in database");
    return 0;
  }

  console.log("Fetching Bandcamp Daily album-of-the-day page...");

  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Bandcamp: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // First, collect all releases from the list page
  const releases: BandcampRelease[] = [];

  $("div.list-article.aotd").each((_, element) => {
    const $article = $(element);

    const $titleLink = $article.find("a.title");
    const href = $titleLink.attr("href");
    const text = $titleLink.text().trim();

    if (!text || !href) {
      return;
    }

    const parsed = parseArtistTitle(text);
    if (!parsed) {
      console.log(`Could not parse: ${text}`);
      return;
    }

    const reviewUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const $img = $article.find("img").first();
    const coverImage = $img.attr("src") || null;
    const $infoText = $article.find(".article-info-text");
    const infoText = $infoText.text();
    const publishedAt = parseDate(infoText);

    releases.push({
      artist: parsed.artist,
      title: parsed.title,
      coverImage,
      reviewUrl,
      publishedAt,
    });
  });

  console.log(`Found ${releases.length} releases, fetching genres and descriptions...`);

  let newCount = 0;

  // Now fetch genre and description from each individual page
  for (const release of releases) {
    const { genre, description } = await fetchPageData(release.reviewUrl);

    // Build review snippet with genre and description
    let reviewSnippet: string | null = null;
    if (genre || description) {
      const parts: string[] = [];
      if (genre) parts.push(`Genre: ${genre}`);
      if (description) parts.push(description);
      reviewSnippet = parts.join("\n\n");
    }

    const releaseInput: ReleaseInput = {
      source_id: source.id,
      artist: release.artist,
      title: release.title,
      cover_image: release.coverImage,
      review_url: release.reviewUrl,
      review_snippet: reviewSnippet,
      published_at: release.publishedAt,
    };

    const inserted = insertRelease(releaseInput);
    if (inserted) {
      newCount++;
      console.log(`Added: ${release.artist} - ${release.title} (${genre || "no genre"})`);
    }

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 300));
  }

  updateSourceLastFetched(source.id);
  console.log(`Bandcamp Daily: ${newCount} new releases added`);

  return newCount;
}
