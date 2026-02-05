import puppeteer from "puppeteer";
import { getSourceByName, insertRelease, updateSourceLastFetched } from "../db";
import { normalizeGenre } from "../utils";
import type { ReleaseInput } from "../types";

const BASE_URL = "https://ra.co";

function parseRADate(dateText: string | null): string {
  if (!dateText) return new Date().toISOString();

  // Month name mappings (English + Polish)
  const monthMap: Record<string, string> = {
    // English
    jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun",
    jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec",
    // Polish
    sty: "Jan", lut: "Feb", mrz: "Mar", kwi: "Apr", maj: "May", cze: "Jun",
    lip: "Jul", sie: "Aug", wrz: "Sep", paz: "Oct", lis: "Nov", gru: "Dec",
  };

  // Parse "6 Nov 2025" or "6 lis 2025" format
  const match = dateText.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/i);
  if (match) {
    const [, day, monthRaw, year] = match;
    const monthKey = monthRaw.toLowerCase();
    const month = monthMap[monthKey] || monthRaw;
    const date = new Date(`${month} ${day}, ${year}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

export async function scrapeRA(): Promise<number> {
  const source = await getSourceByName("Resident Advisor");
  if (!source) {
    console.error("Resident Advisor source not found in database");
    return 0;
  }

  console.log("Fetching Resident Advisor reviews page...");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(source.url, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 3000));

    const isBlocked = await page.evaluate(() => {
      return document.body.innerText.includes("have been blocked");
    });

    if (isBlocked) {
      console.error("Blocked by Cloudflare");
      return 0;
    }

    console.log("Page loaded, extracting reviews...");

    // Extract review URLs and basic info from list page
    const reviewsFromList = await page.evaluate(() => {
      const items: Array<{
        href: string;
        label: string;
        artistTitle: string;
        snippet: string;
        coverImage: string | null;
      }> = [];

      const seen = new Set<string>();

      document.querySelectorAll('a[href*="/reviews/"]').forEach((a) => {
        const href = a.getAttribute("href");
        if (!href || !href.match(/\/reviews\/\d+$/) || seen.has(href)) return;

        const text = a.textContent?.trim();
        if (!text || !text.match(/\s[-–—]\s/)) return;

        seen.add(href);

        let container = a.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;

        let label = "";
        const labelLink = container?.querySelector('a[href*="/labels/"]');
        if (labelLink) {
          label = labelLink.textContent?.trim() || "";
        }

        let snippet = "";
        const containerText = container?.innerText || "";
        const titleIndex = containerText.indexOf(text);
        if (titleIndex > -1) {
          snippet = containerText.substring(titleIndex + text.length).trim();
          const lines = snippet.split("\n");
          if (lines.length > 1) {
            snippet = lines[0];
          }
        }

        let coverImage: string | null = null;
        const img = container?.querySelector("img");
        if (img) {
          coverImage = img.getAttribute("src");
        }

        items.push({
          href,
          label,
          artistTitle: text,
          snippet: snippet.substring(0, 650),
          coverImage,
        });
      });

      return items;
    });

    console.log(`Found ${reviewsFromList.length} unique reviews, fetching dates and genres...`);

    let newCount = 0;

    // Visit each review page to get the date
    for (const review of reviewsFromList) {
      const match = review.artistTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/);
      if (!match) {
        console.log(`Could not parse artist/title: ${review.artistTitle}`);
        continue;
      }

      const artist = match[1].trim();
      const title = match[2].trim();

      const reviewUrl = review.href.startsWith("http")
        ? review.href
        : `${BASE_URL}${review.href}`;

      // Visit individual review page to get date, genres, description, and cover image
      let dateText: string | null = null;
      let genres: string | null = null;
      let description: string | null = null;
      let coverImage: string | null = null;
      try {
        await page.goto(reviewUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await new Promise((r) => setTimeout(r, 1000));

        const pageData = await page.evaluate(() => {
          const text = document.body.innerText;
          const dateMatch = text.match(/(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/);

          // Extract og:image
          const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || null;

          // Extract genres - look for links to /reviews/singles?genre=XXX
          const genreLinks = Array.from(document.querySelectorAll('a[href*="genre="]'));
          const genreTexts: string[] = [];
          const seenGenres = new Set<string>();
          genreLinks.forEach((link) => {
            const genreText = link.textContent?.trim();
            if (genreText && genreText.length > 1 && genreText.length < 50 && !seenGenres.has(genreText)) {
              seenGenres.add(genreText);
              genreTexts.push(genreText);
            }
          });

          // Extract description from span[color="primary"] in review-detail section
          let desc: string | null = null;
          const descSpan = document.querySelector('section[data-tracking-id="review-detail"] span[color="primary"]');
          if (descSpan) {
            desc = descSpan.textContent?.trim() || null;
          }

          return {
            date: dateMatch ? dateMatch[1] : null,
            genres: genreTexts.length > 0 ? genreTexts.join("; ") : null,
            description: desc,
            coverImage: ogImage,
          };
        });

        dateText = pageData.date;
        genres = pageData.genres;
        description = pageData.description;
        coverImage = pageData.coverImage;
      } catch (err) {
        console.log(`Failed to fetch data for ${artist} - ${title}`);
      }

      // Only include entries from 2026
      if (!dateText || !dateText.includes("2026")) {
        console.log(`Skipping (not 2026): ${artist} - ${title} (${dateText || "no date"})`);
        continue;
      }

      const release: ReleaseInput = {
        source_id: source.id,
        artist,
        title,
        label: review.label || null,
        genre: normalizeGenre(genres),
        cover_image: coverImage || review.coverImage,
        review_url: reviewUrl,
        review_snippet: description || null,
        published_at: parseRADate(dateText),
      };

      const inserted = await insertRelease(release);
      if (inserted) {
        newCount++;
        console.log(`Added: ${artist} - ${title} (${genres || "no genre"})`);
      }

      // Small delay between requests
      await new Promise((r) => setTimeout(r, 500));
    }

    await updateSourceLastFetched(source.id);
    console.log(`Resident Advisor: ${newCount} new releases added`);

    return newCount;
  } finally {
    await browser.close();
  }
}
