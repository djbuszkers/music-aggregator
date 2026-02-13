import { NextResponse } from "next/server";
import { getReleasesWithoutDeezer, updateReleaseDeezer } from "@/lib/db";
import { searchDeezerAlbum } from "@/lib/deezer";

export const maxDuration = 300;

export async function POST() {
  try {
    const releases = await getReleasesWithoutDeezer();
    console.log(`Found ${releases.length} releases without Deezer URL`);

    let matched = 0;
    let failed = 0;

    for (const release of releases) {
      try {
        const result = await searchDeezerAlbum(release.artist, release.title);

        if (result && result.deezerUrl) {
          await updateReleaseDeezer(release.id, result.deezerUrl, result.deezerId);
          console.log(`Deezer matched: ${release.artist} - ${release.title} → ${result.deezerUrl}`);
          matched++;
        } else {
          console.log(`Deezer no match: ${release.artist} - ${release.title}`);
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
    console.error("Error during Deezer matching:", error);
    return NextResponse.json(
      { error: "Failed to match Deezer URLs" },
      { status: 500 }
    );
  }
}
