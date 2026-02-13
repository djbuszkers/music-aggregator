import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid release ID" }, { status: 400 });
    }

    const body = await request.json();
    const isInkyTip = body.is_inky_tip ? 1 : 0;
    const inkyTipNote = body.inky_tip_note ?? null;

    const db = getDb();
    await db.execute({
      sql: `UPDATE releases SET is_inky_tip = ?, inky_tip_note = ? WHERE id = ?`,
      args: [isInkyTip, inkyTipNote, id],
    });

    return NextResponse.json({ success: true, is_inky_tip: isInkyTip, inky_tip_note: inkyTipNote });
  } catch (error) {
    console.error("Error updating inky tip:", error);
    return NextResponse.json({ error: "Failed to update inky tip" }, { status: 500 });
  }
}
