"use client";

import { useState } from "react";

interface ShareButtonProps {
  releaseId: number;
  artist: string;
  title: string;
}

export function ShareButton({ releaseId, artist, title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

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

  return (
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
  );
}
