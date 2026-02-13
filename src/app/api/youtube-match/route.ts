import { NextResponse } from "next/server";
import { getReleasesWithoutYouTube, updateReleaseYouTube } from "@/lib/db";
import { searchVideo } from "@/lib/youtube";

export const maxDuration = 300;

export async function POST() {
  try {
    const releases = await getReleasesWithoutYouTube();
    console.log(`Found ${releases.length} releases without YouTube URL`);

    let matched = 0;
    let failed = 0;

    for (const release of releases) {
      try {
        const result = await searchVideo(release.artist, release.title);

        if (result && result.youtubeUrl) {
          await updateReleaseYouTube(release.id, result.youtubeUrl, result.youtubeId);
          console.log(`Matched: ${release.artist} - ${release.title} → ${result.youtubeUrl}`);
          matched++;
        } else {
          console.log(`No match: ${release.artist} - ${release.title}`);
          failed++;
        }

        // Rate limit: 300ms between requests
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Error matching ${release.artist} - ${release.title}:`, error);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      total: releases.length,
      matched,
      noMatch: failed,
    });
  } catch (error) {
    console.error("Error during YouTube matching:", error);
    return NextResponse.json(
      { error: "Failed to match YouTube URLs" },
      { status: 500 }
    );
  }
}
