// src/app/api/story-image/[id]/route.ts
import { ImageResponse } from 'next/og';
import { getReleaseById } from '@/lib/db';

import { readFile } from 'fs/promises';
import { join } from 'path';

// ── Local font loader (woff files in public/fonts/) ─────────────────────────
async function loadFont(filename: string): Promise<ArrayBuffer> {
  const buffer = await readFile(join(process.cwd(), 'public', 'fonts', filename));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const numId = parseInt(params.id, 10);
  if (isNaN(numId)) return new Response('Invalid ID', { status: 400 });

  const release = await getReleaseById(numId);
  if (!release) return new Response('Not found', { status: 404 });

  // ── Load fonts ─────────────────────────────────────────────────────────────
  const [syneBlack, syneBold, syneRegular, spaceMono] = await Promise.all([
    loadFont('syne-latin-800-normal.woff'),
    loadFont('syne-latin-700-normal.woff'),
    loadFont('syne-latin-400-normal.woff'),
    loadFont('space-mono-latin-400-normal.woff'),
  ]);

  // ── Sanitise data ──────────────────────────────────────────────────────────
  const artist = release.artist ?? 'Unknown Artist';
  const title = release.title ?? 'Unknown Title';
  const genre = release.genre ?? '';
  const label = release.label ?? '';
  const snippet = release.review_snippet ?? '';
  const releaseType = release.release_type ?? '';
  const isInkyTip = Boolean(release.is_inky_tip);
  const coverImage = release.cover_image ?? null;

  // Truncate review snippet to ~120 chars for the card
  const shortSnippet = snippet.length > 120
    ? snippet.slice(0, 117).replace(/\s+\S*$/, '') + '\u2026'
    : snippet;

  // Genre tags — up to 3
  const genreTags = genre
    ? genre.split(',').map((g: string) => g.trim().toUpperCase()).slice(0, 3)
    : [];

  // Source name shortened
  const source = release.source_name ?? '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1920px',
          backgroundColor: '#09090b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: '"Syne"',
        }}
      >
        {/* ── Blurred cover art background ── */}
        {coverImage && (
          <img
            src={coverImage}
            width={1280}
            height={1280}
            style={{
              position: 'absolute',
              top: '-100px',
              left: '-100px',
              filter: 'blur(120px) saturate(0.5) brightness(0.2)',
              transform: 'scale(1.2)',
            }}
          />
        )}

        {/* ── Gradient: top fade ── */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '400px',
            background: 'linear-gradient(to bottom, #09090b 0%, transparent 100%)',
          }}
        />

        {/* ── Gradient: bottom fade ── */}
        <div
          style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: '700px',
            background: 'linear-gradient(to top, #09090b 35%, transparent 100%)',
          }}
        />

        {/* ── Left accent line ── */}
        <div
          style={{
            position: 'absolute',
            top: 0, bottom: 0, left: 0,
            width: '5px',
            background: 'linear-gradient(to bottom, transparent 0%, #7c3aed 20%, #7c3aed 80%, transparent 100%)',
          }}
        />

        {/* ── Header: OctoCrate branding ── */}
        <div
          style={{
            position: 'absolute',
            top: '60px',
            left: '60px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span style={{ fontSize: '28px', lineHeight: 1 }}>🐙</span>
          </div>
          <span
            style={{
              fontFamily: '"Syne"',
              fontWeight: 800,
              fontSize: '36px',
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: '-0.01em',
            }}
          >
            OctoCrate
          </span>
        </div>

        {/* ── Source badge (top right) ── */}
        {source && (
          <div
            style={{
              position: 'absolute',
              top: '72px',
              right: '60px',
              fontFamily: '"Space Mono"',
              fontSize: '22px',
              color: '#52525b',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {source}
          </div>
        )}

        {/* ── Album cover ── */}
        <div
          style={{
            position: 'absolute',
            top: '190px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '620px',
            height: '620px',
            display: 'flex',
          }}
        >
          {coverImage ? (
            <img
              src={coverImage}
              width={620}
              height={620}
              style={{
                borderRadius: '24px',
                objectFit: 'cover',
                boxShadow: '0 0 0 2px rgba(255,255,255,0.06), 0 60px 120px rgba(0,0,0,0.8), 0 20px 40px rgba(124,58,237,0.12)',
              }}
            />
          ) : (
            /* Placeholder if no cover */
            <div
              style={{
                width: '620px',
                height: '620px',
                borderRadius: '24px',
                backgroundColor: '#1c1c1e',
                border: '2px solid rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '120px' }}>🎵</span>
            </div>
          )}

          {/* ── INKY TIP badge on cover ── */}
          {isInkyTip && (
            <div
              style={{
                position: 'absolute',
                top: '-22px',
                right: '-22px',
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: 'white',
                fontFamily: '"Syne"',
                fontWeight: 700,
                fontSize: '22px',
                letterSpacing: '0.06em',
                padding: '10px 22px',
                borderRadius: '40px',
                textTransform: 'uppercase',
                boxShadow: '0 8px 24px rgba(124,58,237,0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              🐙 Inky Tip
            </div>
          )}
        </div>

        {/* ── Content block (bottom area) ── */}
        <div
          style={{
            position: 'absolute',
            bottom: '140px',
            left: 0, right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '0 80px',
          }}
        >
          {/* Release type pill */}
          {releaseType && (
            <div
              style={{
                fontFamily: '"Space Mono"',
                fontSize: '22px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#7c3aed',
                border: '1px solid rgba(124,58,237,0.35)',
                padding: '6px 24px',
                borderRadius: '4px',
                marginBottom: '36px',
              }}
            >
              {releaseType}
            </div>
          )}

          {/* Artist name */}
          <div
            style={{
              fontFamily: '"Syne"',
              fontWeight: 800,
              fontSize: '72px',
              color: '#ffffff',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              textAlign: 'center',
              marginBottom: '20px',
              textShadow: '0 4px 40px rgba(0,0,0,0.9)',
            }}
          >
            {artist}
          </div>

          {/* Album title */}
          <div
            style={{
              fontFamily: '"Syne"',
              fontWeight: 400,
              fontSize: '48px',
              color: '#a1a1aa',
              textAlign: 'center',
              letterSpacing: '0.01em',
              marginBottom: '48px',
            }}
          >
            {title}
          </div>

          {/* Divider */}
          <div
            style={{
              width: '80px',
              height: '2px',
              backgroundColor: 'rgba(124,58,237,0.6)',
              marginBottom: '36px',
            }}
          />

          {/* Label */}
          {label && (
            <div
              style={{
                fontFamily: '"Space Mono"',
                fontSize: '24px',
                color: '#52525b',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: '28px',
              }}
            >
              {label}
            </div>
          )}

          {/* Review quote */}
          {shortSnippet && (
            <div
              style={{
                fontFamily: '"Syne"',
                fontStyle: 'italic',
                fontSize: '30px',
                color: 'rgba(255,255,255,0.35)',
                textAlign: 'center',
                lineHeight: 1.6,
                marginBottom: '44px',
                padding: '0 20px',
              }}
            >
              {`\u201C${shortSnippet}\u201D`}
            </div>
          )}

          {/* Genre tags */}
          {genreTags.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {genreTags.map((tag: string) => (
                <div
                  key={tag}
                  style={{
                    fontFamily: '"Space Mono"',
                    fontSize: '20px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#71717a',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '8px 20px',
                    borderRadius: '4px',
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          <span
            style={{
              fontFamily: '"Space Mono"',
              fontSize: '22px',
              color: '#3f3f46',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            octocrate.vercel.app
          </span>
          <div
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: '#3f3f46',
            }}
          />
          <span
            style={{
              fontFamily: '"Space Mono"',
              fontSize: '22px',
              color: '#3f3f46',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Music from the deep
          </span>
        </div>

      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: 'Syne', data: syneBlack, weight: 800 as const, style: 'normal' as const },
        { name: 'Syne', data: syneBold, weight: 700 as const, style: 'normal' as const },
        { name: 'Syne', data: syneRegular, weight: 400 as const, style: 'normal' as const },
        { name: 'Space Mono', data: spaceMono, weight: 400 as const, style: 'normal' as const },
      ],
    }
  );
}
