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

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Significant words: length > 3, OR a standalone number (important in series titles like "Vol. 2")
function sigWords(s: string): string[] {
  return normalizeForMatch(s).split(" ").filter(w => w.length > 3 || /^\d+$/.test(w));
}

function isConfidentMatch(storedArtist: string, storedTitle: string, apiArtist: string, apiTitle: string): boolean {
  const isVA = /^various/i.test(storedArtist);

  const artistWords = sigWords(storedArtist);
  const titleWords = sigWords(storedTitle);
  const apiArtistNorm = normalizeForMatch(apiArtist);
  const apiTitleNorm = normalizeForMatch(apiTitle);

  // Artist: at least one significant word from stored artist must appear in API artist
  const artistOk = isVA || artistWords.length === 0 || artistWords.some(w => apiArtistNorm.includes(w));

  // Title: at least half the significant words (min 1) must appear in API title
  const required = Math.max(1, Math.ceil(titleWords.length * 0.5));
  const titleHits = titleWords.filter(w => apiTitleNorm.includes(w)).length;
  const titleOk = titleWords.length === 0 || titleHits >= required;

  return artistOk && titleOk;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickMatch(items: any[], storedArtist: string, storedTitle: string): any | null {
  for (const item of items) {
    const apiArtist = item.artists?.map((a: any) => a.name).join(", ") ?? "";
    const apiTitle = item.name ?? "";
    if (isConfidentMatch(storedArtist, storedTitle, apiArtist, apiTitle)) return item;
  }
  return null;
}

export async function searchSpotifyAlbum(artist: string, title: string): Promise<SpotifyMatch | null> {
  const token = await getAccessToken();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function search(q: string): Promise<any[]> {
    const params = new URLSearchParams({ q, type: "album", limit: "5" });
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.error(`Spotify search failed for "${artist} - ${title}": ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.albums?.items ?? [];
  }

  const sanitizedArtist = sanitizeForSearch(artist);
  const sanitizedTitle = sanitizeForSearch(title);
  // Shortened artist: drop everything after " & " or " and " for collaborative releases
  const shortArtist = sanitizedArtist.replace(/\s+(&|and)\s+.+$/i, "").trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let album: any = null;

  // 1. Structured query with full artist + title
  album = pickMatch(await search(`artist:${sanitizedArtist} album:${sanitizedTitle}`), artist, title);

  // 2. Structured with shortened artist (helps when Spotify indexes under lead artist only)
  if (!album && shortArtist !== sanitizedArtist) {
    album = pickMatch(await search(`artist:${shortArtist} album:${sanitizedTitle}`), artist, title);
  }

  // 3. Free-text fallback with full artist + title
  if (!album) {
    album = pickMatch(await search(`${sanitizedArtist} ${sanitizedTitle}`), artist, title);
  }

  // 4. Free-text fallback with shortened artist
  if (!album && shortArtist !== sanitizedArtist) {
    album = pickMatch(await search(`${shortArtist} ${sanitizedTitle}`), artist, title);
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
