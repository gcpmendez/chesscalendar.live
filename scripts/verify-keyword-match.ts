import { db } from '../lib/firebaseAdmin';

async function testKeywordMatch() {
    try {
        const city = "Santa Cruz de Tenerife";

        // Define the same mapping as in API
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

        console.log(`City: "${city}"`);
        console.log(`Search Terms: [${searchTerms.map(t => `"${t}"`).join(', ')}]`);
        console.log(`Keywords extracted: [${keywords.map(k => `"${k}"`).join(', ')}]`);
        console.log('');

        // Fetch all ESP tournaments
        const snapshot = await db.collection('tournaments')
            .where('country', '==', 'ESP')
            .get();

        console.log(`Total ESP tournaments in DB: ${snapshot.size}`);
        console.log('');

        // Filter by keywords
        const matched: any[] = [];
        const unmatched: any[] = [];

        snapshot.docs.forEach((doc: any) => {
            const data = doc.data();
            const location = (data.location || '').toLowerCase();
            const name = (data.name || '').toLowerCase();

            const matches = keywords.some(keyword => location.includes(keyword) || name.includes(keyword));

            if (matches) {
                matched.push({ id: doc.id, name: data.name, location: data.location });
            } else {
                unmatched.push({ id: doc.id, name: data.name, location: data.location });
            }
        });

        console.log(`Matched tournaments: ${matched.length}`);
        matched.slice(0, 10).forEach(t => {
            console.log(`  - ${t.name} (${t.location || 'N/A'})`);
        });

        console.log('');
        console.log(`Unmatched tournaments: ${unmatched.length}`);
        unmatched.slice(0, 5).forEach(t => {
            console.log(`  - ${t.name} (${t.location || 'N/A'})`);
        });

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testKeywordMatch();
