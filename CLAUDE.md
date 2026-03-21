# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OctoCrate** — music aggregator website for a DJ/radio host. Aggregates album reviews from 8 curated sources into a unified feed.

**Tech Stack:** Next.js 14.2 (App Router), TypeScript, Tailwind CSS, Turso (libSQL) for database, deployed on Vercel with cron jobs.

**Live URL:** https://octocrate.vercel.app

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
SPOTIFY_CLIENT_ID=<spotify-app-client-id>
SPOTIFY_CLIENT_SECRET=<spotify-app-client-secret>
YOUTUBE_API_KEY=<youtube-data-api-v3-key>
# Note: Deezer requires NO API key or authentication
```

## Architecture

### Data Sources

1. **Nowa Muzyka** (Polish) - RSS feed, genres and labels fetched from linked Bandcamp pages (JSON-LD)
2. **Bandcamp Daily** - HTML scraping with Cheerio, labels fetched from Bandcamp album pages (JSON-LD)
3. **Resident Advisor** - JavaScript-rendered, requires Puppeteer
4. **Boomkat** - JavaScript-rendered, requires Puppeteer
5. **Inverted Audio** - RSS feed with HTML scraping for details
6. **Shatter the Standards** - Substack archive API + Cheerio scraping; covers soul, R&B, hip-hop, neo-soul
7. **DJ Mag** - HTML scraping with Cheerio (no RSS feed); albums pass through unfiltered, EPs filtered by genre allowlist
8. **Silent Radio** - Archive page walking with Cheerio; dates parsed from JSON-LD (CDATA-wrapped); URL-based date fallback for articles missing structured data

### Key Files

```
src/
├── app/
│   ├── page.tsx              # Main UI with release grid
│   ├── layout.tsx            # App layout
│   ├── icon.svg              # Favicon (vinyl record)
│   ├── globals.css           # Tailwind styles
│   ├── admin/
│   │   └── page.tsx          # Admin page for managing INKY TIPs
│   ├── release/
│   │   └── [id]/page.tsx     # Individual release page with OG meta tags
│   └── api/
│       ├── releases/route.ts # GET releases with pagination/filtering
│       ├── releases/[id]/route.ts    # GET single release by ID
│       ├── releases/[id]/inky-tip/route.ts  # POST toggle INKY TIP status
│       ├── refresh/route.ts  # POST triggers all scrapers
│       ├── spotify-match/route.ts  # POST Spotify album match by artist+title
│       └── deezer-match/route.ts  # POST Deezer album match by artist+title
├── components/
│   ├── Header.tsx            # Logo + last updated
│   ├── ReleaseCard.tsx       # Card linking to release page, with streaming & share buttons
│   ├── ReleaseGrid.tsx
│   └── ShareButton.tsx       # Share via Web Share API / clipboard fallback
└── lib/
    ├── db.ts                 # Turso database connection (async)
    ├── types.ts              # TypeScript interfaces
    ├── utils.ts              # Genre normalization + category mapping (15 main categories)
    ├── bandcamp.ts           # Bandcamp album ID extraction + embed URL
    ├── spotify.ts            # Spotify API client (album search, sanitizes quotes)
    ├── youtube.ts            # YouTube Data API client (music video search)
    ├── deezer.ts             # Deezer API client (album search + release type, no auth needed)
    └── scrapers/
        ├── nowamuzyka.ts     # RSS + Bandcamp data (genres, labels)
        ├── bandcamp.ts       # Cheerio + Bandcamp data (labels)
        ├── ra.ts
        ├── boomkat.ts
        ├── inverted-audio.ts
        ├── shatter-the-standards.ts  # Substack archive API + post API for cover images
        ├── djmag.ts              # HTML scraping (albums + genre-filtered EPs)
        └── silent-radio.ts       # Archive page walking + JSON-LD date parsing
