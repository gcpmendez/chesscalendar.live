
const cheerio = require('cheerio');

async function findAndTest() {
    try {
        console.log('Fetching from local API...');
        const res = await fetch('http://localhost:3001/api/tournaments?country=ESP&tempo=1');
        if (!res.ok) throw new Error('API failed');
        const tournaments = await res.json();

        if (tournaments.length === 0) {
            console.error('No tournaments found in API');
            return;
        }

        const tUrl = tournaments[0].url;
        console.log(`Found Tournament URL from API: ${tUrl}`);

        await testScrape(tUrl);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testScrape(url) {
    // Force art=1 for Details
    // Note: url might already have params, but we want to ensure art=1
    const urlObj = new URL(url);
    urlObj.searchParams.set('lan', '2');
    urlObj.searchParams.set('turdet', 'YES');
    urlObj.searchParams.set('art', '1');
    const targetUrl = urlObj.toString();

    console.log(`Testing Details URL: ${targetUrl}`);
    const res = await fetch(targetUrl);
    const html = await res.text();
    const $ = cheerio.load(html);

    console.log('--- General Details (art=1) ---');
    let foundAny = false;
    $('table.CRs1 tr').each((i, tr) => {
        const label = $(tr).find('td').eq(0).text().trim();
        const val = $(tr).find('td').eq(1).text().trim();
        if (label && val) {
            console.log(`  "${label}" -> "${val}"`);
            foundAny = true;
        }
    });

    if (!foundAny) {
        console.log('No CRs1 rows found. Dumping all tables...');
        $('table').each((i, tbl) => {
            console.log(`Table ${i} Class: ${$(tbl).attr('class')}`);
            if (i < 2) {
                // Inspect first few tables
                $(tbl).find('tr').slice(0, 3).each((j, tr) => {
                    console.log(`  Row ${j}: ${$(tr).find('td').map((_, td) => $(td).text().trim()).get().join('|')}`);
                });
            }
        });
    }

    console.log('\n--- Players (art=0) ---');
    urlObj.searchParams.set('art', '0');
    console.log(`Fetching Players URL: ${urlObj.toString()}`);
    const resPlayers = await fetch(urlObj.toString());
    const htmlPlayers = await resPlayers.text();
    const $p = cheerio.load(htmlPlayers);

    // Find player table
    const table = $p('table.CRs1');
    if (table.length > 0) {
        console.log('Found Player Table CRs1');
        table.find('tr').slice(0, 5).each((i, tr) => {
            const tds = $p(tr).find('td');
            const txts = tds.map((_, td) => $p(td).text().trim()).get().join(' | ');
            console.log(`Row ${i}: ${txts}`);
        });
    } else {
        console.log('Player Table CRs1 NOT found. Checking others...');
        $p('table').each((i, tbl) => {
            console.log(`P-Table ${i} Class: ${$p(tbl).attr('class')}`);
        });
    }
}

findAndTest();
