let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

interface SpotifyMatch {
  spotifyUrl: string;
  spotifyId: string;
  releaseType: string | null;
  label: string | null;
}

function parseLabelFromCopyrights(copyrights: Array<{ text: string; type: string }>): string | null {
  // Prefer phonographic copyright (P) over general copyright (C) — more specific to the label
  const entry = copyrights.find((c) => c.type === "P") || copyrights.find((c) => c.type === "C");
  if (!entry) return null;
  // Strip leading symbols (©, ℗, (P), (C)), then the year
  const text = entry.text
    .replace(/^[\s©℗]+/, "")
    .replace(/^\(P\)\s*/i, "")
    .replace(/^\(C\)\s*/i, "")
    .replace(/^\d{4}\s+/, "")
    .trim();
  return text || null;
}

async function fetchAlbumDetails(albumId: string, token: string): Promise<{ label: string | null }> {
  try {
    const albumRes = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!albumRes.ok) return { label: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const album: any = await albumRes.json();
    const label = parseLabelFromCopyrights((album.copyrights as Array<{ text: string; type: string }>) || []);
    return { label };
  } catch {
    return { label: null };
  }
}

function sanitizeForSearch(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u201B']/g, "")
    .replace(/[\u201C\u201D\u201E\u201F"]/g, "")
    .replace(/&/g, "and");
}

export async function searchSpotifyAlbum(artist: string, title: string): Promise<SpotifyMatch | null> {
  const token = await getAccessToken();

  const structuredQuery = `artist:${sanitizeForSearch(artist)} album:${sanitizeForSearch(title)}`;
  const fallbackQuery = `${sanitizeForSearch(artist)} ${sanitizeForSearch(title)}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let album: any = null;

  const queries = [structuredQuery, fallbackQuery];
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const params = new URLSearchParams({ q: query, type: "album", limit: "5" });
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.error(`Spotify search failed for "${artist} - ${title}": ${response.status}`);
      return null;
    }
    const data = await response.json();
    const items: any[] = data.albums?.items ?? [];
    if (i === 0) {
      // Structured query: trust the first result
      album = items[0] ?? null;
    } else {
      // Free-text fallback: require at least one word to match exactly
      // (word-level, not substring) to avoid false positives
      const queryWords = sanitizeForSearch(`${artist} ${title}`)
        .toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      album = items.find((item: any) => {
        const resultWords = `${item.artists?.[0]?.name ?? ""} ${item.name}`
          .toLowerCase().split(/\s+/);
        return queryWords.some((w: string) => resultWords.includes(w));
      }) ?? null;
    }
    if (album) break;
  }

  if (!album) {
    return null;
  }

  let releaseType: string | null = null;
  const albumType = album.album_type as string | undefined;
  const totalTracks = album.total_tracks as number | undefined;
  if (albumType === "single") {
    releaseType = totalTracks && totalTracks >= 3 ? "EP" : "Single";
  } else if (albumType === "album" || albumType === "compilation") {
    releaseType = "LP";
  }

  const { label } = await fetchAlbumDetails(album.id, token);

  return {
    spotifyUrl: album.external_urls?.spotify ?? "",
    spotifyId: album.id,
    releaseType,
    label,
  };
}
