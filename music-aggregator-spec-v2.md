# Music Aggregator Website - Project Spec v2

## Overview
A personal website that aggregates music reviews and premieres from curated sources, designed for a DJ and radio host who needs a single place to discover new music. Focus: underground electronic, soul, UK jazz.

## Goals
- Aggregate album reviews and recommendations from 7 key sources
- Display in a clean, minimal interface
- Update automatically (weekly via GitHub Actions)
- Add Spotify links to releases for easy listening
- Eventually: add personal "DJ Picks" curation layer

## Tech Stack
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Data fetching:** Mix of RSS parsing, HTML scraping, and headless browser
- **Database:** SQLite (local dev) → Turso (production, for shared access)
- **Deployment:** Vercel (frontend) + GitHub Actions (scheduled scraping)
- **External APIs:** Spotify Web API (for album links)

---

## Data Sources

### EXISTING SOURCES (Already Implemented)

#### 1. Nowa Muzyka
- **URL:** https://www.nowamuzyka.pl/category/recenzje/
- **RSS Feed:** https://www.nowamuzyka.pl/feed/
- **Method:** RSS parsing
- **Language:** Polish
- **Update frequency:** Several times per week

#### 2. Bandcamp Daily - Best Electronic
- **URL:** https://daily.bandcamp.com/best-electronic/
- **Method:** HTML scraping with Cheerio (or Open RSS)
- **Update frequency:** Monthly roundups

#### 3. Resident Advisor
- **URL:** https://ra.co/reviews/albums
- **Method:** Headless browser (Puppeteer/Playwright)
- **Update frequency:** Multiple times per week

#### 4. Boomkat Weekly Roundup
- **URL:** https://boomkat.com/weekly-roundup
- **Method:** Headless browser (site blocks direct requests)
- **Update frequency:** Weekly

---

### NEW SOURCES (To Add)

#### 5. Inverted Audio (Underground Electronic)
- **URL:** https://inverted-audio.com/review/
- **Type:** London-based magazine, underground electronic focus
- **Method:** HTML scraping with Cheerio (clean structure)
- **Data to extract:**
  - Artist name
  - Album/release title
  - Label
  - Genre tags
  - Review URL
  - Cover image
  - Publication date
  - Short excerpt
- **Structure notes:**
  - Reviews archive at `/review/`
  - Individual reviews have structured data: artist, label, genre, release date
  - Clean HTML, well-organized
- **Update frequency:** Several times per week
- **RSS:** Check for `/feed/` or similar

#### 6. The Quietus (Experimental/Underground)
- **URL:** https://thequietus.com/reviews/
- **Type:** UK-based, eclectic coverage — experimental, electronic, psych, metal, folk
- **Method:** HTML scraping (likely has RSS too)
- **Key sections to scrape:**
  - Album of the Week: `/columns/quietus-reviews/album-of-the-week/`
  - Electronic: `/columns/quietus-reviews/electronic/` (if exists)
  - Rum Music (experimental): check for this column
- **Data to extract:**
  - Artist name
  - Album title
  - Review URL
  - Cover image
  - Publication date
  - Author
  - Category/column name
- **Structure notes:**
  - Well-organized by genre/column
  - Older WordPress-style site, likely has RSS
- **Update frequency:** Multiple times per week
- **RSS:** Check `thequietus.com/feed/` or similar

#### 7. Passion of the Weiss (Hip-Hop/Experimental Crossover)
- **URL:** https://www.passionweiss.com/category/album-reviews/
- **Type:** LA-based, hip-hop focused but crosses into electronic, experimental, jazz
- **Method:** RSS parsing (WordPress site)
- **RSS Feed:** https://www.passionweiss.com/feed/ (standard WordPress)
- **Data to extract:**
  - Article title (usually contains artist + album)
  - Review URL
  - Publication date
  - Author
  - Featured image
  - Excerpt
- **Structure notes:**
  - WordPress site = standard RSS structure
  - Album reviews at `/category/album-reviews/`
  - Also has `/category/reviews/` for broader coverage
  - Great long-form writing, less frequent but high quality
- **Update frequency:** Few times per month
- **RSS:** Yes, standard WordPress feed

---

## Database Schema (SQLite/Turso)

