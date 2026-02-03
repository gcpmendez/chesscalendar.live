import * as cheerio from 'cheerio';

async function run() {
    const res = await fetch('https://s3.chess-results.com/TurnierSuche.aspx?lan=2');
    const html = await res.text();
    const $ = cheerio.load(html);
    console.log('--- Zeitraum Options ---');
    $('select[name*="combo_zeitraum"] option').each((i, el) => {
        console.log($(el).val(), ':', $(el).text());
    });
    console.log('--- Sorting Options ---');
    $('select[name*="combo_sort"] option').each((i, el) => {
        console.log($(el).val(), ':', $(el).text());
    });
}
run();
