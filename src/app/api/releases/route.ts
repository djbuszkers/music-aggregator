import { NextRequest, NextResponse } from "next/server";
import { getReleases, getSources, getLastUpdated } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sourceParam = searchParams.get("source");
    const limitParam = searchParams.get("limit");

    let sourceId: number | undefined;

    if (sourceParam) {
      const sources = getSources();
      const source = sources.find(
        (s) => s.name.toLowerCase() === sourceParam.toLowerCase()
      );
      if (source) {
        sourceId = source.id;
      }
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const releases = getReleases(sourceId, limit);
    const lastUpdated = getLastUpdated();

    return NextResponse.json({
      releases,
      lastUpdated,
      count: releases.length,
    });
  } catch (error) {
    console.error("Error fetching releases:", error);
    return NextResponse.json(
      { error: "Failed to fetch releases" },
      { status: 500 }
    );
  }
}
