import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

interface YouTubeMatch {
  youtubeUrl: string;
  youtubeId: string;
}

async function searchVideo(artist: string, title: string): Promise<YouTubeMatch | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing YOUTUBE_API_KEY");
  }

  const params = new URLSearchParams({
    q: `${artist} ${title}`,
    type: "video",
    videoCategoryId: "10",
    maxResults: "1",
    part: "snippet",
    key: apiKey,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);

  if (!response.ok) {
    const text = await response.text();
    console.error(`YouTube search failed (${response.status}): ${text}`);
    return null;
  }

  const data = await response.json();
  const video = data.items?.[0];

  if (!video?.id?.videoId) {
    return null;
  }

  return {
    youtubeUrl: `https://music.youtube.com/watch?v=${video.id.videoId}`,
    youtubeId: video.id.videoId,
  };
}

async function main() {
  // Ensure youtube columns exist
  try {
    await db.execute(`ALTER TABLE releases ADD COLUMN youtube_url TEXT`);
  } catch {
    // Column already exists
  }
  try {
    await db.execute(`ALTER TABLE releases ADD COLUMN youtube_id TEXT`);
  } catch {
    // Column already exists
  }

  const result = await db.execute(`
    SELECT id, artist, title FROM releases
    WHERE youtube_url IS NULL AND published_at >= '2026-01-01'
    ORDER BY published_at DESC
  `);

  const releases = result.rows;
  console.log(`Found ${releases.length} releases without YouTube URL`);

  let matched = 0;
  let noMatch = 0;

  for (const release of releases) {
    const artist = String(release.artist);
    const title = String(release.title);
    const id = Number(release.id);

    try {
      const match = await searchVideo(artist, title);

      if (match) {
        await db.execute({
          sql: `UPDATE releases SET youtube_url = ?, youtube_id = ? WHERE id = ?`,
          args: [match.youtubeUrl, match.youtubeId, id],
        });
        console.log(`Matched: ${artist} - ${title}`);
        matched++;
      } else {
        console.log(`No match: ${artist} - ${title}`);
        noMatch++;
      }

      // 100ms delay between API calls
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error matching ${artist} - ${title}:`, error);
      noMatch++;
    }
  }

  console.log(`\nMatched ${matched} of ${releases.length} releases (${noMatch} no match)`);
}

main().catch(console.error);
