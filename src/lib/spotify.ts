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
}

export async function searchSpotifyAlbum(artist: string, title: string): Promise<SpotifyMatch | null> {
  const token = await getAccessToken();

  const query = `artist:${artist} album:${title}`;
  const params = new URLSearchParams({
    q: query,
    type: "album",
    limit: "1",
  });

  const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    console.error(`Spotify search failed for "${artist} - ${title}": ${response.status}`);
    return null;
  }

  const data = await response.json();
  const album = data.albums?.items?.[0];

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

  return {
    spotifyUrl: album.external_urls?.spotify ?? "",
    spotifyId: album.id,
    releaseType,
  };
}