public/
├── octocrate-logo.svg        # OctoCrate logo (tentacle + vinyl, transparent bg)
├── manifest.json             # PWA manifest (background_color: #09090b)
├── icon-512x512.png          # PWA icon (white logo on black bg)
├── icon-192x192.png          # PWA icon (white logo on black bg)
└── apple-touch-icon.png      # iOS home screen icon (white logo on black bg)
```

### Database (Turso/libSQL)

All database functions are **async** and auto-initialize tables on first call.

**Tables:**
- `sources` - Source metadata (name, url, scraper_type, last_fetched)
- `releases` - Reviews with artist, title, label, genre, cover_image, review_url, review_snippet, published_at, spotify_url, spotify_id, youtube_url, youtube_id, bandcamp_url, bandcamp_album_id, deezer_url, deezer_id, is_inky_tip, inky_tip_note, release_type

**Key functions in db.ts:**
- `getSources()` / `getSourceByName(name)`
- `getReleases(sourceId?, limit, offset, genres?, inkyTipsOnly?, releaseType?, searchQuery?)` / `getReleaseById(id)`
- `insertRelease(release)` - Deduplicates cross-source releases by artist+title (case-insensitive); keeps the release with the longer review_snippet. Backfills missing fields (label, genre, bandcamp data) on existing releases during dedup using COALESCE (never overwrites non-NULL with NULL). Also returns false on same-URL duplicates (UNIQUE constraint on review_url)

## Deployment

- **Platform:** Vercel
- **Git repo:** github.com/djbuszkers/music-aggregator (master branch)
- **Cron job:** Configured in `vercel.json` - runs `/api/refresh` every 2 days at 8:00 UTC

## Development Guidelines

- All scrapers filter for 2026 releases only (`published_at >= '2026-01-01'`)
- Scrapers include delays between requests (300-500ms) to respect rate limits
- Genres are normalized to uppercase, comma-separated format
- Cover images fetched from og:image or article content. Shatter the Standards uses `/api/v1/posts/{slug}` (Substack post API) to get `body_html` and extract the first image — `og:image` on Substack is a generated social card with text overlay, not the album art. Silent Radio uses `og:image` which is correct.
- Store review snippets (first ~650 chars of review text)
- Cross-source duplicates are deduplicated by artist+title; the release with the longest review snippet wins
- Record labels extracted from Bandcamp album pages via JSON-LD (`albumRelease[0].recordLabel.name`); not all albums have labels (self-released)

### Streaming Service Integration

- **Spotify:** Release cards link to matching Spotify albums. Uses Client Credentials flow (`spotify.ts`) with token caching. API endpoint at `/api/spotify-match` for on-demand lookups. Matched data stored in `spotify_url` and `spotify_id` columns.
- **YouTube Music:** Release cards link to matching YouTube Music videos. Uses YouTube Data API v3 (`youtube.ts`), filtered to music category. Matched data stored in `youtube_url` and `youtube_id` columns.
- **Bandcamp:** Embedded player on release pages for albums with Bandcamp data. Album IDs extracted during scraping from Nowa Muzyka and Bandcamp Daily sources (`bandcamp.ts`). Data stored in `bandcamp_url` and `bandcamp_album_id` columns. Release cards also show a Bandcamp button linking to the album page.
- **Deezer:** No authentication required (free public API). Uses `/search/album` endpoint with `artist:"X" album:"Y"` query syntax. Also provides release type inference via `record_type` field from `/album/{id}` endpoint. Matched data stored in `deezer_url` and `deezer_id` columns. API endpoint at `/api/deezer-match` for batch matching.
- **Search query sanitization:** Spotify and Deezer replace `&` with `and` and normalize curly quotes before forming field-based queries (`artist:` / `album:`). Both also fall back to free-text search when the structured query returns no results. Deezer additionally tries a shortened artist name (dropping everything after `and`) as a third fallback, since streaming services sometimes index albums under a shorter artist name. YouTube uses free-text search only and is unaffected by these issues.
- **Spotify fallback relevance check:** The free-text fallback requires at least one word (>3 chars) from the query to match exactly in the result's artist+title. This prevents false positives where Spotify returns a completely unrelated album (e.g. album not on Spotify at all). Limit bumped to 5 candidates to check before giving up.

### Individual Release Pages

- Each release has a shareable page at `/release/[id]` with full details (cover art, review excerpt, streaming links, source info)
- OpenGraph and Twitter Card meta tags for social media previews (album cover as image, artist/title, review snippet)
- `ShareButton` component uses Web Share API on mobile (native share sheet) with clipboard fallback on desktop
- Release cards on the homepage link to the release page; "Read Full Review" button on the release page links to the original review
- Bandcamp embedded player shown on release pages when `bandcamp_album_id` is available (slim standard layout, no artwork, dark theme)

### Genre Filtering

- **Genre category system:** 40+ granular genre tags are mapped to 15 main filter categories (BASS, HOUSE, TECHNO, DUB, ELECTRONIC, AMBIENT, EXPERIMENTAL, HIP-HOP, SOUL, INDIE, JAZZ, ROCK, POP, WORLD, CLASSICAL) via `GENRE_CATEGORY_MAP` in `utils.ts`
- Filter bar shows only the 15 main categories; release cards still display granular genres (e.g. FOOTWORK, DEEP HOUSE)
- Clicking a category filter expands to match all sub-genres via `expandGenreCategory()` (e.g. BASS matches FOOTWORK, UK FUNKY, BREAKS, RAVE, etc.)
- `getDistinctGenres()` in `db.ts` returns only categories that have matching releases, ordered by `MAIN_GENRE_CATEGORIES`
- Filter bar has four rows: search input (free-text, debounced 300ms, queries artist/title/label); All/INKY TIPS/release type toggles; source filter buttons; genre buttons
- Search supports `?q=` param on `/api/releases` and is combinable with all other filters
- Genre filtering supports multi-select with OR logic (selecting multiple genres shows releases matching any of them)
- Genre buttons wrap on mobile; all filters are center-aligned
- Pagination uses a windowed layout (first, current±1, last, with ellipses) instead of listing all pages
- Streaming service buttons (Spotify, YouTube, Bandcamp, Deezer) displayed on a separate row below the title line on release cards
- Release type classification: inferred from Spotify (`album_type` + `total_tracks`), then Deezer (`record_type`), then title heuristic as fallback. Stored in `release_type` column (Single / EP / LP)

### INKY TIP (Curator Picks)

- Releases can be manually flagged as "INKY TIP" via the admin page at `/admin`
- Two DB columns: `is_inky_tip` (INTEGER, 0/1) and `inky_tip_note` (TEXT, optional curator note)
- Purple gradient badge with octopus emoji shown on ReleaseCard and release detail page when flagged
- Curator note displayed in italic on the release detail page when present
- Homepage has an "INKY TIPS" toggle button in the filter bar (clears genre filters when activated)
- API supports `inky_tips_only=true` query param on `/api/releases`
- Toggle API: `POST /api/releases/[id]/inky-tip` with `{ is_inky_tip: boolean, inky_tip_note?: string }`
- Admin page (`/admin`) lists all releases with toggle buttons; uses browser `prompt()` for curator notes

## Common Tasks

**Add a new scraper:**
1. Create `src/lib/scrapers/newsource.ts`
2. Add source to `initDb()` in `db.ts`
3. Import and call in `src/app/api/refresh/route.ts`

**Run streaming matching for new releases:**
```bash
curl -X POST http://localhost:3000/api/spotify-match
curl -X POST http://localhost:3000/api/deezer-match
npx dotenv-cli -e .env.local -- npx tsx scripts/match-youtube.ts
```

**Debug scraper issues:**
- Check terminal logs during `npm run dev`
- Scrapers log skipped items (not 2026) and added items

**Silent Radio scraper notes:**
- Walks listing pages up to MAX_PAGES=10, stops when no article URL has month ≤ current month
- JSON-LD dates use space separator (`2026-03-20 10:52:20`) — replaced with `T` before parsing
- Some articles have CDATA-wrapped JSON-LD (`/*<![CDATA[*/.../*]]>*/`) — stripped before `JSON.parse`
- URL-based date fallback (`/MM/DD/` + current year) used only for months ≤ current month
- `for...of` on `Set` requires `Array.from()` due to TypeScript downlevelIteration target

**Shatter the Standards scraper notes:**
- Cover image fetched from `/api/v1/posts/{slug}` `body_html`, first `substackcdn.com` img src
- CDN URL format: `substackcdn.com/image/fetch/.../https%3A%2F%2Fsubstack-post-media...` — decode with `decodeURIComponent`
- `og:image` must NOT be used — it's a Substack-generated social card with text overlay

**Test database connection:**
```bash
curl http://localhost:3000/api/releases
```
