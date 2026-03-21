import * as cheerio from "cheerio";
import { getSourceByName, insertRelease, updateSourceLastFetched } from "../db";
import { normalizeGenre } from "../utils";
import type { ReleaseInput } from "../types";

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
  if (!/^album\s+review/i.test(rawTitle)) return null;
  if (/roundup|week ending/i.test(rawTitle)) return null;

  const format1 = rawTitle.match(/^album\s+review\s*[–—-]+\s*(.+?):\s*(.+)$/i);
  if (format1) {
    return { artist: toTitleCase(format1[1].trim()), title: toTitleCase(format1[2].trim()) };
  }

  const format2 = rawTitle.match(/^album\s+review\s*:\s*(.+?)\s*[–—-]+\s*(.+)$/i);
  if (format2) {
    return { artist: toTitleCase(format2[1].trim()), title: toTitleCase(format2[2].trim()) };
  }

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

// Ordered from most to least specific to avoid false positives
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
    if (found.length >= 3) break;
  }
  return found;
}

interface ArticleDetails {
  title: string | null;
  publishedAt: string | null;
  coverImage: string | null;
  snippet: string | null;
  reviewText: string;
}

async function scrapeArticle(url: string, urlDateFallback?: string): Promise<ArticleDetails> {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim() || null;

  // Date format: "Friday, March 20, 2026" or "20 MARCH 2026"
  let publishedAt: string | null = null;
  const dateText = $(".date, .post-date, time").first().text().trim();
  if (dateText) {
    const parsed = new Date(dateText);
    if (!isNaN(parsed.getTime())) {
      publishedAt = parsed.toISOString();
    }
  }
  // Fallback: JSON-LD datePublished
  if (!publishedAt) {
    $("script[type='application/ld+json']").each((_, el) => {
      if (publishedAt) return;
      try {
        const raw = ($(el).html() || "").replace(/\/\*<!\[CDATA\[\*\//g, "").replace(/\/\*\]\]>\*\//g, "").trim();
        const data = JSON.parse(raw || "{}");
        const dp = data.datePublished || data.dateModified;
        if (dp) publishedAt = new Date(String(dp).replace(" ", "T")).toISOString();
      } catch { /* ignore */ }
    });
  }
  // Last resort: use date inferred from URL path (MM/DD + current year)
  if (!publishedAt && urlDateFallback) {
    publishedAt = urlDateFallback;
  }

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

  return { title, publishedAt, coverImage, snippet, reviewText };
}

function getArticleUrlsFromListingPage(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    // Match article URLs: /MM/DD/slug/ — skip roundups, live reviews, gig guides
    if (
      /^https:\/\/www\.silentradio\.co\.uk\/\d{2}\/\d{2}\//.test(href) &&
      !/album-roundup|live-review|gig-guide|single-review|ep-review/.test(href)
    ) {
      urls.add(href.replace(/\/$/, "") + "/");
    }
  });
  return Array.from(urls);
}

export async function scrapeSilentRadio(): Promise<number> {
  const source = await getSourceByName("Silent Radio");
  if (!source) {
    console.error("Silent Radio source not found in database");
    return 0;
  }

  console.log("Scraping Silent Radio archive pages...");

  const allUrls = new Set<string>();
  let page = 1;
  let foundAny2026 = true;

  const currentMonth = new Date().getMonth() + 1; // 1-12
  const MAX_PAGES = 10; // safety ceiling

  // Walk listing pages until all article URLs on a page are from months > currentMonth
  // (indicating they're all from last year). Cap at MAX_PAGES.
  while (foundAny2026 && page <= MAX_PAGES) {
    const listingUrl = page === 1
      ? "https://www.silentradio.co.uk/category/reviews/album-reviews/"
      : `https://www.silentradio.co.uk/category/reviews/album-reviews/page/${page}/`;

    let listingHtml: string;
    try {
      listingHtml = await fetchPage(listingUrl);
    } catch {
      break;
    }

    // Stop if we got a 404
    if (listingHtml.includes("Error 404") || listingHtml.includes("Page not found")) break;

    const pageUrls = getArticleUrlsFromListingPage(listingHtml);
    if (pageUrls.length === 0) break;

    // Check if this page has any articles from months <= currentMonth (plausibly 2026).
    // URL format: /MM/DD/slug — extract month numbers.
    const hasPlausible2026 = pageUrls.some(url => {
      const m = url.match(/\/(\d{2})\/\d{2}\//);
      return m && parseInt(m[1], 10) <= currentMonth;
    });
    if (!hasPlausible2026) { foundAny2026 = false; break; }

    for (const url of pageUrls) allUrls.add(url);
    page++;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`Found ${allUrls.size} candidate article URLs across ${page - 1} pages`);

  let newCount = 0;

  const currentYear = new Date().getFullYear();

  for (const url of allUrls) {
    // Infer date from URL path as last-resort fallback: /MM/DD/ + current year.
    // Only use for months <= current month to avoid misclassifying prior-year articles.
    const urlDateMatch = url.match(/\/(\d{2})\/(\d{2})\//);
    const urlMonth = urlDateMatch ? parseInt(urlDateMatch[1], 10) : 0;
    const urlDateFallback = urlDateMatch && urlMonth <= new Date().getMonth() + 1
      ? `${currentYear}-${urlDateMatch[1]}-${urlDateMatch[2]}T00:00:00.000Z`
      : undefined;

    let details: ArticleDetails;
    try {
      details = await scrapeArticle(url, urlDateFallback);
    } catch {
      console.log(`Failed to fetch: ${url}`);
      await new Promise(r => setTimeout(r, 300));
      continue;
    }

    if (!details.publishedAt || !details.publishedAt.startsWith("2026")) {
      console.log(`Skipping (not 2026): ${url}`);
      await new Promise(r => setTimeout(r, 300));
      continue;
    }

    if (!details.title) {
      console.log(`Skipping (no title): ${url}`);
      await new Promise(r => setTimeout(r, 300));
      continue;
    }

    const parsed = parseArtistTitle(details.title);
    if (!parsed) {
      console.log(`Skipping (not a standard review): ${details.title}`);
      await new Promise(r => setTimeout(r, 300));
      continue;
    }

    const { artist, title } = parsed;
    const detectedGenres = detectGenresFromText(details.reviewText);

    const release: ReleaseInput = {
      source_id: source.id,
      artist,
      title,
      label: null,
      genre: detectedGenres.length > 0 ? normalizeGenre(detectedGenres.join(", ")) : null,
      cover_image: details.coverImage,
      review_url: url,
      review_snippet: details.snippet,
      published_at: details.publishedAt,
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
