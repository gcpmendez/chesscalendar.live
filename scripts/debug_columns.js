
const https = require('https');
const cheerio = require('cheerio');
const fs = require('fs');

async function fetchSearch() {
    // 1. Get ViewState
    console.log('Fetching initial page...');
    const searchUrl = 'https://s2.chess-results.com/TurnierSuche.aspx?lan=2'; // German

    // We'll mimic the scraper's logic to get the form initialized
    let cookies = '';
    const initialHtml = await new Promise((resolve, reject) => {
        https.get(searchUrl, (res) => {
            if (res.headers['set-cookie']) {
                cookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
            }
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        });
    });

    const $ = cheerio.load(initialHtml);
    const formData = new URLSearchParams();
    $('input[type="hidden"]').each((_, el) => {
        const name = $(el).attr('name');
        const val = $(el).val();
        if (name) formData.append(name, val || '');
    });

    formData.set('ctl00$P1$txt_ort', 'Gran Canaria');
    formData.set('ctl00$P1$combo_land', 'ESP');
    formData.set('ctl00$P1$combo_sort', '1'); // Sort by Update
    formData.set('ctl00$P1$cb_suchen', 'Suchen');

    console.log('Posting form with cookies:', cookies);

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookies,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) width some UA'
        }
    };

    const req = https.request(searchUrl, options, (res) => {
        let html = '';
        res.on('data', c => html += c);
        res.on('end', () => {
            const $res = cheerio.load(html);
            // Look for table with class CRg1
            let $table = $res('table').filter((_, t) => $res(t).find('tr.CRg1').length > 0).first();

            if ($table.length === 0) {
                console.log('No table found!');
                // Print body text to see error
                console.log($res('body').text().substring(0, 500));
                return;
            }

            // Print headers
            const headers = [];
            $table.find('tr').first().find('td, th').each((_, el) => {
                headers.push($res(el).text().trim());
            });
            console.log('Headers:', headers);

            // Print first 5 rows
            $table.find('tr.CRg1, tr.CRg2').slice(0, 5).each((i, tr) => {
                const cols = [];
                $res(tr).find('td').each((_, td) => cols.push($res(td).text().trim()));
                console.log(`Row ${i}:`, cols);
            });
        });
    });

    req.write(formData.toString());
    req.end();
}

fetchSearch();
