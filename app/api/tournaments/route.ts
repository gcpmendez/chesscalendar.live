import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { backgroundSyncTournaments } from '@/lib/scraper';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || 'ESP';
    const city = (searchParams.get('city') || '').trim();
    const tempo = searchParams.get('tempo') || ''; // 1=Std, 2=Rapid, 3=Blitz

    try {
        // Fetch tournaments for this country
        const snapshot = await db.collection('tournaments')
            .where('country', '==', country)
            .get();

        let tournaments = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Map fields for frontend compatibility
                start: data.startDate || '',
                end: data.endDate || '',
                fed: data.fed || data.country || 'ESP'
            };
        });

        // Filter by Tempo in memory
        if (tempo) {
            const tempoLabel = tempo === '1' ? 'Standard' : tempo === '2' ? 'Rapid' : 'Blitz';
            tournaments = tournaments.filter((t: any) => (t.tempo || t.type) === tempoLabel);
        }

        // City-based filtering using search mapping
        if (city) {
            // Define the same mapping as in scraper
            const CITY_SEARCH_MAPPING: Record<string, string[]> = {
                "Santa Cruz de Tenerife": ["Tenerife", "La Laguna"],
                "Las Palmas": ["Gran Canaria", "Las Palmas"],
                "Madrid": ["Madrid"],
                "Barcelona": ["Barcelona"],
                "Valencia": ["Valencia"],
                "Sevilla": ["Sevilla"],
                "Bilbao": ["Bilbao", "Vizcaya"],
                "Málaga": ["Málaga"],
            };

            const searchTerms = CITY_SEARCH_MAPPING[city] || [city];

            // Extract keywords from all search terms
            const keywords = searchTerms.flatMap(term =>
                term.toLowerCase().split(/\s+/).filter(word => word.length > 2)
            );

            tournaments = tournaments.filter((t: any) => {
                // 1. Prioritize explicit 'city' field from DB (set via Suggest Edit)
                if (t.city) {
                    return t.city === city;
                }

                // 2. Fallback to location/name search
                const location = (t.location || '').toLowerCase();
                const name = (t.name || '').toLowerCase();
                return keywords.some(keyword => location.includes(keyword) || name.includes(keyword));
            });
        }

        // Sort by end date DESC in memory
        tournaments.sort((a: any, b: any) => {
            const dateA = a.end || '0000-00-00';
            const dateB = b.end || '0000-00-00';
            return dateB.localeCompare(dateA);
        });

        // Trigger background sync if a city is searched
        if (city) {
            console.log(`[API] Triggering background sync for ${city}`);
            backgroundSyncTournaments(country, city).catch(err => {
                console.error(`[API] Background sync failed for ${city}:`, err);
            });
        }

        return NextResponse.json(tournaments);

    } catch (error) {
        console.error('Firestore Search error:', error);
        return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
    }
}
