"use client";

import type { Release } from "@/lib/types";
import { ReleaseCard } from "./ReleaseCard";

interface ReleaseGridProps {
  releases: Release[];
}

export function ReleaseGrid({ releases }: ReleaseGridProps) {
  if (!releases || releases.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">No releases yet. Click refresh to fetch reviews.</p>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-800">
      {releases.map((release) => (
        <ReleaseCard key={release.id} release={release} />
      ))}
    </div>
  );
}
