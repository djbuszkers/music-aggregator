import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { getSourceByName, insertRelease, updateSourceLastFetched } from "../db";
import { normalizeGenre } from "../utils";
import type { ReleaseInput } from "../types";

puppeteer.use(StealthPlugin());

const BASE_URL = "https://boomkat.com";

function parseBoomkatDate(dateText: string | null): string {
  if (!dateText) return new Date().toISOString();

  // Parse "Release date: 30 January 2026" or "30 January 2026" format
  const match = dateText.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(`${month} ${day}, ${year}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

export async function scrapeBoomkat(): Promise<number> {
  const source = await getSourceByName("Boomkat");
  if (!source) {
    console.error("Boomkat source not found in database");
    return 0;
  }

  console.log("Fetching Boomkat weekly roundup...");

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
    await page.goto(`${BASE_URL}/weekly-roundup`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await new Promise((r) => setTimeout(r, 3000));

    // Check if blocked or page not found
    const pageStatus = await page.evaluate(() => {
      const text = document.body.innerText;
      if (
        text.includes("Access Denied") ||
        text.includes("403") ||
        document.title.includes("Just a moment") ||
        document.title.includes("Attention Required") ||
        text.includes("Enable JavaScript and cookies to continue") ||
        text.includes("Checking your browser") ||
        text.includes("cf-browser-verification") ||
        document.querySelector("#challenge-form") !== null
      ) {
        return "blocked";
      }
      if (text.includes("Page Not Found")) {
        return "not_found";
      }
      return "ok";
    });

    if (pageStatus !== "ok") {
      console.error(`Boomkat page status: ${pageStatus}`);
      return 0;
    }

    console.log("Page loaded, extracting releases...");

    // Extract releases - look for product links and parse the surrounding text
    const releases = await page.evaluate(() => {
      const items: Array<{
        href: string;
        artist: string;
        title: string;
        label: string | null;
        genre: string | null;
        coverImage: string | null;
      }> = [];
      const seen = new Set<string>();

      // Find all product links
      document.querySelectorAll('a[href*="/products/"]').forEach((link) => {
        const href = link.getAttribute("href");
        if (!href || seen.has(href)) return;

        // Skip links that are clearly not release links (buttons, quick views, etc.)
        const linkText = link.textContent?.trim() || "";
        if (
          linkText.includes("Quick View") ||
          linkText.includes("MP3") ||
          linkText.includes("FLAC") ||
          linkText.includes("WAV") ||
          linkText.includes("VINYL") ||
          linkText.includes("CD") ||
          linkText.includes("TAPE") ||
          linkText.includes("CASSETTE") ||
          linkText.includes("LP") ||
          linkText.includes("12\"") ||
          linkText.includes("7\"") ||
          linkText.length < 3
        ) {
          return;
        }

        seen.add(href);

        // Navigate up to find the product card container
        let container = link.parentElement;
        for (let i = 0; i < 6 && container; i++) {
          // Look for a container that has artist/title structure
          const text = container.innerText || "";
          if (text.includes("\n") && text.length > 20 && text.length < 500) {
            break;
          }
          container = container.parentElement;
        }

        if (!container) return;

        const text = container.innerText?.trim() || "";
        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter(
            (l) =>
              l.length > 0 &&
              !l.startsWith("Play all") &&
              !l.includes("FREE MP3") &&
              !l.includes("ALBUM OF THE WEEK") &&
              !l.includes("SINGLE OF THE WEEK") &&
              !l.includes("Quick View") &&
              !l.match(/^(MP3|FLAC|WAV|LP|CD|TAPE|VINYL|12"|7"|CASSETTE|LIMITED|BLACK|COLOUR|GATEFOLD|\d+\s*[Xx]\s*\d+)/)
          );

        if (lines.length < 2) return;

        // First line is artist, second is title
        const artist = lines[0];
        const title = lines[1];

        // Skip if artist looks wrong or is a format descriptor
        if (
          artist.length < 2 ||
          artist.length > 100 ||
          artist.includes("more") ||
          artist.match(/^\d+$/) ||
          artist.match(/^(GATEFOLD|VINYL|LP|EP|CD|TAPE|CASSETTE|\d+\s*[Xx]\s*\d+)/i) ||
          artist.includes("(BLACK VINYL)") ||
          artist.includes("(COLOUR VINYL)")
        ) {
          return;
        }

        // Label is usually third line, genre is fourth
        const label = lines[2] && !lines[2].match(/^(Electronic|Techno|House|Jazz|Ambient|Modern|Folk|Indie|Extreme|Industrial)/i) ? lines[2] : null;
        const genre = lines.find((l) =>
          l.match(/^(Electronic|Techno|House|Jazz|Ambient|Modern|Folk|Indie|Extreme|Industrial)/i)
        ) || null;

        // Get cover image
        const img = container.querySelector("img");
        let coverImage = img?.getAttribute("src") || img?.getAttribute("data-src") || null;
        if (coverImage && (coverImage.includes("grey.gif") || coverImage.includes("placeholder"))) {
          coverImage = null;
        }

        items.push({
          href,
          artist,
          title,
          label,
          genre,
          coverImage,
        });
      });

      return items;
    });

    console.log(`Found ${releases.length} releases, fetching dates and genres...`);

    let newCount = 0;

    // Visit each product page to get the release date
    for (const release of releases) {
      const reviewUrl = release.href.startsWith("http")
        ? release.href
        : `${BASE_URL}${release.href}`;

      // Visit individual product page to get date, genre, description, and cover image
      let dateText: string | null = null;
      let genre: string | null = null;
      let description: string | null = null;
      let coverImage: string | null = null;
      try {
        await page.goto(reviewUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await new Promise((r) => setTimeout(r, 1000));

        const pageData = await page.evaluate(() => {
          const text = document.body.innerText;
          // Look for "Release date: DD Month YYYY" pattern
          const dateMatch = text.match(/Release date:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);

          // Extract og:image or product image
          let coverImg: string | null = null;
          const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
          if (ogImage) {
            coverImg = ogImage;
          } else {
            // Try to find main product image
            const productImg = document.querySelector('.product-main-image img, .product-image img, img[data-zoom-image]');
            if (productImg) {
              coverImg = productImg.getAttribute("data-zoom-image") || productImg.getAttribute("src") || null;
            }
          }

          // Extract genre - look for links to /genre/* pages
          const genreLinks = Array.from(document.querySelectorAll('a[href*="/genre/"]'));
          const genres: string[] = [];
          const seenGenres = new Set<string>();
          genreLinks.forEach((link) => {
            const genreText = link.textContent?.trim();
            if (genreText && genreText.length > 1 && genreText.length < 50 && !seenGenres.has(genreText)) {
              seenGenres.add(genreText);
              genres.push(genreText);
            }
          });

          // Extract description from div.product-review strong
          let description: string | null = null;
          const reviewStrong = document.querySelector("div.product-review strong");
          if (reviewStrong) {
            description = reviewStrong.textContent?.trim() || null;
          }

          return {
            date: dateMatch ? dateMatch[1] : null,
            genre: genres.length > 0 ? genres.join("; ") : null,
            description: description,
            coverImage: coverImg,
          };
        });

        dateText = pageData.date;
        genre = pageData.genre;
        description = pageData.description;
        coverImage = pageData.coverImage;
      } catch (err) {
        console.log(`Failed to fetch data for ${release.artist} - ${release.title}`);
      }

      // Only include entries from 2026
      if (!dateText || !dateText.includes("2026")) {
        console.log(`Skipping (not 2026): ${release.artist} - ${release.title} (${dateText || "no date"})`);
        continue;
      }

      const releaseInput: ReleaseInput = {
        source_id: source.id,
        artist: release.artist,
        title: release.title,
        label: release.label,
        genre: normalizeGenre(genre),
        cover_image: coverImage || release.coverImage,
        review_url: reviewUrl,
        review_snippet: description || null,
        published_at: parseBoomkatDate(dateText),
      };

      const inserted = await insertRelease(releaseInput);
      if (inserted) {
        newCount++;
        console.log(`Added: ${release.artist} - ${release.title} (${genre || "no genre"})`);
      }

      // Small delay between requests
      await new Promise((r) => setTimeout(r, 500));
    }

    await updateSourceLastFetched(source.id);
    console.log(`Boomkat: ${newCount} new releases added`);

    return newCount;
  } finally {
    await browser.close();
  }
}
