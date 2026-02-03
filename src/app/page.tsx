"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { ReleaseGrid } from "@/components/ReleaseGrid";
import type { Release } from "@/lib/types";

interface ReleasesResponse {
  releases: Release[];
  lastUpdated: string | null;
  count: number;
}

export default function Home() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReleases = useCallback(async () => {
    try {
      const response = await fetch("/api/releases");
      const data: ReleasesResponse = await response.json();
      setReleases(data.releases);
      setLastUpdated(data.lastUpdated);
    } catch (error) {
      console.error("Failed to fetch releases:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  const handleRefresh = async () => {
    try {
      const response = await fetch("/api/refresh", { method: "POST" });
      const data = await response.json();
      console.log("Refresh result:", data);
      await fetchReleases();
    } catch (error) {
      console.error("Failed to refresh:", error);
    }
  };

  return (
    <div className="min-h-screen">
      <Header lastUpdated={lastUpdated} onRefresh={handleRefresh} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : (
          <ReleaseGrid releases={releases} />
        )}
      </main>
    </div>
  );
}
