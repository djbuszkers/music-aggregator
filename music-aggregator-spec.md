# Music Aggregator Website - Project Spec

## Overview
A personal website that aggregates music reviews and premieres from curated sources, designed for a DJ and radio host who needs a single place to discover new music.

## Goals
- Aggregate album reviews and recommendations from 4 key sources
- Display in a clean, minimal interface
- Update automatically (daily or on-demand)
- Eventually: add personal "DJ Picks" curation layer

## Tech Stack
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Data fetching:** Mix of RSS parsing, HTML scraping, and headless browser
- **Database:** SQLite (via better-sqlite3 or Prisma) for caching
- **Deployment:** Vercel

---

## Data Sources

### 1. Nowa Muzyka (EASY - Start here)
- **URL:** https://www.nowamuzyka.pl/category/recenzje/
- **RSS Feed:** https://www.nowamuzyka.pl/feed/
- **Method:** RSS parsing
- **Data to extract:**
  - Title (artist + album name)
  - Review URL
  - Publication date
  - Cover image
  - Author
  - Short excerpt/description
- **Language:** Polish

### 2. Bandcamp Daily - Best Electronic (EASY)
- **URL:** https://daily.bandcamp.com/best-electronic/
- **RSS Alternative:** https://openrss.org/https://daily.bandcamp.com/best-electronic
- **Method:** HTML scraping with Cheerio (or Open RSS feed)
- **Data to extract:**
  - Article title (e.g., "The Best Electronic Music on Bandcamp, November 2025")
  - Article URL
  - Publication date
  - Cover image
  - This is a monthly roundup, so each article contains multiple album recommendations
- **Note:** Consider also scraping individual albums from within each monthly article

### 3. Resident Advisor (MEDIUM)
- **URL:** https://ra.co/reviews/albums
- **Method:** Headless browser (Puppeteer/Playwright) - page is JavaScript-rendered
- **Alternative:** Check for RSS at https://ra.co/xml/reviews.xml or similar paths
- **Data to extract:**
  - Artist name
  - Album title
  - Label
  - Rating (if available)
  - Review URL
  - Cover image
  - Review date
- **Note:** RA has "RA Recommends" badges for top picks

### 4. Boomkat Weekly Roundup (HARD)
- **URL:** https://boomkat.com/weekly-roundup
- **Method:** Headless browser (site blocks direct requests with 403)
- **Data to extract:**
  - Album of the week
  - Single of the week
  - Recommended new releases (list)
  - For each: artist, title, label, genre, price, cover image
- **Note:** Updates weekly. Consider caching aggressively.

---

## Database Schema (SQLite)

```sql
-- Sources table
CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  last_fetched DATETIME
);

-- Reviews/releases table
CREATE TABLE releases (
  id INTEGER PRIMARY KEY,
  source_id INTEGER REFERENCES sources(id),
  artist TEXT,
  title TEXT NOT NULL,
  label TEXT,
  review_url TEXT UNIQUE,
  cover_image_url TEXT,
  published_at DATETIME,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_featured BOOLEAN DEFAULT FALSE,
  raw_data JSON
);

-- Optional: for personal curation
CREATE TABLE dj_picks (
  id INTEGER PRIMARY KEY,
  release_id INTEGER REFERENCES releases(id),
  notes TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Project Structure

```
music-aggregator/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Homepage - latest releases
│   │   ├── sources/
│   │   │   └── [slug]/page.tsx   # Per-source view
│   │   └── api/
│   │       ├── refresh/route.ts  # Trigger data refresh
│   │       └── releases/route.ts # Get releases (with filters)
│   ├── lib/
│   │   ├── db.ts                 # Database connection
│   │   ├── scrapers/
│   │   │   ├── nowamuzyka.ts     # RSS scraper
│   │   │   ├── bandcamp.ts       # HTML/RSS scraper
│   │   │   ├── ra.ts             # Headless browser scraper
│   │   │   └── boomkat.ts        # Headless browser scraper
│   │   └── types.ts              # TypeScript interfaces
│   └── components/
│       ├── ReleaseCard.tsx
│       ├── ReleaseGrid.tsx
│       ├── SourceFilter.tsx
│       └── Header.tsx
├── prisma/
│   └── schema.prisma             # If using Prisma
├── package.json
└── README.md
```

---

## Implementation Phases

### Phase 1: Foundation (Start here)
1. Set up Next.js project with Tailwind
2. Create SQLite database and schema
3. Build Nowa Muzyka RSS scraper
4. Create basic UI to display releases
5. Test locally

### Phase 2: Add Bandcamp
1. Add Bandcamp Daily scraper (try Open RSS first, fall back to Cheerio)
2. Merge releases from both sources into unified feed
3. Add source filtering to UI

### Phase 3: Add RA
1. Set up Puppeteer/Playwright
2. Build RA scraper
3. Handle pagination if needed
4. Add to unified feed

### Phase 4: Add Boomkat
1. Build Boomkat scraper with headless browser
2. Handle their weekly roundup format
3. Mark "album of the week" as featured

### Phase 5: Polish & Deploy
1. Add refresh mechanism (manual button + cron)
2. Improve UI/UX
3. Deploy to Vercel
4. Set up scheduled refresh (Vercel Cron or external service)

### Phase 6: Personal Curation (Future)
1. Add authentication (simple, just for you)
2. Build "DJ Picks" selection interface
3. Create public "DJ Picks" page for fans

---

## UI Design Notes

- **Minimal and fast** - no clutter
- **Image-forward** - album art is the primary visual element
- **Typography** - clean sans-serif, good contrast
- **Dark mode** - music sites look better dark
- **Mobile-first** - you'll check this on your phone

### Homepage Layout
```
[Header: Site name + source filters]

[Release Grid]
  - Card: Cover image, Artist, Album, Source badge, Date
  - Sorted by date (newest first)
  - Lazy loading / infinite scroll

[Footer: Last updated timestamp, refresh button]
```

---

## Commands to Get Started

```bash
# Create the project
npx create-next-app@latest music-aggregator --typescript --tailwind --app --src-dir

# Navigate to project
cd music-aggregator

# Install dependencies
npm install better-sqlite3 rss-parser cheerio
npm install -D @types/better-sqlite3

# For headless browser (add later in Phase 3)
npm install puppeteer
# or
npm install playwright
```

---

## Notes for Claude Code

When working on this project:

1. **Start simple** - get one source working end-to-end before adding complexity
2. **Cache aggressively** - don't hit sources more than necessary
3. **Handle errors gracefully** - sources may be down or change structure
4. **Log everything** - helpful for debugging scrapers
5. **Respect rate limits** - add delays between requests
6. **Store raw data** - keep the original scraped data in case you need to re-parse

The owner is learning Claude Code, so explain your choices as you go.
