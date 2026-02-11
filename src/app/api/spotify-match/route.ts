import { NextResponse } from "next/server";
import { getReleasesWithoutSpotify, updateReleaseSpotify } from "@/lib/db";
import { searchSpotifyAlbum } from "@/lib/spotify";

export const maxDuration = 300;

export async function POST() {
  try {
    const releases = await getReleasesWithoutSpotify();
    console.log(`Found ${releases.length} releases without Spotify URL`);

    let matched = 0;
    let failed = 0;

    for (const release of releases) {
      try {
        const result = await searchSpotifyAlbum(release.artist, release.title);

        if (result && result.spotifyUrl) {
          await updateReleaseSpotify(release.id, result.spotifyUrl, result.spotifyId);
          console.log(`Matched: ${release.artist} - ${release.title} → ${result.spotifyUrl}`);
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
    console.error("Error during Spotify matching:", error);
    return NextResponse.json(
      { error: "Failed to match Spotify URLs" },
      { status: 500 }
    );
  }
}
