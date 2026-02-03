
const { getChessResultsData, getFideProfile } = require('./lib/scraper');

// Mock a profile to trigger calculation
const mockProfile = { name: "Test Player", std: 1765, rapid: 0, blitz: 0, fed: "ESP" };

async function run() {
    console.log("Starting Debug Scraper Execution...");
    // Player ID: 94718750 (Mendez, German)
    try {
        const results = await getChessResultsData("94718750", "Mendez", mockProfile);
        console.log("Done. Results:", JSON.stringify(results, null, 2));
    } catch (e) {
        console.error("Run Error:", e);
    }
}

run();
