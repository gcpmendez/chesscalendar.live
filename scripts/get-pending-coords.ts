import { db } from '../lib/firebaseAdmin';

async function getPendingUrls() {
    const snapshot = await db.collection('tournaments').get();
    const filtered = snapshot.docs
        .map(doc => ({
            id: doc.id,
            name: doc.data().name,
            mapsUrl: doc.data().mapsUrl,
            lat: doc.data().lat
        }))
        .filter(x => x.mapsUrl && !x.lat);

    console.log(JSON.stringify(filtered, null, 2));
}

getPendingUrls();
