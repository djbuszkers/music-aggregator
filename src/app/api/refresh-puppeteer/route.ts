import { NextResponse } from "next/server";
import { scrapeRA } from "@/lib/scrapers/ra";
import { scrapeBoomkat } from "@/lib/scrapers/boomkat";

export const maxDuration = 300;

async function handleRefresh() {
  try {
    console.log("Starting refresh (Puppeteer scrapers)...");

    const results = {
      residentAdvisor: 0,
      boomkat: 0,
      total: 0,
    };

    // Scrape Resident Advisor
    try {
      results.residentAdvisor = await scrapeRA();
    } catch (error) {
      console.error("Error scraping Resident Advisor:", error);
    }

    // Scrape Boomkat
    try {
      results.boomkat = await scrapeBoomkat();
    } catch (error) {
      console.error("Error scraping Boomkat:", error);
    }

    results.total = results.residentAdvisor + results.boomkat;

    return NextResponse.json({
      success: true,
      newReleases: results,
      message: `Added ${results.total} new release(s)`,
    });
  } catch (error) {
    console.error("Error during Puppeteer refresh:", error);
    return NextResponse.json(
      { error: "Failed to refresh releases" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return handleRefresh();
}

export async function POST() {
  return handleRefresh();
}
