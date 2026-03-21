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
  "WORLD", "DISCO", "SOUL", "FUNK", "POP", "FOLK", "METAL", "PUNK",
  "ROCK", "TRANCE", "BREAKS", "RAVE", "ACID", "PROGRESSIVE", "MINIMAL",
  "BOOGIE", "GOSPEL", "RAP", "R&B", "NEO-SOUL"
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

/**
 * Genre category mapping: maps every granular genre tag to one of 15 main filter categories.
 * The filter bar shows only main categories; DB and display stay granular.
 */
const GENRE_CATEGORY_MAP: Record<string, string> = {
  // BASS
  "BASS": "BASS", "UK BASS": "BASS", "BREAKS": "BASS", "RAVE": "BASS",
  "GHETTOTECH": "BASS", "FOOTWORK": "BASS", "UK FUNKY": "BASS",
  // HOUSE
  "HOUSE": "HOUSE", "DEEP HOUSE": "HOUSE", "SOULFUL HOUSE": "HOUSE",
  "TECH HOUSE": "HOUSE", "TRIBAL HOUSE": "HOUSE", "DETROIT HOUSE": "HOUSE",
  "DISCO": "HOUSE", "BOOGIE": "HOUSE",
  // TECHNO
  "TECHNO": "TECHNO", "ACID": "TECHNO", "DETROIT TECHNO": "TECHNO",
  "DUB TECHNO": "TECHNO", "MINIMAL": "TECHNO", "PROGRESSIVE": "TECHNO",
  "TRANCE": "TECHNO",
  // DUB
  "DUB": "DUB",
  // ELECTRONIC
  "ELECTRONIC": "ELECTRONIC", "ELECTRO": "ELECTRONIC", "KOSMICHE": "ELECTRONIC",
  "LO-FI": "ELECTRONIC", "BROKEN BEAT": "ELECTRONIC",
  // AMBIENT
  "AMBIENT": "AMBIENT",
  // EXPERIMENTAL
  "EXPERIMENTAL": "EXPERIMENTAL",
  // HIP-HOP
  "HIP-HOP": "HIP-HOP", "RAP": "HIP-HOP", "UK DRILL": "HIP-HOP",
  // SOUL
  "SOUL": "SOUL", "NEO-SOUL": "SOUL", "R&B": "SOUL", "FUNK": "SOUL", "GOSPEL": "SOUL",
  // INDIE
  "INDIE": "INDIE", "FOLK": "INDIE", "INDIE DANCE": "INDIE",
  // JAZZ
  "JAZZ": "JAZZ",
  // ROCK
  "ROCK": "ROCK", "POST ROCK": "ROCK", "INDUSTRIAL": "ROCK", "METAL": "ROCK",
  "PUNK": "ROCK", "POST-PUNK": "ROCK", "GOTHIC": "ROCK", "DARKWAVE": "ROCK",
  "SHOEGAZE": "ROCK", "NOISE ROCK": "ROCK", "ALTERNATIVE": "ROCK",
  // POP
  "POP": "POP", "SYNTH-POP": "POP", "FRENCH TOUCH": "POP",
  "DREAM POP": "POP", "ELECTRO-POP": "POP", "INDIE POP": "POP",
  // WORLD
  "WORLD": "WORLD", "LATIN": "WORLD", "AFROBEAT": "WORLD", "AFROBEATS": "WORLD",
  // CLASSICAL
  "CLASSICAL": "CLASSICAL",
};

const MAIN_GENRE_CATEGORIES = [
  "BASS", "HOUSE", "TECHNO", "DUB", "ELECTRONIC", "AMBIENT", "EXPERIMENTAL",
  "HIP-HOP", "SOUL", "INDIE", "JAZZ", "ROCK", "POP", "WORLD", "CLASSICAL",
];

/** Returns the ordered list of 15 main genre filter categories. */
export function getMainGenreCategories(): string[] {
  return MAIN_GENRE_CATEGORIES;
}

/** Maps a granular genre tag to its main category. Returns the tag itself if no mapping exists. */
export function getGenreCategory(genre: string): string {
  return GENRE_CATEGORY_MAP[genre.toUpperCase()] ?? genre.toUpperCase();
}

/** Given a main category, returns all granular genres that belong to it (for SQL filtering). */
export function expandGenreCategory(category: string): string[] {
  const upper = category.toUpperCase();
  const genres: string[] = [];
  for (const [granular, cat] of Object.entries(GENRE_CATEGORY_MAP)) {
    if (cat === upper) {
      genres.push(granular);
    }
  }
  return genres.length > 0 ? genres : [upper];
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
