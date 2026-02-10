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
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const fetchReleases = useCallback(async (page: number = 1, genre: string | null = null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      if (genre) {
        params.set("genre", genre);
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
    fetchReleases(1, selectedGenre);
  }, [fetchReleases, selectedGenre]);

  const handlePageChange = (page: number) => {
    fetchReleases(page, selectedGenre);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenreChange = (genre: string | null) => {
    setSelectedGenre(genre);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen">
      <Header lastUpdated={lastUpdated} />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Genre Filter */}
        <div className="sticky top-[60px] sm:top-[100px] z-40 bg-zinc-950/95 backdrop-blur-sm -mx-4 px-4 py-3 mb-4">
          <div className="flex flex-nowrap overflow-x-auto sm:flex-wrap gap-1.5 scrollbar-hide">
            <button
              onClick={() => handleGenreChange(null)}
              className={`px-3 py-2 sm:px-2 sm:py-1 text-xs rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                selectedGenre === null
                  ? "bg-white text-black font-medium"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              All Genres
            </button>
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => handleGenreChange(genre)}
                className={`px-3 py-2 sm:px-2 sm:py-1 text-xs rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                  selectedGenre === genre
                    ? "bg-white text-black font-medium"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
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
