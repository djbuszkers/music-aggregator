import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { getSourceByName, insertRelease, updateSourceLastFetched } from "../db";
import { normalizeGenre } from "../utils";
import type { ReleaseInput } from "../types";

const parser = new Parser({
  customFields: {
    item: ["dc:creator"],
  },
});

function parseArtistTitle(text: string): { artist: string; title: string } {
  // Pattern: "Artist: Album Title"
  const colonMatch = text.match(/^(.+?):\s*(.+)$/);
  if (colonMatch) {
    return { artist: colonMatch[1].trim(), title: colonMatch[2].trim() };
  }

  const dashMatch = text.match(/^(.+?)\s*[–—-]\s*(.+)$/);
  if (dashMatch) {
    return { artist: dashMatch[1].trim(), title: dashMatch[2].trim() };
  }

  return { artist: "Various", title: text.trim() };
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

interface ReviewDetails {
  label: string | null;
  genres: string[];
  description: string | null;
  coverImage: string | null;
}

async function scrapeReviewDetails(url: string): Promise<ReviewDetails> {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  // Extract label and genres from article classes
  // Pattern: labels-alpengluhen, genres-deep-house
  let label: string | null = null;
  const genres: string[] = [];

  const article = $("article").first();
  const articleClasses = article.attr("class") || "";

  // Extract label from class like "labels-alpengluhen"
  const labelMatch = articleClasses.match(/labels-([a-z0-9-]+)/i);
  if (labelMatch) {
    // Convert slug to readable name (alpengluhen -> Alpengluhen)
    label = labelMatch[1]
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Extract genres from classes like "genres-deep-house"
  const genreRegex = /genres-([a-z0-9-]+)/gi;
  const seenGenres = new Set<string>();
  let genreMatch;
  while ((genreMatch = genreRegex.exec(articleClasses)) !== null) {
    const genreSlug = genreMatch[1];
    // Skip numeric suffixes like "dub-2"
    if (genreSlug.match(/^\d+$/) || genreSlug.match(/-\d+$/)) {
      const cleanSlug = genreSlug.replace(/-\d+$/, "");
      if (cleanSlug && !seenGenres.has(cleanSlug)) {
        seenGenres.add(cleanSlug);
        const genreName = cleanSlug
          .split("-")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        genres.push(genreName);
      }
    } else if (!seenGenres.has(genreSlug)) {
      seenGenres.add(genreSlug);
      const genreName = genreSlug
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      genres.push(genreName);
    }
  }

  // Extract description - first paragraph of review content
  let description: string | null = null;
  const contentSelectors = [".entry-content p", "article p", ".post-content p"];
  for (const selector of contentSelectors) {
    const p = $(selector).first();
    if (p.length > 0) {
      const text = p.text().trim();
      if (text.length > 50) {
        description = text.length > 650 ? text.substring(0, 650) + "..." : text;
        break;
      }
    }
  }

  // Get cover image from og:image or article
  let coverImage: string | null = null;
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) {
    coverImage = ogImage;
  } else {
    const mainImg = $("article img, .entry-content img").first();
    if (mainImg.length > 0) {
      coverImage = mainImg.attr("data-src") || mainImg.attr("src") || null;
    }
  }

  return { label, genres, description, coverImage };
}

export async function scrapeInvertedAudio(): Promise<number> {
  const source = await getSourceByName("Inverted Audio");
  if (!source) {
    console.error("Inverted Audio source not found in database");
    return 0;
  }

  console.log("Fetching Inverted Audio RSS feed...");

  const feed = await parser.parseURL("https://inverted-audio.com/review/feed/");
  let newCount = 0;

  for (const item of feed.items) {
    if (!item.title || !item.link || !item.pubDate) {
      continue;
    }

    const publishedAt = new Date(item.pubDate).toISOString();

    // Only include 2026 items
    if (!publishedAt.startsWith("2026")) {
      console.log(`Skipping (not 2026): ${item.title} (${publishedAt.substring(0, 10)})`);
      continue;
    }

    const { artist, title } = parseArtistTitle(item.title);

    // Fetch details from individual review page
    let details: ReviewDetails;
    try {
      details = await scrapeReviewDetails(item.link);
    } catch (err) {
      console.log(`Failed to fetch details for ${artist} - ${title}`);
      details = { label: null, genres: [], description: null, coverImage: null };
    }

    const release: ReleaseInput = {
      source_id: source.id,
      artist,
      title,
      label: details.label,
      genre: normalizeGenre(details.genres.join(", ")),
      cover_image: details.coverImage,
      review_url: item.link,
      review_snippet: details.description || null,
      published_at: publishedAt,
    };

    const inserted = await insertRelease(release);
    if (inserted) {
      newCount++;
      console.log(`Added: ${artist} - ${title} (${details.genres.join(", ") || "no genre"})`);
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 300));
  }

  await updateSourceLastFetched(source.id);
  console.log(`Inverted Audio: ${newCount} new releases added`);

  return newCount;
}
