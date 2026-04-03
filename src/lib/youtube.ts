interface YouTubeMatch {
  youtubeUrl: string;
  youtubeId: string;
}

function normalizeQuotes(s: string): string {
  return s.replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"');
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sigWords(s: string): string[] {
  return normalizeForMatch(s).split(" ").filter(w => w.length > 3 || /^\d+$/.test(w));
}

// For YouTube we only validate the artist — video titles are track names, not album names
function artistInVideo(storedArtist: string, videoTitle: string, channelTitle: string): boolean {
  if (/^various/i.test(storedArtist)) return true;
  const artistWords = sigWords(storedArtist);
  if (artistWords.length === 0) return true;
  const combined = normalizeForMatch(videoTitle) + " " + normalizeForMatch(channelTitle);
  return artistWords.some(w => combined.includes(w));
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
    maxResults: "5",
    part: "snippet",
    key: apiKey,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);

  if (!response.ok) {
    console.error(`YouTube search failed for "${artist} - ${title}": ${response.status}`);
    return null;
  }

  const data = await response.json();
  const video = (data.items ?? []).find((item: any) =>
    item?.id?.videoId && artistInVideo(artist, item.snippet?.title ?? "", item.snippet?.channelTitle ?? "")
  );

  if (!video?.id?.videoId) {
    return null;
  }

  return {
    youtubeUrl: `https://music.youtube.com/watch?v=${video.id.videoId}`,
    youtubeId: video.id.videoId,
  };
}
