"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { ReleaseGrid } from "@/components/ReleaseGrid";
import type { Release } from "@/lib/types";

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface ReleasesResponse {
  releases: Release[];
  lastUpdated: string | null;
  genres: string[];
  pagination: Pagination;
}

export default function Home() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [inkyTipsOnly, setInkyTipsOnly] = useState(false);
  const [selectedReleaseType, setSelectedReleaseType] = useState<string | null>(null);

  const fetchReleases = useCallback(async (page: number = 1, genres_filter: string[] = [], inkyTips: boolean = false, releaseType: string | null = null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      if (genres_filter.length > 0) {
        params.set("genres", genres_filter.join(","));
      }
      if (inkyTips) {
        params.set("inky_tips_only", "true");
      }
      if (releaseType) {
        params.set("release_type", releaseType);
      }

      const response = await fetch(`/api/releases?${params}`);
      const data: ReleasesResponse = await response.json();
      setReleases(data.releases || []);
      setLastUpdated(data.lastUpdated);
      setPagination(data.pagination);
      setGenres(data.genres || []);
      setCurrentPage(page);
    } catch (error) {
      console.error("Failed to fetch releases:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReleases(1, selectedGenres, inkyTipsOnly, selectedReleaseType);
  }, [fetchReleases, selectedGenres, inkyTipsOnly, selectedReleaseType]);

  const handlePageChange = (page: number) => {
    fetchReleases(page, selectedGenres, inkyTipsOnly, selectedReleaseType);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
    setCurrentPage(1);
  };

  const handleClearGenres = () => {
    setSelectedGenres([]);
    setInkyTipsOnly(false);
    setSelectedReleaseType(null);
    setCurrentPage(1);
  };

  const handleReleaseTypeToggle = (type: string) => {
    setSelectedReleaseType((prev) => prev === type ? null : type);
    setCurrentPage(1);
  };

  const handleInkyTipsToggle = () => {
    setInkyTipsOnly((prev) => {
      if (!prev) {
        setSelectedGenres([]);
      }
      return !prev;
    });
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen">
      <Header lastUpdated={lastUpdated} />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Filters */}
        <div className="sticky top-[60px] sm:top-[100px] z-40 bg-zinc-950/95 backdrop-blur-sm -mx-4 px-4 py-3 mb-4 space-y-2">
          {/* Row 1: All / INKY TIPS / Release Type */}
          <div className="flex flex-wrap justify-center gap-1.5">
            <button
              onClick={handleClearGenres}
              className={`px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                selectedGenres.length === 0 && !inkyTipsOnly && !selectedReleaseType
                  ? "bg-white text-black font-medium"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              All
            </button>
            <button
              onClick={handleInkyTipsToggle}
              className={`px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                inkyTipsOnly
                  ? "bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white font-bold"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              🐙 INKY TIPS
            </button>
            <span className="w-px h-5 bg-zinc-700/50 flex-shrink-0 self-center" />
            {(["Single", "EP", "LP"] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleReleaseTypeToggle(type)}
                className={`px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                  selectedReleaseType === type
                    ? type === "Single" ? "bg-blue-950 text-blue-300 font-medium" :
                      type === "EP" ? "bg-amber-950 text-amber-300 font-medium" :
                      "bg-green-950 text-green-300 font-medium"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          {/* Row 2: Genres */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => handleGenreToggle(genre)}
                className={`px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                  selectedGenres.includes(genre)
                    ? "bg-white text-black font-medium"
                    : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : (
          <>
            <ReleaseGrid releases={releases} />

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8 pb-8">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {/* Mobile: compact page indicator */}
                <span className="sm:hidden text-sm text-zinc-400">
                  {currentPage} / {pagination.totalPages}
                </span>

                {/* Desktop: full page numbers */}
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`w-10 h-10 text-sm rounded ${
                        page === currentPage
                          ? "bg-white text-black font-semibold"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === pagination.totalPages}
                  className="px-3 py-2 text-sm bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>

                <span className="hidden sm:inline text-zinc-500 text-sm ml-4">
                  {pagination.totalCount} releases
                </span>
              </div>
            )}

            {/* No results message */}
            {!isLoading && releases.length === 0 && (
              <div className="text-center py-12">
                <p className="text-zinc-500">No releases found for this genre.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