```sql
-- Sources table
CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  scraper_type TEXT NOT NULL, -- 'rss', 'cheerio', 'puppeteer'
  last_fetched DATETIME,
  is_active BOOLEAN DEFAULT TRUE
);

-- Releases table
CREATE TABLE releases (
  id INTEGER PRIMARY KEY,
  source_id INTEGER REFERENCES sources(id),
  artist TEXT,
  title TEXT NOT NULL,
  label TEXT,
  genre TEXT,
  review_url TEXT UNIQUE,
  cover_image_url TEXT,
  description TEXT,
  author TEXT,
  published_at DATETIME,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_featured BOOLEAN DEFAULT FALSE,
  spotify_url TEXT,
  spotify_id TEXT,
  raw_data JSON
);

-- DJ Picks (for future personal curation)
CREATE TABLE dj_picks (
  id INTEGER PRIMARY KEY,
  release_id INTEGER REFERENCES releases(id),
  notes TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX idx_releases_published ON releases(published_at DESC);
CREATE INDEX idx_releases_source ON releases(source_id);
```

---

## Project Structure

```
music-aggregator/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Homepage - latest releases
│   │   ├── sources/
│   │   │   └── [slug]/page.tsx         # Per-source view
│   │   └── api/
│   │       ├── refresh/route.ts        # Manual refresh trigger
│   │       └── releases/route.ts       # Get releases (with filters)
│   ├── lib/
│   │   ├── db.ts                       # Database connection
│   │   ├── spotify.ts                  # Spotify API integration
│   │   ├── scrapers/
│   │   │   ├── index.ts                # Scraper orchestrator
│   │   │   ├── nowamuzyka.ts           # RSS
│   │   │   ├── bandcamp.ts             # Cheerio
│   │   │   ├── ra.ts                   # Puppeteer
│   │   │   ├── boomkat.ts              # Puppeteer
│   │   │   ├── inverted-audio.ts       # Cheerio (NEW)
│   │   │   ├── quietus.ts              # Cheerio/RSS (NEW)
│   │   │   └── passion-weiss.ts        # RSS (NEW)
│   │   └── types.ts                    # TypeScript interfaces
│   └── components/
│       ├── ReleaseCard.tsx
│       ├── ReleaseGrid.tsx
│       ├── SourceFilter.tsx
│       ├── SpotifyLink.tsx             # NEW
│       └── Header.tsx
├── scripts/
│   └── scrape.ts                       # CLI script for manual/scheduled scraping
├── .github/
│   └── workflows/
│       └── scrape.yml                  # Weekly GitHub Action
├── prisma/
│   └── schema.prisma                   # If using Prisma
├── .env.local                          # Local environment variables
├── package.json
└── README.md
```

---

## Scraper Specifications

### Inverted Audio Scraper (`inverted-audio.ts`)

```typescript
// Target: https://inverted-audio.com/review/
// Method: Cheerio (HTML scraping)

interface InvertedAudioRelease {
  artist: string;
  title: string;
  label: string;
  genres: string[];
  reviewUrl: string;
  coverImage: string;
  publishedAt: Date;
  excerpt: string;
}

// Selectors to investigate:
// - Review cards on /review/ page
// - Individual review pages for full data
// - Look for structured data (JSON-LD) on review pages
```

### The Quietus Scraper (`quietus.ts`)

```typescript
// Target: https://thequietus.com/reviews/
// Also: /columns/quietus-reviews/album-of-the-week/
// Method: RSS first, fall back to Cheerio

interface QuietusRelease {
  artist: string;
  title: string;
  reviewUrl: string;
  coverImage: string;
  publishedAt: Date;
  author: string;
  column: string; // e.g., "Album of the Week", "Rum Music", "Electronic"
  excerpt: string;
}

// Check for RSS at:
// - thequietus.com/feed/
// - thequietus.com/reviews/feed/
```

### Passion of the Weiss Scraper (`passion-weiss.ts`)

```typescript
// Target: https://www.passionweiss.com/feed/
// Method: RSS parsing

interface PassionWeissRelease {
  articleTitle: string; // Parse artist/album from this
  artist: string;       // Extracted from title
  title: string;        // Extracted from title
  reviewUrl: string;
  coverImage: string;
  publishedAt: Date;
  author: string;
  excerpt: string;
}

// Note: Title parsing may need regex to extract artist/album
// e.g., "Artist Name's 'Album Title' Review" or similar patterns
```

---

## Spotify Integration

### Authentication (Client Credentials Flow)

```typescript
// src/lib/spotify.ts

const getAccessToken = async (): Promise<string> => {
  // 1. Check if cached token is still valid
  // 2. If not, request new token using Client ID + Secret
  // 3. Cache token with expiry time
  // 4. Return token
};

const searchAlbum = async (artist: string, album: string): Promise<string | null> => {
  // 1. Get access token
  // 2. Search Spotify: GET /v1/search?q=artist:{artist}+album:{album}&type=album
  // 3. Return first result's URL, or null if not found
};
```

### Environment Variables

