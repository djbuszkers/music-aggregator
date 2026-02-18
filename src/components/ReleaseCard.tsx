"use client";

import type { Release } from "@/lib/types";
import { ShareButton } from "./ShareButton";

interface ReleaseCardProps {
  release: Release;
}

export function ReleaseCard({ release }: ReleaseCardProps) {
  const formattedDate = new Date(release.published_at).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );

  return (
    <a
      href={`/release/${release.id}`}
      className="group flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 bg-zinc-900 rounded-xl hover:bg-zinc-800/80 transition-colors"
    >
      {/* Cover Image */}
      <div className="flex-shrink-0">
        {release.cover_image ? (
          <img
            src={release.cover_image}
            alt={`${release.artist} - ${release.title}`}
            className="w-full sm:w-[240px] aspect-square sm:h-[240px] object-cover bg-zinc-800 rounded-lg"
          />
        ) : (
          <div className="w-full sm:w-[240px] aspect-square sm:h-[240px] bg-zinc-800 rounded-lg flex items-center justify-center">
            <span className="text-zinc-600 text-4xl">♪</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-white group-hover:text-zinc-200">
                {release.artist}
              </span>
              <span className="text-zinc-600 mx-2">—</span>
              <span className="text-zinc-300">{release.title}</span>
              {release.label && (
                <span className="text-zinc-600 text-sm ml-2">({release.label})</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-zinc-500">{formattedDate}</span>
              {release.release_type && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  release.release_type === "Single" ? "bg-blue-950 text-blue-300" :
                  release.release_type === "EP" ? "bg-amber-950 text-amber-300" :
                  "bg-green-950 text-green-300"
                }`}>
                  {release.release_type}
                </span>
              )}
              {release.is_inky_tip ? (
                <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white rounded">
                  🐙 INKY TIP
                </span>
              ) : null}
              <span className="px-1.5 py-0.5 text-[10px] text-zinc-500 bg-zinc-800/50 rounded">
                {release.source_name}
              </span>
              <ShareButton
                releaseId={release.id}
                artist={release.artist}
                title={release.title}
              />
            </div>
          </div>
          {(release.spotify_url || release.youtube_url || release.bandcamp_url || release.deezer_url) && (
            <div className="flex items-center justify-start sm:justify-end gap-2 mt-2">
              {release.spotify_url && (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(release.spotify_url!, "_blank", "noopener,noreferrer");
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-[#14532d] text-[#4ade80] rounded hover:bg-[#166534] transition-colors cursor-pointer"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Spotify
                </span>
              )}
              {release.youtube_url && (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(release.youtube_url!, "_blank", "noopener,noreferrer");
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-[#7f1d1d] text-[#fca5a5] rounded hover:bg-[#991b1b] transition-colors cursor-pointer"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  YouTube
                </span>
              )}
              {release.bandcamp_url && (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(release.bandcamp_url!, "_blank", "noopener,noreferrer");
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-[#164e63] text-[#67e8f9] rounded hover:bg-[#155e75] transition-colors cursor-pointer"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 18.75l7.437-13.5H24l-7.438 13.5z"/>
                  </svg>
                  Bandcamp
                </span>
              )}
              {release.deezer_url && (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(release.deezer_url!, "_blank", "noopener,noreferrer");
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-[#7c2d12] to-[#831843] text-[#fdba74] rounded hover:from-[#9a3412] hover:to-[#9d174d] transition-colors cursor-pointer"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.19V8.38H6.27zm6.27 0v3.027h5.19V8.38h-5.19zm6.27 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.19v-3.027H6.27zm6.27 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.19v-3.03H6.27zm6.27 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19z"/>
                  </svg>
                  Deezer
                </span>
              )}
            </div>
          )}
          <div className="mt-2">
            {release.genre && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {release.genre.split(",").map((g) => g.trim()).filter(Boolean).map((g) => (
                  <span key={g} className="border border-zinc-700 text-zinc-400 rounded-full px-2 py-0.5 text-xs">
                    {g}
                  </span>
                ))}
              </div>
            )}
            {release.review_snippet && (
              <p className="text-zinc-600 text-sm line-clamp-3">{release.review_snippet}</p>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
