import { NextResponse } from "next/server";
import { getReleasesWithoutAOTY, updateReleaseAOTY } from "@/lib/db";
import { batchLookupAOTY } from "@/lib/scrapers/aoty";

export async function POST() {
  try {
    console.log("Starting AOTY lookup...");

    // Get releases that need AOTY data (batch of 10)
    const releases = await getReleasesWithoutAOTY(10);

    if (releases.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No releases need AOTY lookup",
      });
    }

    console.log(`Found ${releases.length} releases without AOTY data`);

    // Run batch lookup with 2 second delay between requests
    const results = await batchLookupAOTY(releases, 2000);

    let updated = 0;
    let notFound = 0;
    let withScores = 0;

    // Update database with results
    const entries = Array.from(results.entries());
    for (const [releaseId, result] of entries) {
      await updateReleaseAOTY(
        releaseId,
        result.criticScore,
        result.userScore,
        result.aotyUrl
      );
      updated++;

      if (result.aotyUrl === "NOT_FOUND") {
        notFound++;
      } else if (result.criticScore !== null || result.userScore !== null) {
        withScores++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: updated,
      withScores,
      notFound,
      message: `Processed ${updated} releases: ${withScores} with scores, ${notFound} not found`,
    });
  } catch (error) {
    console.error("Error during AOTY lookup:", error);
    return NextResponse.json(
      { error: "Failed to lookup AOTY ratings" },
      { status: 500 }
    );
  }
}
