import { NextRequest, NextResponse } from "next/server";
import { getReleases, getSources, getLastUpdated, getTotalReleases, getDistinctGenres } from "@/lib/db";

const PAGE_SIZE = 15;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sourceParam = searchParams.get("source");
    const pageParam = searchParams.get("page");
    const genresParam = searchParams.get("genres");

    const allSources = await getSources();

    let sourceIds: number[] | undefined;
    if (sourceParam) {
      const names = sourceParam.split(",").map((s) => s.trim().toLowerCase());
      const ids = names
        .map((name) => allSources.find((s) => s.name.toLowerCase() === name)?.id)
        .filter((id): id is number => id !== undefined);
      if (ids.length > 0) sourceIds = ids;
    }

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const offset = (page - 1) * PAGE_SIZE;
    const genreFilter = genresParam ? genresParam.split(",").filter(Boolean) : undefined;
    const inkyTipsOnly = searchParams.get("inky_tips_only") === "true";
    const releaseTypeParam = searchParams.get("release_type");
    const releaseTypes = releaseTypeParam ? releaseTypeParam.split(",").filter(Boolean) : undefined;
    const searchQuery = searchParams.get("q") || undefined;

    const releases = await getReleases(sourceIds, PAGE_SIZE, offset, genreFilter, inkyTipsOnly, releaseTypes, searchQuery);
    const totalCount = await getTotalReleases(sourceIds, genreFilter, inkyTipsOnly, releaseTypes, searchQuery);
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const lastUpdated = await getLastUpdated();
    const genres = await getDistinctGenres();

    return NextResponse.json({
      releases,
      lastUpdated,
      genres,
      sources: allSources.map((s) => s.name),
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
