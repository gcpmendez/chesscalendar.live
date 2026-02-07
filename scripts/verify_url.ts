
import { getTournamentDetails } from '../lib/scraper';

async function main() {
    const url = 'https://chess-results.com/tnr1120288.aspx';
    console.log(`Checking URL: ${url}`);

    try {
        const details = await getTournamentDetails(url);
        if (details) {
            console.log('--- DETAILS FOUND ---');
            console.log('Name:', details.name); // Scraper might not return name in getTournamentDetails?
            // getTournamentDetails usually returns details object with fields.
            // But getTournamentDetails scrapes the details page.
            // Does it parse name?
            // Let's check the keys.
            console.log('Keys:', Object.keys(details));
            // Assuming we can infer name or verify it.
            // If getTournamentDetails returns non-null, it's a valid tournament page.
        } else {
            console.log('No details found (scraper returned null).');
        }
    } catch (error) {
        console.error('Error verifying URL:', error);
    }
}

main().catch(console.error);
