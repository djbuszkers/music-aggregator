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
  source_name?: string;
  aoty_critic_score: number | null;
  aoty_user_score: number | null;
  aoty_url: string | null;
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
}
