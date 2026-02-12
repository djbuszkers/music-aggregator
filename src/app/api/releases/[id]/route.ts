import { NextRequest, NextResponse } from "next/server";
import { getReleaseById } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid release ID" }, { status: 400 });
    }

    const release = await getReleaseById(id);

    if (!release) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    return NextResponse.json(release);
  } catch (error) {
    console.error("Error fetching release:", error);
    return NextResponse.json(
      { error: "Failed to fetch release" },
      { status: 500 }
    );
  }
}
