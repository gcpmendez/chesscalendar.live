
import { db } from './firebaseAdmin';
import { getFideProfile, getChessResultsData, getFideRatingHistory, getFideRatedTournaments, areTournamentsSame, ScrapedProfile, TournamentChange } from './scraper';

export async function fetchFromDb(id: string) {
    const playerRef = db.collection('players').doc(id);
    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) return null;

    const dbPlayer = playerDoc.data();
    if (!dbPlayer) return null;

    return {
        profile: typeof dbPlayer.profileData === 'string' ? JSON.parse(dbPlayer.profileData) : dbPlayer.profileData,
        history: typeof dbPlayer.historyData === 'string' ? JSON.parse(dbPlayer.historyData) : dbPlayer.historyData,
        tournaments: typeof dbPlayer.tournaments === 'string' ? JSON.parse(dbPlayer.tournaments) : dbPlayer.tournaments,
        lastUpdated: dbPlayer.lastUpdated && dbPlayer.lastUpdated.toDate ? dbPlayer.lastUpdated.toDate() : new Date(dbPlayer.lastUpdated)
    };
}

export async function performFullScrape(id: string, fideProfile: ScrapedProfile) {
    console.time(`Full Scrape ${id}`);

    const [history, ratedTournaments] = await Promise.all([
        getFideRatingHistory(id),
        getFideRatedTournaments(id)
    ]);

    if (history && history.length > 0) {
        const maxHistoryStd = Math.max(...history.map(h => h.rating || 0));
        if (maxHistoryStd > (fideProfile.maxStd || 0)) {
            fideProfile.maxStd = maxHistoryStd;
        }
    }

    const rawTournaments = await getChessResultsData(id, fideProfile.name, fideProfile);

    const filteredTournaments = rawTournaments.filter(t => {
        const isRated = ratedTournaments.some(rt => {
            if (t.ratingType && rt.ratingType && t.ratingType !== rt.ratingType) return false;
            return areTournamentsSame(t.name, rt.name);
        });

        if (isRated) {
            if (t.ratingType === 'rapid' || t.ratingType === 'blitz') return false;
            if (t.isPending) return false;
        }
        return true;
    });

    const now = new Date();
    const activeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    activeStart.setDate(activeStart.getDate() - 1);

    const validTournaments = filteredTournaments.filter(t => {
        if (t.isPending) return true;
        if (!t.lastUpdate) return true;
        const tDate = new Date(t.lastUpdate);
        return tDate >= activeStart;
    });

    console.timeEnd(`Full Scrape ${id}`);

    const playerRef = db.collection('players').doc(id);
    const playerData = {
        fideId: id,
        name: fideProfile.name,
        country: fideProfile.fed,
        stdRating: fideProfile.std || 0,
        rapidRating: fideProfile.rapid || 0,
        blitzRating: fideProfile.blitz || 0,
        profileData: JSON.parse(JSON.stringify(fideProfile)),
        historyData: JSON.parse(JSON.stringify(history)),
        tournaments: JSON.parse(JSON.stringify(validTournaments)),
        lastUpdated: new Date()
    };

    await playerRef.set(playerData, { merge: true });

    return {
        profile: fideProfile,
        history,
        tournaments: validTournaments
    };
}

export async function updatePlayerData(id: string, forceScrape = false) {
    if (!id) throw new Error('ID required');

    const fideProfile = await getFideProfile(id);
    if (!fideProfile) throw new Error('Player not found on FIDE');

    const dbData = await fetchFromDb(id);

    let isStale = false;
    if (dbData) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const ratingsMatch =
            dbData.profile.std === fideProfile.std &&
            dbData.profile.rapid === fideProfile.rapid &&
            dbData.profile.blitz === fideProfile.blitz;

        const isRecent = dbData.lastUpdated > oneHourAgo;

        if (forceScrape || !ratingsMatch || !isRecent) {
            isStale = true;
        }

        if (!isStale) {
            return {
                source: 'cache',
                isStale: false,
                ...dbData
            };
        } else if (!forceScrape) {
            console.log(`[SWR] Serving stale data for ${id}, triggering background update`);
            performFullScrape(id, fideProfile).catch(err => {
                console.error(`[SWR ERROR] Background update failed for ${id}:`, err);
            });

            return {
                source: 'cache',
                isStale: true,
                ...dbData
            };
        }
    }

    const freshData = await performFullScrape(id, fideProfile);
    return {
        source: 'scrape',
        isStale: false,
        ...freshData
    };
}
