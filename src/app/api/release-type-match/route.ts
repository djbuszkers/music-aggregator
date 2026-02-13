import { NextResponse } from "next/server";
import { getReleasesWithoutReleaseType, updateReleaseType, updateReleaseSpotify } from "@/lib/db";
import { searchSpotifyAlbum } from "@/lib/spotify";
import { inferReleaseTypeFromTitle } from "@/lib/utils";

export const maxDuration = 300;

export async function POST() {
  try {
    let spotifyMatched = 0;
    let titleMatched = 0;

    // First pass: re-run Spotify matching for releases with Spotify data but no release_type
    const noType = await getReleasesWithoutReleaseType();
    const withSpotify = noType.filter((r) => r.spotify_id);
    console.log(`Release type backfill: ${withSpotify.length} releases with Spotify data but no type`);

    for (const release of withSpotify) {
      try {
        const match = await searchSpotifyAlbum(release.artist, release.title);
        if (match?.releaseType) {
          await updateReleaseSpotify(release.id, match.spotifyUrl, match.spotifyId, match.releaseType);
          spotifyMatched++;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Spotify re-match error for ${release.artist} - ${release.title}:`, error);
      }
    }

    // Second pass: title heuristic on remaining
    const stillNoType = await getReleasesWithoutReleaseType();
    for (const release of stillNoType) {
      const inferred = inferReleaseTypeFromTitle(release.title);
      if (inferred) {
        await updateReleaseType(release.id, inferred);
        titleMatched++;
      }
    }

    return NextResponse.json({
      success: true,
      spotifyMatched,
      titleMatched,
      total: spotifyMatched + titleMatched,
      message: `Backfilled ${spotifyMatched} from Spotify, ${titleMatched} from title heuristic`,
    });
  } catch (error) {
    console.error("Error during release type backfill:", error);
    return NextResponse.json(
      { error: "Failed to backfill release types" },
      { status: 500 }
    );
  }
}
