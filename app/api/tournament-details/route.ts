
import { NextResponse } from 'next/server';
import { getTournamentDetails } from '@/lib/scraper';
import { db } from '@/lib/firebaseAdmin';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
        // 1. Fetch from DB first to get overrides
        let dbData: any = {};
        const snapshot = await db.collection('tournaments').where('url', '==', url).limit(1).get();
        if (!snapshot.empty) {
            dbData = snapshot.docs[0].data();
        }

        // 2. Scrape live details
        const details = await getTournamentDetails(url);

        if (!details) {
            // If scrape fails but we have DB data, maybe return DB data?
            // But details usually contains schedule which is needed.
            // For now, fail if scrape fails, or return partial DB data?
            // Let's return partial DB data if scrape fails.
            if (Object.keys(dbData).length > 0) {
                return NextResponse.json(dbData);
            }
            return NextResponse.json({ error: 'Failed to fetch details' }, { status: 404 });
        }

        // 3. Merge DB overrides into details
        // Priority: DB > Scrape
        const mergedDetails = {
            ...details,
            ...dbData,
            // Explicitly ensure critical fields are from DB if present
            posterImage: dbData.posterImage || details.posterImage,
            location: dbData.location || details.location,
            lat: dbData.lat ?? details.lat, // check for null/undefined specifically if lat can be 0 (rare)
            lng: dbData.lng ?? details.lng,
            regulations: dbData.regulations || details.regulations,
            timeControl: dbData.timeControl || dbData.tempo || details.timeControl, // tempo is DB field name for timeControl usually
            rounds: dbData.rounds || details.rounds,
        };

        return NextResponse.json(mergedDetails);

    } catch (error) {
        console.error('Error in tournament-details API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
