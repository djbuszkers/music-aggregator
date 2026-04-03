interface DeezerAlbum {
  id: number;
  title: string;
  link: string;
  label?: string;
  record_type?: string;
  nb_tracks?: number;
  artist: {
    id: number;
    name: string;
  };
}

export interface DeezerAlbumDetails {
  label: string | null;
  releaseType: string | null;
}

interface DeezerSearchResponse {
  data: DeezerAlbum[];
  total: number;
}

export interface DeezerMatch {
  deezerUrl: string;
  deezerId: string;
}

function normalizeQuotes(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/&/g, "and");
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

function isConfidentMatch(storedArtist: string, storedTitle: string, apiArtist: string, apiTitle: string): boolean {
  const isVA = /^various/i.test(storedArtist);
  const artistWords = sigWords(storedArtist);
  const titleWords = sigWords(storedTitle);
  const apiArtistNorm = normalizeForMatch(apiArtist);
  const apiTitleNorm = normalizeForMatch(apiTitle);

  const artistOk = isVA || artistWords.length === 0 || artistWords.some(w => apiArtistNorm.includes(w));
  const required = Math.max(1, Math.ceil(titleWords.length * 0.5));
  const titleHits = titleWords.filter(w => apiTitleNorm.includes(w)).length;
  const titleOk = titleWords.length === 0 || titleHits >= required;

  return artistOk && titleOk;
}

function pickMatch(items: DeezerAlbum[], storedArtist: string, storedTitle: string): DeezerAlbum | null {
  for (const item of items) {
    if (isConfidentMatch(storedArtist, storedTitle, item.artist.name, item.title)) return item;
  }
  return null;
}

export async function searchDeezerAlbum(
  artist: string,
  title: string
): Promise<DeezerMatch | null> {
  try {
    const sanitizedArtist = normalizeQuotes(artist);
    const sanitizedTitle = normalizeQuotes(title);
    const shortArtist = sanitizedArtist.replace(/\s+and\s+.+$/i, "").trim();

    const queries = [
      `artist:"${sanitizedArtist}" album:"${sanitizedTitle}"`,
      `${sanitizedArtist} ${sanitizedTitle}`,
      ...(shortArtist !== sanitizedArtist ? [
        `artist:"${shortArtist}" album:"${sanitizedTitle}"`,
        `${shortArtist} ${sanitizedTitle}`,
      ] : []),
    ];

    for (const query of queries) {
      const url = `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=5`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Deezer search failed for "${artist} - ${title}": ${response.status}`);
        return null;
      }

      const data: DeezerSearchResponse = await response.json();
      const album = pickMatch(data.data ?? [], artist, title);
      if (album) {
        return {
          deezerUrl: album.link,
          deezerId: album.id.toString(),
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error searching Deezer:", error);
    return null;
  }
}

export async function getDeezerAlbumDetails(deezerId: string): Promise<DeezerAlbumDetails | null> {
  try {
    const response = await fetch(`https://api.deezer.com/album/${deezerId}`);
    if (!response.ok) return null;

    const data: DeezerAlbum = await response.json();

    let releaseType: string | null = null;
    const recordType = data.record_type;
    const nbTracks = data.nb_tracks ?? 0;
    if (recordType === "single") {
      releaseType = nbTracks >= 3 ? "EP" : "Single";
    } else if (recordType === "ep") {
      releaseType = "EP";
    } else if (recordType === "album") {
      releaseType = "LP";
    }

    return {
      label: data.label || null,
      releaseType,
    };
  } catch (error) {
    console.error("Error fetching Deezer album:", error);
    return null;
  }
}
