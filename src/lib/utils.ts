/**
 * Non-genre terms to filter out (labels, artists, cities, formats)
 */
const NON_GENRE_TERMS = new Set([
  // Labels
  "a strangely isolated place", "asip", "kompakt", "warp", "ninja tune",
  "hyperdub", "planet mu", "ghostly", "r&s", "ostgut ton", "mute",
  "raster noton", "editions mego", "erased tapes", "kranky", "touch",
  
  // Artists (commonly mistagged)
  "markus guentner", "boards of canada", "aphex twin",
  
  // Cities/Locations
  "phoenix", "paris", "london", "berlin", "new york", "los angeles", "tokyo",
  "chicago", "detroit", "amsterdam", "brooklyn", "manchester", "seattle",
  "portland", "oakland", "atlanta", "miami", "denver", "austin",
  "philadelphia", "boston", "san francisco", "minneapolis", "nashville",
  "warsaw", "vienna", "cologne", "hamburg", "munich", "barcelona",
  "uk", "usa", "france", "germany", "japan", "canada", "australia",
  "poland", "united kingdom", "netherlands",
  
  // Formats/Descriptors
  "vinyl", "lp", "ep", "album", "compilation", "remix", "reissue",
  "limited", "deluxe", "extended", "original"
]);

/**
 * Genre mapping: maps specific/granular genres to broader categories
 */
const GENRE_MAP: Record<string, string> = {
  // AMBIENT
  "drone": "AMBIENT",
  "drone ambient": "AMBIENT",
  "pop ambient": "AMBIENT",
  "ambient music": "AMBIENT",
  "dark ambient": "AMBIENT",
  
  // TECHNO
  "minimal techno": "TECHNO",
  "dub techno": "TECHNO",
  "industrial techno": "TECHNO",
  "hard techno": "TECHNO",
  "acid techno": "TECHNO",
  
  // HOUSE
  "deep house": "HOUSE",
  "tech house": "HOUSE",
  "minimal": "HOUSE",
  "minimal house": "HOUSE",
  "acid house": "HOUSE",
  "progressive house": "HOUSE",
  "disco house": "HOUSE",
  
  // ELECTRONIC
  "electronica": "ELECTRONIC",
  "abstract": "ELECTRONIC",
  "idm": "ELECTRONIC",
  "glitch": "ELECTRONIC",
  "synthwave": "ELECTRONIC",
  "synth": "ELECTRONIC",
  
  // HIP-HOP
  "hip hop": "HIP-HOP",
  "hip hop rap": "HIP-HOP",
  "rap": "HIP-HOP",
  "trip hop": "HIP-HOP",
  "underground hip hop": "HIP-HOP",
  "indie hip hop": "HIP-HOP",
  "instrumental hip hop": "HIP-HOP",
  
  // BASS
  "dubstep": "BASS",
  "bass music": "BASS",
  "drum & bass": "BASS",
  "drum and bass": "BASS",
  "dnb": "BASS",
  "jungle": "BASS",
  "grime": "BASS",
  "uk bass": "BASS",
  "halftime": "BASS",
  
  // SOUL
  "r&b": "SOUL",
  "rnb": "SOUL",
  "neo-soul": "SOUL",
  "neo soul": "SOUL",

  // JAZZ
  "fusion": "JAZZ",
  "jazz fusion": "JAZZ",
  "nu jazz": "JAZZ",
  "spiritual jazz": "JAZZ",
  "free jazz": "JAZZ",
  
  // CLASSICAL
  "modern classical": "CLASSICAL",
  "contemporary classical": "CLASSICAL",
  "neo-classical": "CLASSICAL",
  "neoclassical": "CLASSICAL",
  "orchestral": "CLASSICAL",
  
  // INDIE
  "alternative": "INDIE",
  "indie rock": "INDIE",
  "indie pop": "INDIE",
  "art rock": "INDIE",
  "post-rock": "INDIE",
  "post rock": "INDIE",
  "shoegaze": "INDIE",
  
  // EXPERIMENTAL
  "psychedelic": "EXPERIMENTAL",
  "avant garde": "EXPERIMENTAL",
  "avant-garde": "EXPERIMENTAL",
  "noise": "EXPERIMENTAL",
  "industrial": "EXPERIMENTAL",
  "sound art": "EXPERIMENTAL",
  
  // DUB (keep separate)
  "dub": "DUB",
  "reggae": "DUB",
  "roots": "DUB",
  
  // ELECTRO (keep separate from Electronic)
  "electro": "ELECTRO",
  "electro funk": "ELECTRO",
  
  // WORLD
  "world music": "WORLD",
  "afrobeat": "WORLD",
  "african": "WORLD",
  "latin": "WORLD",
  "brazilian": "WORLD",
  "middle eastern": "WORLD",
};

/**
 * Canonical genres (these pass through unchanged)
 */
const CANONICAL_GENRES = new Set([
  "AMBIENT", "TECHNO", "HOUSE", "ELECTRONIC", "HIP-HOP", "BASS",
  "JAZZ", "CLASSICAL", "INDIE", "EXPERIMENTAL", "DUB", "ELECTRO",
  "WORLD", "DISCO", "SOUL", "FUNK", "POP", "FOLK", "METAL", "PUNK"
]);

/**
 * Normalizes genre strings:
 * - Filters out non-genre terms (labels, artists, cities)
 * - Maps granular genres to broader categories
 * - Returns deduplicated, comma-separated string
 */
export function normalizeGenre(genre: string | null | undefined): string | null {
  if (!genre) return null;

  const normalized = genre
    .split(/[;/,]/)
    .map(g => g.trim().toLowerCase())
    .filter(g => g.length > 0)
    // Filter out non-genre terms
    .filter(g => !NON_GENRE_TERMS.has(g))
    // Map to canonical genres or keep if already canonical
    .map(g => {
      const upper = g.toUpperCase();
      if (CANONICAL_GENRES.has(upper)) {
        return upper;
      }
      return GENRE_MAP[g] || null;
    })
    // Remove nulls (unrecognized genres)
    .filter((g): g is string => g !== null)
    // Remove duplicates
    .filter((g, i, arr) => arr.indexOf(g) === i);

  return normalized.length > 0 ? normalized.join(", ") : null;
}

export function inferReleaseTypeFromTrackCount(numTracks: number): string | null {
  if (numTracks <= 0) return null;
  if (numTracks <= 2) return "Single";
  if (numTracks <= 6) return "EP";
  return "LP";
}

export function inferReleaseTypeFromTitle(title: string): string | null {
  if (/\bEP\b/.test(title)) return "EP";
  if (/\bLP\b/.test(title)) return "LP";
  if (/\bSingle\b/i.test(title)) return "Single";
  return null;
}
