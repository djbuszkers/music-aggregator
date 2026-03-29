import { scrapeRA } from "../src/lib/scrapers/ra";
import { scrapeBoomkat } from "../src/lib/scrapers/boomkat";

async function main() {
  console.log("Starting Puppeteer scrapers...");

  let ra = 0;
  let boomkat = 0;

  try {
    ra = await scrapeRA();
  } catch (err) {
    console.error("RA scraper failed:", err);
  }

  try {
    boomkat = await scrapeBoomkat();
  } catch (err) {
    console.error("Boomkat scraper failed:", err);
  }

  console.log(`Done. RA: ${ra}, Boomkat: ${boomkat}, Total: ${ra + boomkat}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
