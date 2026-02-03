
import * as cheerio from 'cheerio';
import fs from 'fs';

async function run() {
    const country = 'ESP';
    const city = 'Tenerife';
    const tempo = '1';

    console.log(`Starting debug scrape for ${country} - ${city} - ${tempo}`);

    try {
        // Step 1: Initial GET
        const initialRes = await fetch('https://s2.chess-results.com/TurnierSuche.aspx?lan=2&SNode=S0', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        console.log('Initial GET status:', initialRes.status);
        const cookies = initialRes.headers.get('set-cookie') || '';
        console.log('Cookies:', cookies);

        const initialHtml = await initialRes.text();
        const $init = cheerio.load(initialHtml);

        const viewState = $init('#__VIEWSTATE').val();
        const eventValidation = $init('#__EVENTVALIDATION').val();
        const viewStateGenerator = $init('#__VIEWSTATEGENERATOR').val();
        const lastFocus = $init('#__LASTFOCUS').val();
        const eventTarget = $init('#__EVENTTARGET').val();
        const eventArgument = $init('#__EVENTARGUMENT').val();

        console.log('ViewState length:', viewState?.length);

        // Step 2: POST
        const formData = new URLSearchParams();
        if (viewState) formData.append('__VIEWSTATE', viewState);
        if (eventValidation) formData.append('__EVENTVALIDATION', eventValidation);
        if (viewStateGenerator) formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
        if (lastFocus !== undefined) formData.append('__LASTFOCUS', lastFocus);
        if (eventTarget !== undefined) formData.append('__EVENTTARGET', eventTarget);
        if (eventArgument !== undefined) formData.append('__EVENTARGUMENT', eventArgument);

        formData.append('ctl00$P1$combo_land', country);
        formData.append('ctl00$P1$txt_ort', city);
        formData.append('ctl00$P1$combo_bedenkzeit', tempo);
        formData.append('ctl00$P1$cb_suchen', 'Buscar');

        const searchRes = await fetch('https://s2.chess-results.com/TurnierSuche.aspx?lan=2&SNode=S0', {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Cookie': cookies,
                'Origin': 'https://s2.chess-results.com',
                'Referer': 'https://s2.chess-results.com/TurnierSuche.aspx?lan=2&SNode=S0'
            },
        });

        console.log('Search POST status:', searchRes.status);
        const searchHtml = await searchRes.text();

        fs.writeFileSync('debug_output.html', searchHtml);
        console.log('Wrote debug_output.html');

        const $ = cheerio.load(searchHtml);
        const rows = $('.CRTable tr').length;
        console.log('Found rows:', rows);

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
