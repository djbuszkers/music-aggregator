import Parser from "rss-parser";
import { getSourceByName, insertRelease, updateSourceLastFetched } from "../db";
import type { ReleaseInput } from "../types";

const parser = new Parser({
  customFields: {
    item: ["content:encoded", "enclosure"],
  },
});

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

  if (text.length > 200) {
    return text.substring(0, 200) + "...";
  }
  return text || null;
}

export async function scrapeNowaMuzyka(): Promise<number> {
  const source = getSourceByName("Nowa Muzyka");
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

    const { artist, title } = parseArtistTitle(item.title);
    const content = item["content:encoded"] || item.content || "";
    const coverImage = extractCoverImage(content) || item.enclosure?.url || null;
    const snippet = extractSnippet(content);

    const release: ReleaseInput = {
      source_id: source.id,
      artist,
      title,
      cover_image: coverImage,
      review_url: item.link,
      review_snippet: snippet,
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      raw_data: JSON.stringify(item),
    };

    const inserted = insertRelease(release);
    if (inserted) {
      newCount++;
      console.log(`Added: ${artist} - ${title}`);
    }
  }

  updateSourceLastFetched(source.id);
  console.log(`Nowa Muzyka: ${newCount} new releases added`);

  return newCount;
}
