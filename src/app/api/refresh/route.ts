import { NextResponse } from "next/server";
import { scrapeNowaMuzyka } from "@/lib/scrapers/nowamuzyka";
import { scrapeBandcamp } from "@/lib/scrapers/bandcamp";
import { scrapeRA } from "@/lib/scrapers/ra";
import { scrapeBoomkat } from "@/lib/scrapers/boomkat";
import { scrapeInvertedAudio } from "@/lib/scrapers/inverted-audio";

export const maxDuration = 300;

async function handleRefresh() {
  try {
    console.log("Starting refresh...");

    const results = {
      nowaMuzyka: 0,
      bandcamp: 0,
      residentAdvisor: 0,
      boomkat: 0,
      invertedAudio: 0,
      total: 0,
    };

    // Scrape Nowa Muzyka
    try {
      results.nowaMuzyka = await scrapeNowaMuzyka();
    } catch (error) {
      console.error("Error scraping Nowa Muzyka:", error);
    }

    // Scrape Bandcamp Daily
    try {
      results.bandcamp = await scrapeBandcamp();
    } catch (error) {
      console.error("Error scraping Bandcamp Daily:", error);
    }

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

    // Scrape Inverted Audio
    try {
      results.invertedAudio = await scrapeInvertedAudio();
    } catch (error) {
      console.error("Error scraping Inverted Audio:", error);
    }

    results.total = results.nowaMuzyka + results.bandcamp + results.residentAdvisor + results.boomkat + results.invertedAudio;

    return NextResponse.json({
      success: true,
      newReleases: results,
      message: `Added ${results.total} new release(s)`,
    });
  } catch (error) {
    console.error("Error during refresh:", error);
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
