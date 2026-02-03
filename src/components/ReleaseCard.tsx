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
      className="group block py-4 px-4 hover:bg-zinc-900 transition-colors border-b border-zinc-800"
    >
      <div className="flex items-baseline justify-between gap-4">
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
          <span className="text-xs text-zinc-500 w-20 text-right">{formattedDate}</span>
        </div>
      </div>
      {release.review_snippet && (() => {
        const parts = release.review_snippet.split("\n\n");
        const genre = parts[0];
        const description = parts.slice(1).join("\n\n");
        return (
          <div className="text-sm mt-1">
            {genre && (
              <span className="text-zinc-500">{genre}&nbsp;</span>
            )}
            {description && (
              <p className="text-zinc-600 mt-1 line-clamp-2">{description}</p>
            )}
          </div>
        );
      })()}
    </a>
  );
}
