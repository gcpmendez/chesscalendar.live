
const cheerio = require('cheerio');

async function testSearch(name) {
    const url = 'https://s1.chess-results.com/SpielerSuche.aspx?lan=2';

    // 1. Get Initial State
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const viewState = $('#__VIEWSTATE').val();
    const eventValidation = $('#__EVENTVALIDATION').val();
    const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val();

    let cookies = res.headers.get('set-cookie') || '';

    // 2. Search
    const formData = new URLSearchParams();
    formData.append('ctl00$P1$txt_nachname', name);
    formData.append('ctl00$P1$cb_suchen', 'Search');
    formData.append('__VIEWSTATE', viewState);
    formData.append('__EVENTVALIDATION', eventValidation);
    if (viewStateGenerator) formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);

    const res2 = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookies,
            'User-Agent': 'Mozilla/5.0'
        }
    });

    const html2 = await res2.text();
    const $2 = cheerio.load(html2);

    // Parse table
    const rows = $2('tr');
    console.log(`Rows found: ${rows.length}`);

    const results = [];
    rows.each((i, el) => {
        const text = $2(el).text().trim().replace(/\s+/g, ' ');
        console.log(`Row ${i}: ${text}`);
        const tds = $2(el).find('td');
        if (tds.length > 5) {
            const name = tds.eq(0).text().trim();
            const fideId = tds.eq(2).text().trim();
            const fed = tds.eq(4).text().trim();
            if (name && fideId) {
                results.push({ name, fideId, fed });
            }
        }
    });

    console.log("Results sample:", results.slice(0, 5));
}

testSearch('Carlsen');
