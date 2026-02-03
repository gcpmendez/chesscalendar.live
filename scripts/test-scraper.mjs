import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

const CHEERIO_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
};

async function getTournamentSchedule(url) {
    try {
        const urlObj = new URL(url);
        urlObj.searchParams.set('art', '2'); // Schedule
        urlObj.searchParams.set('lan', '2');

        const res = await fetch(urlObj.toString(), CHEERIO_CONFIG);
        if (!res.ok) return new Map();
        const html = await res.text();
        const $ = cheerio.load(html);

        const schedule = new Map();
        $('.CRs1 tr, .CRs2 tr').each((_, el) => {
            const row = $(el);
            const cells = row.find('td');
            if (cells.length >= 3) {
                const roundTxt = cells.eq(0).text().trim();
                const dateTxt = cells.eq(1).text().trim();
                if (/\d/.test(roundTxt) && /\d/.test(dateTxt)) {
                    schedule.set(roundTxt, new Date(dateTxt));
                }
            }
        });
        return schedule;
    } catch {
        return new Map();
    }
}

async function getTournamentDetails(url) {
    try {
        console.log(`Fetching details for ${url}...`);

        // 1. Fetch General Details (art=1)
        const urlObj = new URL(url);
        // Clean params
        urlObj.searchParams.set('lan', '2');
        urlObj.searchParams.set('turdet', 'YES');
        // Force art=1 for general info
        urlObj.searchParams.set('art', '1');

        const res = await fetch(urlObj.toString(), CHEERIO_CONFIG);
        console.log(`Response Status: ${res.status}`);
        if (!res.ok) {
            console.error("Failed to fetch general info");
            return null;
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        // Debug: Dump all tables
        console.log("--- Tables Found ---");
        $('table').each((tIdx, tbl) => {
            console.log(`Table ${tIdx}:`);
            $(tbl).find('tr').slice(0, 3).each((rIdx, row) => {
                const txt = $(row).text().replace(/\s+/g, ' ').trim().substring(0, 100);
                console.log(`  Row ${rIdx}: ${txt}`);
            });
        });
        console.log("--------------------");

        const details = {
            topPlayers: []
        };

        // Populate Schedule
        const scheduleMap = await getTournamentSchedule(url);
        if (scheduleMap.size > 0) {
            details.schedule = Array.from(scheduleMap.entries())
                .map(([round, date]) => ({ round, date: date.toLocaleDateString() }))
                .sort((a, b) => a.round.localeCompare(b.round));
        }

        // Search for Poster Image
        const posterImg = $('img[src*="TournamentImages"]').first();
        if (posterImg.length > 0) {
            let src = posterImg.attr('src');
            if (src) {
                if (!src.startsWith('http')) {
                    const origin = urlObj.origin;
                    src = src.startsWith('/') ? `${origin}${src}` : `${origin}/${src}`;
                }
                details.posterImage = src;
            }
        }

        // Helper to find value by label
        const findValue = (keywords) => {
            let val = null;
            $('td, th').each((_, el) => {
                const txt = $(el).text().trim().toLowerCase();
                if (keywords.some(k => txt.includes(k))) {
                    // Check next sibling (td)
                    const next = $(el).next();
                    if (next.length > 0) {
                        val = next.text().trim();
                        // console.log(`[MATCH] ${keywords[0]} -> ${val}`);
                        return false;
                    }
                }
            });
            return val;
        };

        details.organizer = findValue(['organizer', 'organizador']);
        details.location = findValue(['location', 'lugar']);
        details.avgElo = findValue(['elo average', 'media de elo']);
        details.chiefArbiter = findValue(['chief arbiter', 'árbitro principal']);
        details.timeControl = findValue(['time control', 'control de tiempo', 'ritmo de juego']);
        // Rounds is tricky, might be in a sentence or specific row
        details.rounds = findValue(['rounds', 'rondas']);

        // Regulations
        $('a').each((_, el) => {
            const txt = $(el).text().trim().toLowerCase();
            const href = $(el).attr('href');
            if (href && (txt.includes('regulations') || txt.includes('bases') || txt.includes('convocatoria'))) {
                let fullUrl = href;
                if (!fullUrl.startsWith('http')) {
                    const origin = urlObj.origin;
                    fullUrl = fullUrl.startsWith('/') ? `${origin}${fullUrl}` : `${origin}/${fullUrl}`;
                }
                details.regulations = {
                    text: $(el).text().trim(),
                    url: fullUrl
                };
            }
        });

        return details;

    } catch (e) {
        console.error("Error getting tournament details", e);
        return null;
    }
}

// Run test
const TEST_URL = "https://chess-results.com/tnr835260.aspx";
getTournamentDetails(TEST_URL).then(d => {
    console.log("--- Tournament Details ---");
    console.log(JSON.stringify(d, null, 2));
});
