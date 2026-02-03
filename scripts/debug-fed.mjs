import * as cheerio from 'cheerio';

async function run() {
    try {
        const url = 'https://chess-results.com/fed.aspx?lan=2&fed=ESP';
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
        const html = await res.text();
        const $ = cheerio.load(html);
        const rows = $('.CRs1 tr, .CRs2 tr');
        console.log('--- Row count:', rows.length);
        rows.slice(0, 10).each((i, el) => {
            console.log(i, ':', $(el).text().trim().substring(0, 150));
        });
    } catch (e) {
        console.error(e);
    }
}
run();
