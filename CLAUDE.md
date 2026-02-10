# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Music aggregator website for a DJ/radio host. Aggregates album reviews from 5 curated sources into a unified feed.

**Tech Stack:** Next.js 14.2 (App Router), TypeScript, Tailwind CSS, Turso (libSQL) for database, deployed on Vercel with cron jobs.

**Live URL:** https://muzyczka.vercel.app

## Build Commands

```bash
# Development
npm run dev

# Production build
npm run build
npm run start

# Linting
npm run lint

# Trigger manual refresh (fetches new releases)
curl -X POST http://localhost:3000/api/refresh
```

## Environment Variables

Required in `.env.local` (local) and Vercel dashboard (production):

```
TURSO_DATABASE_URL=libsql://music-aggregator-djbuszkers.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=<token>
```

## Architecture

### Data Sources

1. **Nowa Muzyka** (Polish) - RSS feed, genres and labels fetched from linked Bandcamp pages (JSON-LD)
2. **Bandcamp Daily** - HTML scraping with Cheerio, labels fetched from Bandcamp album pages (JSON-LD)
3. **Resident Advisor** - JavaScript-rendered, requires Puppeteer
4. **Boomkat** - JavaScript-rendered, requires Puppeteer
5. **Inverted Audio** - RSS feed with HTML scraping for details

### Key Files

```
src/
├── app/
│   ├── page.tsx              # Main UI with release grid
│   ├── layout.tsx            # App layout
│   ├── icon.svg              # Favicon (waveform bars)
│   ├── globals.css           # Tailwind styles
│   └── api/
│       ├── releases/route.ts # GET releases with pagination/filtering
│       └── refresh/route.ts  # POST triggers all scrapers
├── components/
│   ├── Header.tsx            # Responsive logo (compact mobile, full desktop)
│   ├── ReleaseCard.tsx
│   └── ReleaseGrid.tsx
└── lib/
    ├── db.ts                 # Turso database connection (async)
    ├── types.ts              # TypeScript interfaces
    ├── utils.ts              # Genre normalization
    └── scrapers/
        ├── nowamuzyka.ts     # RSS + Bandcamp data (genres, labels)
        ├── bandcamp.ts       # Cheerio + Bandcamp data (labels)
        ├── ra.ts
        ├── boomkat.ts
        └── inverted-audio.ts
public/
├── muzyczka-logo-full.svg    # Desktop logo (bars + text)
├── muzyczka-logo-compact.svg # Mobile logo (bars + text)
└── muzyczka-logo-icon.svg    # Icon only (bars)
```

### Database (Turso/libSQL)

All database functions are **async** and auto-initialize tables on first call.

**Tables:**
- `sources` - Source metadata (name, url, scraper_type, last_fetched)
- `releases` - Reviews with artist, title, label, genre, cover_image, review_url, review_snippet, published_at

**Key functions in db.ts:**
- `getSources()` / `getSourceByName(name)`
- `getReleases(sourceId?, limit, offset, genre?)`
- `insertRelease(release)` - Deduplicates cross-source releases by artist+title (case-insensitive); keeps the release with the longer review_snippet. Backfills missing labels on existing releases during dedup. Also returns false on same-URL duplicates (UNIQUE constraint on review_url)

## Deployment

- **Platform:** Vercel
- **Git repo:** github.com/djbuszkers/music-aggregator (master branch)
- **Cron job:** Configured in `vercel.json` - runs `/api/refresh` every 2 days at 8:00 UTC

## Development Guidelines

- All scrapers filter for 2026 releases only (`published_at >= '2026-01-01'`)
- Scrapers include delays between requests (300-500ms) to respect rate limits
- Genres are normalized to uppercase, comma-separated format
- Cover images fetched from og:image or article content
- Store review snippets (first ~650 chars of review text)
- Cross-source duplicates are deduplicated by artist+title; the release with the longest review snippet wins
- Record labels extracted from Bandcamp album pages via JSON-LD (`albumRelease[0].recordLabel.name`); not all albums have labels (self-released)

## Planned Developments

### New Source: Shatter the Standards

- **URL:** https://www.shatterthestandards.com/t/album-reviews
- **Focus:** Soul, R&B, hip-hop, neo-soul (fills gap in current coverage)
- **Platform:** Substack
- **Scraping approach:** HTML parsing of article list + individual article pages
- **Data available:** Album title, artist (parse from title format "Album Review: [Title] by [Artist]"), publication date, cover image, review text, star rating, review URL
- **Challenges:** No RSS feed; genre inference from review text; label info may need text parsing
- **Priority:** High - actively covers 2026 releases with quality reviews of artists like Zo!, Jordan Ward, Ella Mai

## Common Tasks

**Add a new scraper:**
1. Create `src/lib/scrapers/newsource.ts`
2. Add source to `initDb()` in `db.ts`
3. Import and call in `src/app/api/refresh/route.ts`

**Debug scraper issues:**
- Check terminal logs during `npm run dev`
- Scrapers log skipped items (not 2026) and added items

**Test database connection:**
```bash
curl http://localhost:3000/api/releases
```
