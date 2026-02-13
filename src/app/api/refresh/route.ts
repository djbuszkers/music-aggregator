import { NextResponse } from "next/server";
import { scrapeNowaMuzyka } from "@/lib/scrapers/nowamuzyka";
import { scrapeBandcamp } from "@/lib/scrapers/bandcamp";
import { scrapeRA } from "@/lib/scrapers/ra";
import { scrapeBoomkat } from "@/lib/scrapers/boomkat";
import { scrapeInvertedAudio } from "@/lib/scrapers/inverted-audio";
import { scrapeShatterTheStandards } from "@/lib/scrapers/shatter-the-standards";
import { getReleasesWithoutSpotify, updateReleaseSpotify, getReleasesWithoutYouTube, updateReleaseYouTube } from "@/lib/db";
import { searchSpotifyAlbum } from "@/lib/spotify";
import { searchVideo } from "@/lib/youtube";

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
      shatterTheStandards: 0,
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

    // Scrape Shatter the Standards
    try {
      results.shatterTheStandards = await scrapeShatterTheStandards();
    } catch (error) {
      console.error("Error scraping Shatter the Standards:", error);
    }

    results.total = results.nowaMuzyka + results.bandcamp + results.residentAdvisor + results.boomkat + results.invertedAudio + results.shatterTheStandards;

    // Match Spotify links for releases missing them
    let spotifyMatched = 0;
    try {
      const noSpotify = await getReleasesWithoutSpotify();
      console.log(`Matching Spotify for ${noSpotify.length} releases...`);
      for (const release of noSpotify) {
        try {
          const match = await searchSpotifyAlbum(release.artist, release.title);
          if (match?.spotifyUrl) {
            await updateReleaseSpotify(release.id, match.spotifyUrl, match.spotifyId);
            spotifyMatched++;
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`Spotify match error for ${release.artist} - ${release.title}:`, error);
        }
      }
      console.log(`Spotify: matched ${spotifyMatched}/${noSpotify.length}`);
    } catch (error) {
      console.error("Error during Spotify matching:", error);
    }

    // Match YouTube links for releases missing them
    let youtubeMatched = 0;
    try {
      const noYouTube = await getReleasesWithoutYouTube();
      console.log(`Matching YouTube for ${noYouTube.length} releases...`);
      for (const release of noYouTube) {
        try {
          const match = await searchVideo(release.artist, release.title);
          if (match?.youtubeUrl) {
            await updateReleaseYouTube(release.id, match.youtubeUrl, match.youtubeId);
            youtubeMatched++;
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`YouTube match error for ${release.artist} - ${release.title}:`, error);
        }
      }
      console.log(`YouTube: matched ${youtubeMatched}/${noYouTube.length}`);
    } catch (error) {
      console.error("Error during YouTube matching:", error);
    }

    return NextResponse.json({
      success: true,
      newReleases: results,
      streaming: { spotifyMatched, youtubeMatched },
      message: `Added ${results.total} new release(s), matched ${spotifyMatched} Spotify + ${youtubeMatched} YouTube`,
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
