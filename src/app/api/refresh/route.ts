import { NextResponse } from "next/server";
import { scrapeNowaMuzyka } from "@/lib/scrapers/nowamuzyka";
import { scrapeBandcamp } from "@/lib/scrapers/bandcamp";
import { scrapeInvertedAudio } from "@/lib/scrapers/inverted-audio";
import { scrapeShatterTheStandards } from "@/lib/scrapers/shatter-the-standards";
import { scrapeDjMag } from "@/lib/scrapers/djmag";
import { scrapeSilentRadio } from "@/lib/scrapers/silent-radio";

export const maxDuration = 300;

async function handleRefresh() {
  try {
    console.log("Starting refresh (RSS/HTML scrapers)...");

    const results = {
      nowaMuzyka: 0,
      bandcamp: 0,
      invertedAudio: 0,
      shatterTheStandards: 0,
      djMag: 0,
      silentRadio: 0,
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

    // Scrape Inverted Audio
    try {
      results.invertedAudio = await scrapeInvertedAudio();
    } catch (error) {
      console.error("Error scraping Inverted Audio:", error);
    }

    // Scrape Shatter the Standards
    try {
      results.shatterTheStandards = await scrapeShatterTheStandards();
    } catch (error) {
      console.error("Error scraping Shatter the Standards:", error);
    }

    // Scrape DJ Mag
    try {
      results.djMag = await scrapeDjMag();
    } catch (error) {
      console.error("Error scraping DJ Mag:", error);
    }

    // Scrape Silent Radio
    try {
      results.silentRadio = await scrapeSilentRadio();
    } catch (error) {
      console.error("Error scraping Silent Radio:", error);
    }

    results.total = results.nowaMuzyka + results.bandcamp + results.invertedAudio + results.shatterTheStandards + results.djMag + results.silentRadio;

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
