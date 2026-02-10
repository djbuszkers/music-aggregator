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
