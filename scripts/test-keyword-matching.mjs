import { db } from './lib/firebaseAdmin.js';

async function test() {
    const city = 'Santa Cruz de Tenerife';
    const keywords = city.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2 && !['del', 'las', 'los', 'san', 'santa'].includes(word));
    console.log('Keywords:', keywords);

    const snapshot = await db.collection('tournaments').where('country', '==', 'ESP').get();
    const tournaments = snapshot.docs.map(doc => doc.data());
    console.log('Total tours in Firestore:', tournaments.length);

    const matches = tournaments.filter(t => {
        const location = (t.location || '').toLowerCase();
        const name = (t.name || '').toLowerCase();
        return keywords.some(keyword => location.includes(keyword) || name.includes(keyword));
    });

    console.log('Matches for Santa Cruz de Tenerife:', matches.length);
    matches.forEach(m => console.log(' -', m.name, '| Location:', m.location));
}
test();
