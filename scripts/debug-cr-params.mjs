import * as cheerio from 'cheerio';

async function run() {
    try {
        const res = await fetch('https://s3.chess-results.com/TurnierSuche.aspx?lan=2', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);

        console.log('--- Land (Country) Options ---');
        $('select[name*="combo_land"] option').each((i, el) => {
            const val = $(el).val();
            if (val === 'ESP') console.log(val, ':', $(el).text());
        });

        console.log('--- Zeitraum (Period) Options ---');
        $('select[name*="combo_zeitraum"] option').each((i, el) => {
            console.log($(el).val(), ':', $(el).text());
        });

        console.log('--- Sort Options ---');
        $('select[name*="combo_sort"] option').each((i, el) => {
            console.log($(el).val(), ':', $(el).text());
        });

    } catch (e) {
        console.error(e);
    }
}
run();
