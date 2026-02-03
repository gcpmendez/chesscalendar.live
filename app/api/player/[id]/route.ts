
import { NextRequest, NextResponse } from 'next/server';
import { getFideProfile, getChessResultsData, getFideRatingHistory, getFideRatedTournaments, areTournamentsSame } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = params;

    if (!id) {
        return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    try {
        const fideProfilePromise = getFideProfile(id);
        const historyPromise = getFideRatingHistory(id);
        const ratedTournamentsPromise = getFideRatedTournaments(id);

        const [fideProfile, history, ratedTournaments] = await Promise.all([
            fideProfilePromise,
            historyPromise,
            ratedTournamentsPromise
        ]);

        if (!fideProfile) {
            return NextResponse.json({ error: 'Player not found on FIDE' }, { status: 404 });
        }

        const tournaments = await getChessResultsData(id, fideProfile.name, fideProfile);

        const filteredTournaments = tournaments.filter(t => {
            const isRated = ratedTournaments.some(rt => {
                if (t.ratingType && rt.ratingType && t.ratingType !== rt.ratingType) {
                    return false;
                }
                return areTournamentsSame(t.name, rt.name);
            });

            if (isRated) {
                // For Rapid and Blitz, if it's rated, we ALWAYS filter it from live tracking.
                if (t.ratingType === 'rapid' || t.ratingType === 'blitz') {
                    return false;
                }
                if (t.isPending) {
                    return false;
                }
            }
            return true;
        });

        const now = new Date();
        const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const validTournaments = filteredTournaments.filter(t => {
            if (t.isPending) return true;

            if (!t.lastUpdate) return true;
            const tDate = new Date(t.lastUpdate);
            return tDate >= firstOfCurrentMonth;
        });

        let stdChange = 0;
        let rapidChange = 0;
        let blitzChange = 0;

        validTournaments.forEach(t => {
            const type = t.ratingType || 'standard';
            const chg = typeof t.change === 'number' && !isNaN(t.change) ? t.change : 0;
            if (type === 'standard') stdChange += chg;
            if (type === 'rapid') rapidChange += chg;
            if (type === 'blitz') blitzChange += chg;
        });

        stdChange = parseFloat(stdChange.toFixed(2));
        rapidChange = parseFloat(rapidChange.toFixed(2));
        blitzChange = parseFloat(blitzChange.toFixed(2));

        const baseStd = fideProfile.std || 0;
        const baseRapid = fideProfile.rapid || 0;
        const baseBlitz = fideProfile.blitz || 0;

        const liveStd = baseStd > 0 ? parseFloat((baseStd + stdChange).toFixed(2)) : 0;
        const liveRapid = baseRapid > 0 ? parseFloat((baseRapid + rapidChange).toFixed(2)) : 0;
        const liveBlitz = baseBlitz > 0 ? parseFloat((baseBlitz + blitzChange).toFixed(2)) : 0;

        const pendingTournaments = validTournaments.filter(t => t.isPending);
        const nonPending = validTournaments.filter(t => !t.isPending);

        const activeTournaments = nonPending.filter(t => {
            if (t.games && t.games.length > 0) return true;
            if (t.startDate) return new Date(t.startDate) <= now;
            return false;
        });

        const nextTournaments = nonPending.filter(t => !activeTournaments.includes(t));

        return NextResponse.json({
            profile: fideProfile,
            history,
            tournaments: activeTournaments,
            activeTournaments,
            pendingTournaments,
            nextTournaments,
            liveRating: liveStd,
            liveRapid,
            liveBlitz,
            totalChange: stdChange,
            rapidChange,
            blitzChange
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store'
            }
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch player data' }, { status: 500 });
    }
}
