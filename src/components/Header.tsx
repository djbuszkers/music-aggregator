"use client";

import { useState } from "react";

interface HeaderProps {
  lastUpdated: string | null;
  onRefresh: () => Promise<void>;
}

export function Header({ lastUpdated, onRefresh }: HeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Muzyczka</h1>
          {formattedDate && (
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              Last updated: {formattedDate}
            </p>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 sm:px-4 sm:py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg
            className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="hidden sm:inline">{isRefreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>
    </header>
  );
}
