"use client";

import type { Release } from "@/lib/types";

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
      href={release.review_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col sm:flex-row gap-3 sm:gap-4 py-4 px-4 hover:bg-zinc-900 transition-colors border-b border-zinc-800"
    >
      {/* Cover Image */}
      <div className="flex-shrink-0">
        {release.cover_image ? (
          <img
            src={release.cover_image}
            alt={`${release.artist} - ${release.title}`}
            className="w-full sm:w-[200px] aspect-square sm:h-[200px] object-cover bg-zinc-800"
          />
        ) : (
          <div className="w-full sm:w-[200px] aspect-square sm:h-[200px] bg-zinc-800 flex items-center justify-center">
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
              <span className="text-zinc-500 mx-2">—</span>
              <span className="text-zinc-400">{release.title}</span>
              {release.label && (
                <span className="text-zinc-600 text-sm ml-2">({release.label})</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {release.spotify_url && (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(release.spotify_url!, "_blank", "noopener,noreferrer");
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-[#1DB954] text-black rounded hover:bg-[#1ed760] transition-colors cursor-pointer"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Spotify
                </span>
              )}
              <span className="px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400 rounded">
                {release.source_name}
              </span>
              <span className="text-xs text-zinc-500">{formattedDate}</span>
            </div>
          </div>
          <div className="text-sm mt-2">
            {release.genre && (
              <span className="text-zinc-500">{release.genre}</span>
            )}
            {release.review_snippet && (
              <p className="text-zinc-600 mt-2 line-clamp-5">{release.review_snippet}</p>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
