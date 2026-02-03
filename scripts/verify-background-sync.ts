import { searchTournamentsByPlace } from '../lib/scraper';

async function verify() {
    try {
        console.log("--- TEST 1: Tenerife (Active) ---");
        const tenerife = await searchTournamentsByPlace('ESP', 'Tenerife');
        console.log(`Found ${tenerife.length} tournaments.`);
        if (tenerife.length > 0) {
            console.log("Sample:", tenerife[0].name);
        }

        console.log("\n--- TEST 2: La Laguna (Active) ---");
        const laguna = await searchTournamentsByPlace('ESP', 'La Laguna');
        console.log(`Found ${laguna.length} tournaments.`);

        console.log("\n--- TEST 3: Madrid (Very Active) ---");
        const madrid = await searchTournamentsByPlace('ESP', 'Madrid');
        console.log(`Found ${madrid.length} tournaments.`);

        console.log("\nVerification complete.");
    } catch (e) {
        console.error("Verification failed:", e);
    }
}

verify();
