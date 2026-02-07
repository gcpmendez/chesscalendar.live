
async function testScrape() {
    const url = 'https://s2.chess-results.com/tnr1341982.aspx?lan=2';
    console.log(`Scraping ${url}...`);
    try {
        // Mocking the behavior since we can't easily import the TS file directly in Node without compilation or ts-node.
        // Instead, I'll rely on the 'cheerio' and 'node-fetch' assuming I can rewrite a small snippet here
        // OR I can try to use the existing file if I can compiled it.
        // Actually, let's just write a standalone script duplicating the relevant scraper logic to be sure.

        const cheerio = require('cheerio');
        const iconv = require('iconv-lite');

        const { default: fetch } = await import('node-fetch');

        const response = await fetch(url);
        const buffer = await response.buffer();
        const html = iconv.decode(buffer, 'UTF-8'); // Try UTF-8 first
        const $ = cheerio.load(html);

        // Location
        const locationRow = $("td.CR").filter((i, el) => $(el).text().includes("Localización")).parent();
        const location = locationRow.find("td").last().text().trim();
        const mapLink = locationRow.find("a").attr("href");

        // Regulations
        const regulationsLink = $("a").filter((i, el) => $(el).text().includes("Show tournament regulations")).attr("href");
        const regulationsText = $("a").filter((i, el) => $(el).text().includes("Show tournament regulations")).text().trim();

        // Also check for "Bases" or similar in documents
        // Actually, just standard logic

        console.log('Location:', location);
        console.log('Map Link:', mapLink);
        console.log('Regulations Text:', regulationsText);
        console.log('Regulations Link:', regulationsLink);

    } catch (error) {
        console.error('Error:', error);
    }
}

testScrape();
