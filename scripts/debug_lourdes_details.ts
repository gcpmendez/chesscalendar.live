
import { db } from '../lib/firebaseAdmin';
import { getTournamentDetails } from '../lib/scraper';

async function main() {
    const id = 'PhcnSQG75UnxtHLrv48P';
    console.log(`Fetching details for tournament ${id}...`);

    try {
        const docRef = db.collection('tournaments').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            console.log('Tournament not found in DB!');
            return;
        }

        const data = doc.data();
        const url = data?.url; // Normalized 'url' or 'website'?
        // Scraper usually saves 'url' as the chess-results link.
        // Let's check 'url' and 'website'.
        const targetUrl = url || data?.website;

        console.log(`Tournament URL: ${targetUrl}`);

        if (!targetUrl) {
            console.log('No URL found!');
            return;
        }

        console.log('Running scraper...');
        const details = await getTournamentDetails(targetUrl);
        console.log('Scraper Result:', JSON.stringify(details, null, 2));

    } catch (error) {
        console.error('Error debugging details:', error);
    }
}

main().catch(console.error);
