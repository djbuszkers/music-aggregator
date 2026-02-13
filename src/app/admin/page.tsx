"use client";

import { useState, useEffect, useCallback } from "react";
import type { Release } from "@/lib/types";

interface Pagination {
  page: number;
  totalPages: number;
  totalCount: number;
}

export default function AdminPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReleases = useCallback(async (page: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/releases?page=${page}`);
      const data = await res.json();
      setReleases(data.releases || []);
      setPagination(data.pagination);
      setCurrentPage(page);
    } catch (error) {
      console.error("Failed to fetch releases:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReleases(1);
  }, [fetchReleases]);

  const toggleInkyTip = async (release: Release) => {
    const newValue = !release.is_inky_tip;
    let note: string | null = null;

    if (newValue) {
      note = prompt("Optional curator note (leave empty to skip):") || null;
    }

    try {
      const res = await fetch(`/api/releases/${release.id}/inky-tip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_inky_tip: newValue, inky_tip_note: note }),
      });

      if (res.ok) {
        setReleases((prev) =>
          prev.map((r) =>
            r.id === release.id
              ? { ...r, is_inky_tip: newValue ? 1 : 0, inky_tip_note: note }
              : r
          )
        );
      }
    } catch (error) {
      console.error("Failed to toggle inky tip:", error);
    }
  };

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Admin - INKY TIPS</h1>
          <a href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">
            &larr; Back to site
          </a>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {releases.map((release) => (
                <div
                  key={release.id}
                  className={`flex items-center gap-4 py-3 px-4 rounded transition-colors ${
                    release.is_inky_tip ? "bg-purple-950/30 border border-purple-800/50" : "hover:bg-zinc-900"
                  }`}
                >
                  {release.cover_image ? (
                    <img
                      src={release.cover_image}
                      alt=""
                      className="w-12 h-12 object-cover bg-zinc-800 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-zinc-600">&#9835;</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">
                      <span className="font-semibold">{release.artist}</span>
                      <span className="text-zinc-500 mx-1.5">&mdash;</span>
                      <span className="text-zinc-400">{release.title}</span>
                    </div>
                    {release.inky_tip_note && (
                      <p className="text-xs text-purple-300 italic truncate mt-0.5">
                        &ldquo;{release.inky_tip_note}&rdquo;
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => toggleInkyTip(release)}
                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      release.is_inky_tip
                        ? "bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {release.is_inky_tip ? "INKY TIP" : "Mark as Tip"}
                  </button>
                </div>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => fetchReleases(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-zinc-400">
                  {currentPage} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchReleases(currentPage + 1)}
                  disabled={currentPage === pagination.totalPages}
                  className="px-3 py-2 text-sm bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
