interface YouTubeMatch {
  youtubeUrl: string;
  youtubeId: string;
}

function normalizeQuotes(s: string): string {
  return s.replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"');
}

export async function searchVideo(artist: string, title: string): Promise<YouTubeMatch | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing YOUTUBE_API_KEY");
  }

  const params = new URLSearchParams({
    q: `${normalizeQuotes(artist)} ${normalizeQuotes(title)}`,
    type: "video",
    videoCategoryId: "10",
    maxResults: "1",
    part: "snippet",
    key: apiKey,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);

  if (!response.ok) {
    console.error(`YouTube search failed for "${artist} - ${title}": ${response.status}`);
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
