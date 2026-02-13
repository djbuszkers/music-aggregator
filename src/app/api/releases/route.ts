import { NextRequest, NextResponse } from "next/server";
import { getReleases, getSources, getLastUpdated, getTotalReleases, getDistinctGenres } from "@/lib/db";

const PAGE_SIZE = 15;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sourceParam = searchParams.get("source");
    const pageParam = searchParams.get("page");
    const genresParam = searchParams.get("genres");

    let sourceId: number | undefined;

    if (sourceParam) {
      const sources = await getSources();
      const source = sources.find(
        (s) => s.name.toLowerCase() === sourceParam.toLowerCase()
      );
      if (source) {
        sourceId = source.id;
      }
    }

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const offset = (page - 1) * PAGE_SIZE;
    const genreFilter = genresParam ? genresParam.split(",").filter(Boolean) : undefined;
    const inkyTipsOnly = searchParams.get("inky_tips_only") === "true";
    const releaseType = searchParams.get("release_type") || undefined;

    const releases = await getReleases(sourceId, PAGE_SIZE, offset, genreFilter, inkyTipsOnly, releaseType);
    const totalCount = await getTotalReleases(sourceId, genreFilter, inkyTipsOnly, releaseType);
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const lastUpdated = await getLastUpdated();
    const genres = await getDistinctGenres();

    return NextResponse.json({
      releases,
      lastUpdated,
      genres,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching releases:", error);
    return NextResponse.json(
      { error: "Failed to fetch releases" },
      { status: 500 }
    );
  }
}
