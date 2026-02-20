"use client";

import { useState } from "react";

interface ShareButtonProps {
  releaseId: number;
  artist: string;
  title: string;
}

export function ShareButton({ releaseId, artist, title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [loadingStory, setLoadingStory] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const shareUrl = `${window.location.origin}/release/${releaseId}`;
    const shareText = `${artist} - ${title}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareText,
          text: "Check out this release on OctoCrate",
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const handleStoryShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setLoadingStory(true);
    try {
      const response = await fetch(`/api/story-image/${releaseId}`);
      if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);

      const blob = await response.blob();
      const filename = `${artist.replace(/[^a-z0-9]/gi, "-")}-${title.replace(/[^a-z0-9]/gi, "-")}-story.png`;
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert("Story image downloaded! Open Instagram → + → Story → select the image.");
      }
    } catch (err) {
      console.error("Story share failed:", err);
      alert("Could not generate story image. Please try again.");
    } finally {
      setLoadingStory(false);
    }
  };

  return (
    <>
      <button
        onClick={handleShare}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 hover:text-zinc-200 transition-colors cursor-pointer"
        title="Share this release"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        {copied ? "Copied!" : "Share"}
      </button>
      <button
        onClick={handleStoryShare}
        disabled={loadingStory}
        className="hidden max-sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 hover:text-zinc-200 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-50"
        title="Share to Instagram Story"
      >
        {loadingStory ? (
          <svg
            className="w-3 h-3 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="w-3 h-3"
            style={{ fill: "url(#ig-grad)" }}
          >
            <defs>
              <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f9a825" />
                <stop offset="50%" stopColor="#e91e63" />
                <stop offset="100%" stopColor="#7b1fa2" />
              </linearGradient>
            </defs>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        )}
        {loadingStory ? "Generating\u2026" : "Story"}
      </button>
    </>
  );
}
