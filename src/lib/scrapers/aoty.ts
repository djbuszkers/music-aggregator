import puppeteer, { Browser, Page } from "puppeteer";
import type { Release } from "../types";

const AOTY_BASE_URL = "https://www.albumoftheyear.org";
const SEARCH_URL = `${AOTY_BASE_URL}/search/albums/`;

export interface AOTYResult {
  criticScore: number | null;
  userScore: number | null;
  aotyUrl: string;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 0)
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  setA.forEach((item) => {
    if (setB.has(item)) intersection++;
  });

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

function matchScore(
  searchArtist: string,
  searchAlbum: string,
  foundArtist: string,
  foundAlbum: string
): number {
  const artistSim = jaccardSimilarity(searchArtist, foundArtist);
  const albumSim = jaccardSimilarity(searchAlbum, foundAlbum);
  return (artistSim + albumSim) / 2;
}

async function setupPage(browser: Browser): Promise<Page> {
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

  return page;
}

export async function lookupAOTYRating(
  artist: string,
  album: string,
  page?: Page
): Promise<AOTYResult | null> {
  const ownBrowser = !page;
  let browser: Browser | null = null;
  let localPage: Page;

  try {
    if (ownBrowser) {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      });
      localPage = await setupPage(browser);
    } else {
      localPage = page!;
    }

    const searchQuery = encodeURIComponent(`${artist} ${album}`);
    const searchUrl = `${SEARCH_URL}?q=${searchQuery}`;

    console.log(`Searching AOTY for: ${artist} - ${album}`);
    await localPage.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));

    // Check if blocked
    const isBlocked = await localPage.evaluate(() => {
      return (
        document.body.innerText.includes("have been blocked") ||
        document.body.innerText.includes("Access Denied")
      );
    });

    if (isBlocked) {
      console.error("Blocked by AOTY");
      return null;
    }

    // Extract search results
    const searchResults = await localPage.evaluate(() => {
      const items: Array<{
        artist: string;
        album: string;
        url: string;
      }> = [];

      // AOTY search results are in album blocks
      document.querySelectorAll(".albumBlock").forEach((block) => {
        const artistEl = block.querySelector(".artistTitle");
        const albumEl = block.querySelector(".albumTitle");
        const linkEl = block.querySelector("a[href*='/album/']");

        if (artistEl && albumEl && linkEl) {
          items.push({
            artist: artistEl.textContent?.trim() || "",
            album: albumEl.textContent?.trim() || "",
            url: linkEl.getAttribute("href") || "",
          });
        }
      });

      return items;
    });

    if (searchResults.length === 0) {
      console.log(`No results found for: ${artist} - ${album}`);
      return { criticScore: null, userScore: null, aotyUrl: "NOT_FOUND" };
    }

    // Find best match
    let bestMatch = searchResults[0];
    let bestScore = matchScore(artist, album, bestMatch.artist, bestMatch.album);

    for (const result of searchResults.slice(1)) {
      const score = matchScore(artist, album, result.artist, result.album);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }

    // Check if match is good enough (threshold 0.5)
    if (bestScore < 0.5) {
      console.log(
        `Low match confidence (${bestScore.toFixed(2)}) for: ${artist} - ${album} -> ${bestMatch.artist} - ${bestMatch.album}`
      );
      return { criticScore: null, userScore: null, aotyUrl: "NOT_FOUND" };
    }

    // Navigate to album page to get scores
    const albumUrl = bestMatch.url.startsWith("http")
      ? bestMatch.url
      : `${AOTY_BASE_URL}${bestMatch.url}`;

    await localPage.goto(albumUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Extract scores
    const scores = await localPage.evaluate(() => {
      let criticScore: number | null = null;
      let userScore: number | null = null;

      // Critic score
      const criticEl = document.querySelector(".albumCriticScore a");
      if (criticEl) {
        const scoreText = criticEl.textContent?.trim();
        if (scoreText && !isNaN(parseInt(scoreText))) {
          criticScore = parseInt(scoreText);
        }
      }

      // User score
      const userEl = document.querySelector(".albumUserScore a");
      if (userEl) {
        const scoreText = userEl.textContent?.trim();
        if (scoreText && !isNaN(parseInt(scoreText))) {
          userScore = parseInt(scoreText);
        }
      }

      return { criticScore, userScore };
    });

    console.log(
      `Found: ${bestMatch.artist} - ${bestMatch.album} (match: ${bestScore.toFixed(2)}) Critic: ${scores.criticScore}, User: ${scores.userScore}`
    );

    return {
      criticScore: scores.criticScore,
      userScore: scores.userScore,
      aotyUrl: albumUrl,
    };
  } catch (error) {
    console.error(`Error looking up AOTY for ${artist} - ${album}:`, error);
    return null;
  } finally {
    if (ownBrowser && browser) {
      await browser.close();
    }
  }
}

export async function batchLookupAOTY(
  releases: Release[],
  delayMs = 2000
): Promise<Map<number, AOTYResult>> {
  const results = new Map<number, AOTYResult>();

  if (releases.length === 0) {
    return results;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const page = await setupPage(browser);

    for (let i = 0; i < releases.length; i++) {
      const release = releases[i];
      console.log(`Processing ${i + 1}/${releases.length}: ${release.artist} - ${release.title}`);

      const result = await lookupAOTYRating(release.artist, release.title, page);

      if (result) {
        results.set(release.id, result);
      } else {
        // Mark as attempted but failed (timeout/error)
        results.set(release.id, {
          criticScore: null,
          userScore: null,
          aotyUrl: "NOT_FOUND",
        });
      }

      // Rate limiting delay between requests
      if (i < releases.length - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}
