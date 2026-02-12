/**
 * Extract Bandcamp album ID from a Bandcamp album page's HTML.
 *
 * Tries multiple methods:
 * 1. EmbeddedPlayer URL in page HTML
 * 2. og:video meta tag with album= parameter
 * 3. data-tralbum-id attribute
 */
export function extractBandcampAlbumId(html: string): string | null {
  // Method 1: Look for EmbeddedPlayer URL
  const embedMatch = html.match(/EmbeddedPlayer\/album=(\d+)/);
  if (embedMatch) {
    return embedMatch[1];
  }

  // Method 2: Look in og:video meta tag
  const metaMatch = html.match(/<meta[^>]*property="og:video"[^>]*content="[^"]*album=(\d+)/);
  if (metaMatch) {
    return metaMatch[1];
  }

  // Method 3: data-tralbum-id attribute
  const tralbumMatch = html.match(/data-tralbum-id="(\d+)"/);
  if (tralbumMatch) {
    return tralbumMatch[1];
  }

  return null;
}

/**
 * Generate a Bandcamp embed player URL with dark theme.
 */
export function getBandcampEmbedUrl(albumId: string): string {
  return `https://bandcamp.com/EmbeddedPlayer/album=${albumId}/size=large/bgcol=333333/linkcol=e99708/tracklist=false/artwork=none/transparent=true/`;
}
