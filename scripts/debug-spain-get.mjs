import * as cheerio from 'cheerio';

async function run() {
    try {
        const url = 'https://chess-results.com/TurnierSuche.aspx?lan=2&ct=ESP';
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        const $ = cheerio.load(html);
        const rows = $('.CRs1 tr, .CRs2 tr');
        console.log('--- Row count:', rows.length);
        rows.slice(0, 10).each((i, el) => {
            console.log(i, ':', $(el).text().trim().substring(0, 120));
        });
    } catch (e) {
        console.error(e);
    }
}
run();
