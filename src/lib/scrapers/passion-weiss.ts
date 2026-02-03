import Parser from "rss-parser";
import { getSourceByName, insertRelease, updateSourceLastFetched } from "../db";
import type { ReleaseInput } from "../types";

const parser = new Parser({
  customFields: {
    item: ["content:encoded", "dc:creator"],
  },
});

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  "content:encoded"?: string;
  content?: string;
  "dc:creator"?: string;
  creator?: string;
  categories?: string[];
}

function extractCoverImage(content: string): string | null {
  // Try to find image in content - WordPress often uses wp-image class
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    return imgMatch[1];
  }
  return null;
}

function parseArtistTitle(title: string): { artist: string; title: string } {
  // Passion of the Weiss title patterns:
  // "Artist Name – Album Title" (em dash)
  // "Artist Name - Album Title" (hyphen)
  // "Artist Name's 'Album Title'"
  // "Album Title by Artist Name"
  // "Review: Artist - Album"

  // Remove common prefixes
  let cleanTitle = title
    .replace(/^(Review|Album Review|Music Review):\s*/i, "")
    .trim();

  // Try various separators (em dash, en dash, hyphen)
  const separators = [" – ", " — ", " - "];
  for (const sep of separators) {
    if (cleanTitle.includes(sep)) {
      const parts = cleanTitle.split(sep);
      if (parts.length >= 2) {
        return {
          artist: parts[0].trim(),
          title: parts.slice(1).join(sep).trim(),
        };
      }
    }
  }

  // Try "by" pattern: "Album Title by Artist Name"
  const byMatch = cleanTitle.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return {
      artist: byMatch[2].trim(),
      title: byMatch[1].trim(),
    };
  }

  // Try possessive pattern: "Artist's 'Album Title'" or "Artist's Album Title"
  const possessiveMatch = cleanTitle.match(/^(.+?)'s\s+['"]?(.+?)['"]?$/i);
  if (possessiveMatch) {
    return {
      artist: possessiveMatch[1].trim(),
      title: possessiveMatch[2].trim().replace(/['"]/g, ""),
    };
  }

  // If no pattern matches, use full title
  return { artist: "Various", title: cleanTitle };
}

function extractSnippet(content: string): string | null {
  // Strip HTML tags and get first ~250 characters
  const text = content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > 250) {
    return text.substring(0, 250) + "...";
  }
  return text || null;
}

function isAlbumReview(item: RSSItem): boolean {
  // Check if this item is an album review based on categories
  const categories = item.categories || [];
  const categoryStrings = categories.map((c) =>
    typeof c === "string" ? c.toLowerCase() : ""
  );

  return (
    categoryStrings.includes("album reviews") ||
    categoryStrings.includes("reviews") ||
    categoryStrings.some((c) => c.includes("review"))
  );
}

export async function scrapePassionWeiss(): Promise<number> {
  const source = getSourceByName("Passion of the Weiss");
  if (!source) {
    console.error("Passion of the Weiss source not found in database");
    return 0;
  }

  console.log("Fetching Passion of the Weiss RSS feed...");

  const feed = await parser.parseURL(source.url);
  let newCount = 0;

  for (const item of feed.items as RSSItem[]) {
    if (!item.title || !item.link) {
      continue;
    }

    // Filter to album reviews only (optional - can be removed to get all content)
    // Commenting out for now since PoW doesn't always categorize consistently
    // if (!isAlbumReview(item)) {
    //   continue;
    // }

    const { artist, title } = parseArtistTitle(item.title);
    const content = item["content:encoded"] || item.content || "";
    const coverImage = extractCoverImage(content);
    const snippet = extractSnippet(content);
    const author = item["dc:creator"] || item.creator || null;

    const release: ReleaseInput = {
      source_id: source.id,
      artist,
      title,
      cover_image: coverImage,
      review_url: item.link,
      review_snippet: snippet,
      published_at: item.pubDate
        ? new Date(item.pubDate).toISOString()
        : new Date().toISOString(),
      raw_data: JSON.stringify({
        ...item,
        author,
      }),
    };

    const inserted = insertRelease(release);
    if (inserted) {
      newCount++;
      console.log(`Added: ${artist} - ${title}`);
    }
  }

  updateSourceLastFetched(source.id);
  console.log(`Passion of the Weiss: ${newCount} new releases added`);

  return newCount;
}
