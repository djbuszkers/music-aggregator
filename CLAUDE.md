# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Music aggregator website for a DJ/radio host. Aggregates album reviews from 4 curated sources into a unified feed with personal curation layer.

**Tech Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, SQLite (better-sqlite3), deployed on Vercel.

## Build Commands

```bash
# Development
npm run dev

# Production build
npm run build
npm run start

# Linting
npm run lint

# Initial setup (if starting fresh)
npx create-next-app@latest music-aggregator --typescript --tailwind --app --src-dir
npm install better-sqlite3 rss-parser cheerio
npm install -D @types/better-sqlite3

# Headless browser (Phase 3+)
npm install puppeteer  # or playwright
```

## Architecture

### Data Sources (in order of scraping difficulty)

1. **Nowa Muzyka** (Polish) - RSS feed at `https://www.nowamuzyka.pl/feed/`
2. **Bandcamp Daily** - Open RSS or HTML scraping with Cheerio
3. **Resident Advisor** - JavaScript-rendered, requires headless browser
4. **Boomkat Weekly** - Blocks direct requests (403), requires headless browser

### Key Directories

- `src/lib/scrapers/` - One scraper per source (nowamuzyka.ts, bandcamp.ts, ra.ts, boomkat.ts)
- `src/lib/db.ts` - SQLite connection and queries
- `src/app/api/refresh/` - Trigger data refresh endpoint
- `src/app/api/releases/` - Releases API with filtering

### Database

SQLite with three tables:
- `sources` - Source metadata and last fetch timestamps
- `releases` - Aggregated reviews with artist, title, label, cover image, review URL
- `dj_picks` - Personal curation layer (future phase)

## Development Guidelines

- Start with one source working end-to-end before adding others
- Cache aggressively to avoid hitting sources unnecessarily
- Store raw scraped data in `raw_data` JSON column for potential re-parsing
- Add delays between requests to respect rate limits
- Log scraper activity for debugging

## Implementation Phases

1. Foundation: Next.js setup + SQLite + Nowa Muzyka RSS
2. Bandcamp Daily scraper
3. Resident Advisor (headless browser)
4. Boomkat Weekly (headless browser)
5. Deploy to Vercel with cron refresh
6. Personal DJ Picks curation (requires auth)
