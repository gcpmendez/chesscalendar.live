import { getLatestSpainTournaments, getTournamentDetails } from '../lib/scraper';
import { db } from '../lib/firebaseAdmin';

async function syncTournaments() {
    try {
        console.log('Starting sync...');
        const tournaments = await getLatestSpainTournaments();
        console.log(`Found ${tournaments.length} tournaments in Spain listing.`);

        const collection = db.collection('tournaments');
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        for (const t of tournaments) {
            // 1. Generate ID (use URL hash or unique slug)
            const match = t.url.match(/tnr(\d+)/);
            const tournamentId = match ? match[1] : null;

            if (!tournamentId) {
                console.warn(`Skipping tournament with no ID: ${t.url}`);
                continue;
            }

            const docRef = collection.doc(tournamentId);
            const doc = await docRef.get();

            // 0. Filter by end date (if we have it)
            const tEndInitial = t.endDate ? new Date(t.endDate) : null;
            if (tEndInitial && tEndInitial < thirtyDaysAgo) {
                console.log(`Skipping old tournament: ${t.name} (ended ${t.endDate})`);
                continue;
            }

            /*
            if (doc.exists) {
                console.log(`Tournament ${tournamentId} already exists. Skipping details fetch.`);
                continue;
            }
            */

            console.log(`Processing tournament: ${t.name} (${tournamentId}). Fetching details...`);
            const details = await getTournamentDetails(t.url);

            if (details) {
                const finalStartDateStr = details.startDate || '';
                const finalEndDateStr = details.endDate || t.endDate || '';
                const tEndFinal = finalEndDateStr ? new Date(finalEndDateStr) : null;

                if (tEndFinal && !isNaN(tEndFinal.getTime()) && tEndFinal < thirtyDaysAgo) {
                    console.log(`Skipping old tournament after detail fetch: ${t.name} (ended ${finalEndDateStr})`);
                    continue;
                }

                // STRICT LOCATION RULE: Must have a location from "Lugar" field
                let location = details.location;
                if (!location || location === 'N/A') {
                    console.warn(`Skipping tournament with no EXPLICIT location: ${t.name}`);
                    // If it existed, we might want to delete it, but for now we just skip saving/updating it.
                    // To be thorough, let's delete if it exists and has no location
                    if (doc.exists) {
                        console.log(`Deleting existing tournament with no valid location: ${tournamentId}`);
                        await docRef.delete();
                    }
                    continue;
                }

                const payload = {
                    ...t,
                    ...details,
                    location,
                    startDate: finalStartDateStr,
                    endDate: finalEndDateStr,
                    fed: 'ESP',
                    country: 'ESP',
                    updatedAt: new Date()
                };

                await docRef.set(payload);
                console.log(`Saved ${tournamentId} to Firestore. Location: ${location} | Coords: ${details.lat},${details.lng} | Dates: ${finalStartDateStr} to ${finalEndDateStr}`);
            } else {
                console.error(`Failed to scrape details for ${t.url}`);
            }

            // Sleep to be nice
            await new Promise(r => setTimeout(r, 1000));
        }

        // Cleanup: Delete tournaments older than 30 days
        console.log('Cleaning up old tournaments...');
        const snapshot = await collection.get();
        const deletePromises: Promise<any>[] = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const endDateStr = data.endDate || data.end; // handle both schemas
            if (endDateStr) {
                const endDate = new Date(endDateStr);
                if (!isNaN(endDate.getTime()) && endDate < thirtyDaysAgo) {
                    console.log(`Deleting expired tournament: ${doc.id} (${endDateStr})`);
                    deletePromises.push(doc.ref.delete());
                }
            }
        });

        if (deletePromises.length > 0) {
            await Promise.all(deletePromises);
            console.log(`Deleted ${deletePromises.length} old tournaments.`);
        }

        console.log('Sync complete.');
    } catch (error) {
        console.error('Sync failed:', error);
    }
}

syncTournaments();
