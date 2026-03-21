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
  sources: string[];
  pagination: Pagination;
}

export default function Home() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [inkyTipsOnly, setInkyTipsOnly] = useState(false);
  const [selectedReleaseType, setSelectedReleaseType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchReleases = useCallback(async (page: number = 1, genres_filter: string[] = [], inkyTips: boolean = false, releaseType: string | null = null, query: string = "", source: string | null = null) => {
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
      if (query) {
        params.set("q", query);
      }
      if (source) {
        params.set("source", source);
      }

      const response = await fetch(`/api/releases?${params}`);
      const data: ReleasesResponse = await response.json();
      setReleases(data.releases || []);
      setLastUpdated(data.lastUpdated);
      setPagination(data.pagination);
      setGenres(data.genres || []);
      setSources(data.sources || []);
      setCurrentPage(page);
    } catch (error) {
      console.error("Failed to fetch releases:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReleases(1, selectedGenres, inkyTipsOnly, selectedReleaseType, debouncedQuery, selectedSource);
  }, [fetchReleases, selectedGenres, inkyTipsOnly, selectedReleaseType, debouncedQuery, selectedSource]);

  const handlePageChange = (page: number) => {
    fetchReleases(page, selectedGenres, inkyTipsOnly, selectedReleaseType, debouncedQuery, selectedSource);
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
    setSelectedSource(null);
    setInkyTipsOnly(false);
    setSelectedReleaseType(null);
    setSearchQuery("");
    setDebouncedQuery("");
    setCurrentPage(1);
  };

  const handleSourceToggle = (source: string) => {
    setSelectedSource((prev) => prev === source ? null : source);
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

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Filters */}
        <div className="sticky top-[56px] sm:top-[76px] z-40 bg-zinc-950/95 backdrop-blur-sm -mx-4 px-4 py-2.5 mb-4 border-b border-zinc-800/50 space-y-1.5">
          {/* Search */}
          <div className="flex justify-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search artist or album…"
              className="w-full max-w-sm px-3 py-1.5 text-xs bg-zinc-800 text-zinc-200 rounded-full border border-zinc-700 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>
          {/* Row 1: All / INKY TIPS / Release Type */}
          <div className="flex flex-wrap justify-center gap-1.5">
            <button
              onClick={handleClearGenres}
              className={`px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                selectedGenres.length === 0 && !selectedSource && !inkyTipsOnly && !selectedReleaseType
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
          {/* Row 2: Sources */}
          {sources.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {sources.map((source) => (
                <button
                  key={source}
                  onClick={() => handleSourceToggle(source)}
                  className={`px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                    selectedSource === source
                      ? "bg-white text-black font-medium"
                      : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          )}
          {/* Row 3: Genres */}
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

                {/* Desktop: windowed page numbers */}
                <div className="hidden sm:flex items-center gap-1">
                  {(() => {
                    const total = pagination.totalPages;
                    const cur = currentPage;
                    const pages: (number | "…")[] = [];
                    const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
                    add(1);
                    if (cur - 1 > 2) pages.push("…");
                    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) add(p);
                    if (cur + 1 < total - 1) pages.push("…");
                    if (total > 1) add(total);
                    return pages.map((p, i) =>
                      p === "…" ? (
                        <span key={`ellipsis-${i}`} className="w-8 text-center text-zinc-600 text-sm select-none">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`w-10 h-10 text-sm rounded ${
                            p === cur ? "bg-white text-black font-semibold" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                          }`}
                        >
                          {p}
                        </button>
                      )
                    );
                  })()}
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