```bash
# .env.local
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret

# For Turso (production database)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_token
```

---

## GitHub Actions Workflow

```yaml
# .github/workflows/scrape.yml
name: Weekly Scrape

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM UTC
  workflow_dispatch:      # Allow manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install chromium
      
      - name: Run scraper
        env:
          SPOTIFY_CLIENT_ID: ${{ secrets.SPOTIFY_CLIENT_ID }}
          SPOTIFY_CLIENT_SECRET: ${{ secrets.SPOTIFY_CLIENT_SECRET }}
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
        run: npm run scrape
      
      - name: Log results
        run: echo "Scrape completed at $(date)"
```

---

## Implementation Phases

### Phase 1: Foundation ✅ (Completed)
- [x] Set up Next.js project with Tailwind
- [x] Create SQLite database and schema
- [x] Build Nowa Muzyka RSS scraper
- [x] Build Bandcamp Daily scraper
- [x] Build Resident Advisor scraper
- [x] Build Boomkat scraper
- [x] Create basic UI with source filtering

### Phase 2: New Sources (Current)
1. Add Inverted Audio scraper (Cheerio)
2. Add The Quietus scraper (RSS/Cheerio)
3. Add Passion of the Weiss scraper (RSS)
4. Test all new scrapers locally

### Phase 3: Spotify Integration
1. Set up Spotify Developer app
2. Implement Client Credentials auth flow
3. Add `searchAlbum()` function
4. Update scrapers to fetch Spotify URLs after saving
5. Add Spotify icon/link to UI

### Phase 4: Production Database
1. Set up Turso account (free tier)
2. Migrate schema to Turso
3. Update database connection to use Turso URL
4. Test with both local and production DB

### Phase 5: Automated Scraping
1. Push project to GitHub
2. Add secrets to GitHub repository
3. Create GitHub Actions workflow
4. Test manual trigger
5. Verify scheduled runs

### Phase 6: Polish & Deploy
1. Deploy frontend to Vercel
2. Add environment variables to Vercel
3. Test end-to-end flow
4. Optimize UI/UX
5. Add loading states and error handling

### Phase 7: Personal Curation (Future)
1. Add simple authentication
2. Build "DJ Picks" selection interface
3. Create public "DJ Picks" page

---

## UI Design Notes

### Current Features
- Dark theme
- Source badges (Boomkat, Bandcamp Daily, Resident Advisor, Nowa Muzyka)
- Genre tags
- Description excerpts
- Date display

### To Add
- Spotify icon/link (green Spotify icon, opens in new tab)
- Source filtering (already implemented)
- "Featured" badge for album of the week picks
- Lazy loading / infinite scroll
- Last updated timestamp

### Release Card Layout

```
┌─────────────────────────────────────────────────────────┐
│ Artist Name  —  Album Title  (Label)     [Source] Date │
│ Genre: Electronic; Ambient                    [Spotify] │
│                                                         │
│ Review excerpt text goes here, truncated after a        │
│ certain number of characters...                         │
└─────────────────────────────────────────────────────────┘
```

---

## Source Summary

| Source | Method | Frequency | Genre Focus |
|--------|--------|-----------|-------------|
| Nowa Muzyka | RSS | 2-3x/week | Electronic, Experimental |
| Bandcamp Daily | Cheerio | Monthly | Electronic |
| Resident Advisor | Puppeteer | 2-3x/week | Electronic, Dance |
| Boomkat | Puppeteer | Weekly | Electronic, Experimental |
| Inverted Audio | Cheerio | 2-3x/week | Underground Electronic |
| The Quietus | RSS/Cheerio | Daily | Experimental, Eclectic |
| Passion of the Weiss | RSS | 2-4x/month | Hip-Hop, Experimental |

---

## Commands Reference

```bash
# Development
npm run dev              # Start Next.js dev server
npm run scrape           # Run all scrapers manually
npm run scrape:source    # Run specific source (e.g., npm run scrape:quietus)

# Database
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio (if using Prisma)

# Deployment
npm run build            # Build for production
vercel                   # Deploy to Vercel
```

---

## Notes for Claude Code

When working on this project:

1. **For new scrapers**, first check if the site has RSS — it's always easier
2. **Test scrapers individually** before integrating
3. **Add delays between requests** (1-2 seconds) to be respectful
4. **Log everything** — helpful for debugging when scrapers break
5. **Store raw data** in the `raw_data` JSON column for re-parsing later
6. **Handle errors gracefully** — one broken source shouldn't crash everything
7. **Spotify matching won't be perfect** — some releases won't be found, that's okay

The owner is learning Claude Code, so explain choices and trade-offs as you go.
