
const { scrapeTournament } = require('../lib/scraper');
const cheerio = require('cheerio');

// Mock profile
const profile = { std: 0, rapid: 0, blitz: 0, title: '', worldRank: 0, country: '', birthday: 0 };

async function test() {
    const url = "https://s1.chess-results.com/tnr1273804.aspx?lan=2&art=9&snr=6&turdet=YES";
    console.log(`Testing URL: ${url}`);

    // Manual Fetch to Inspect Text
    const CHEERIO_CONFIG = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9', // Mimic Scraper
        }
    };

    try {
        const fetch = (await import('node-fetch')).default;
        // @ts-ignore
        const resHtml = await fetch(url, CHEERIO_CONFIG);
        const html = await resHtml.text();
        const $ = cheerio.load(html);
        const allText = $('body').text();

        // Find "Control de tiempo" index
        const idx = allText.toLowerCase().indexOf('control de tiempo');
        if (idx !== -1) {
            console.log("=== Found 'Control de tiempo' ===");
            console.log(allText.substring(idx, idx + 100));
            console.log("===============================");
        } else {
            const idxRapid = allText.toLowerCase().indexOf('rapid');
            if (idxRapid !== -1) {
                console.log("=== Found 'Rapid' ===");
                console.log(allText.substring(idxRapid, idxRapid + 100));
                console.log("===============================");
            }
        }
    } catch (e) { console.error(e); }

    const res = await scrapeTournament(url, profile);
    if (res) {
        console.log(`Detected Rating Type: ${res.ratingType}`);
    }
}

test();
