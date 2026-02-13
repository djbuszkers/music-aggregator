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
  return s.replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"');
}

export async function searchDeezerAlbum(
  artist: string,
  title: string
): Promise<DeezerMatch | null> {
  try {
    const query = `artist:"${normalizeQuotes(artist)}" album:"${normalizeQuotes(title)}"`;

    const url = `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Deezer search failed for "${artist} - ${title}": ${response.status}`);
      return null;
    }

    const data: DeezerSearchResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    const album = data.data[0];
    return {
      deezerUrl: album.link,
      deezerId: album.id.toString(),
    };
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
