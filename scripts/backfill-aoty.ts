import Database from "better-sqlite3";
import path from "path";
import puppeteer, { Browser, Page } from "puppeteer";

const db = new Database(path.join(process.cwd(), "data", "music.db"));

const AOTY_BASE_URL = "https://www.albumoftheyear.org";
const SEARCH_URL = `${AOTY_BASE_URL}/search/albums/`;

interface Release {
  id: number;
  artist: string;
  title: string;
}

interface AOTYResult {
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
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

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

async function lookupAOTYRating(
  artist: string,
  album: string,
  page: Page
): Promise<AOTYResult | null> {
  try {
    const searchQuery = encodeURIComponent(`${artist} ${album}`);
    const searchUrl = `${SEARCH_URL}?q=${searchQuery}`;

    console.log(`Searching AOTY for: ${artist} - ${album}`);
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));

    // Check if blocked
    const isBlocked = await page.evaluate(() => {
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
    const searchResults = await page.evaluate(() => {
      const items: Array<{
        artist: string;
        album: string;
        url: string;
      }> = [];

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

    await page.goto(albumUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Extract scores
    const scores = await page.evaluate(() => {
      let criticScore: number | null = null;
      let userScore: number | null = null;

      const criticEl = document.querySelector(".albumCriticScore a");
      if (criticEl) {
        const scoreText = criticEl.textContent?.trim();
        if (scoreText && !isNaN(parseInt(scoreText))) {
          criticScore = parseInt(scoreText);
        }
      }

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
  }
}

async function main() {
  // Get all releases without AOTY data
  const releases = db
    .prepare(
      `SELECT id, artist, title FROM releases WHERE aoty_url IS NULL ORDER BY published_at DESC`
    )
    .all() as Release[];

  console.log(`Found ${releases.length} releases without AOTY data\n`);

  if (releases.length === 0) {
    console.log("Nothing to do!");
    db.close();
    return;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const update = db.prepare(
    `UPDATE releases SET aoty_critic_score = ?, aoty_user_score = ?, aoty_url = ? WHERE id = ?`
  );

  let processed = 0;
  let withScores = 0;
  let notFound = 0;

  try {
    const page = await setupPage(browser);

    for (let i = 0; i < releases.length; i++) {
      const release = releases[i];
      console.log(
        `\n[${i + 1}/${releases.length}] Processing: ${release.artist} - ${release.title}`
      );

      const result = await lookupAOTYRating(release.artist, release.title, page);

      if (result) {
        update.run(result.criticScore, result.userScore, result.aotyUrl, release.id);
        processed++;

        if (result.aotyUrl === "NOT_FOUND") {
          notFound++;
        } else if (result.criticScore !== null || result.userScore !== null) {
          withScores++;
        }
      } else {
        // Mark as attempted but failed
        update.run(null, null, "NOT_FOUND", release.id);
        processed++;
        notFound++;
      }

      // Rate limiting: 2 second delay between requests
      if (i < releases.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Backfill complete!`);
  console.log(`Processed: ${processed}`);
  console.log(`With scores: ${withScores}`);
  console.log(`Not found: ${notFound}`);

  db.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  db.close();
  process.exit(1);
});
