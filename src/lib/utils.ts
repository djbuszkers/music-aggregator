/**
 * Normalizes genre strings to a consistent format:
 * - Splits on common separators (;, /, ,)
 * - Trims whitespace
 * - Converts to uppercase
 * - Returns comma-separated string
 */
export function normalizeGenre(genre: string | null | undefined): string | null {
  if (!genre) return null;

  const genres = genre
    // Split on semicolons, slashes, or commas
    .split(/[;/,]/)
    // Trim whitespace
    .map(g => g.trim())
    // Remove empty strings
    .filter(g => g.length > 0)
    // Convert to uppercase
    .map(g => g.toUpperCase())
    // Remove duplicates
    .filter((g, i, arr) => arr.indexOf(g) === i);

  return genres.length > 0 ? genres.join(", ") : null;
}
