export interface Source {
  id: number;
  name: string;
  url: string;
  scraper_type: "rss" | "cheerio" | "puppeteer";
  last_fetched: string | null;
  is_active: boolean;
}

export interface Release {
  id: number;
  source_id: number;
  artist: string;
  title: string;
  label: string | null;
  genre: string | null;
  cover_image: string | null;
  review_url: string;
  review_snippet: string | null;
  published_at: string;
  scraped_at: string;
  raw_data: string | null;
  spotify_url: string | null;
  spotify_id: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
  bandcamp_url: string | null;
  bandcamp_album_id: string | null;
  deezer_url: string | null;
  deezer_id: string | null;
  is_inky_tip: number | null;
  inky_tip_note: string | null;
  release_type: string | null;
  source_name?: string;
}

export interface ReleaseInput {
  source_id: number;
  artist: string;
  title: string;
  label?: string | null;
  genre?: string | null;
  cover_image?: string | null;
  review_url: string;
  review_snippet?: string | null;
  published_at: string;
  raw_data?: string | null;
  bandcamp_url?: string | null;
  bandcamp_album_id?: string | null;
  release_type?: string | null;
}
