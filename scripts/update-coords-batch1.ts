import { db } from '../lib/firebaseAdmin';

const coords = [
    { "id": "1326503", "lat": 39.4585278, "lng": -0.3606954 },
    { "id": "1326511", "lat": 27.9202202, "lng": -15.5474373 },
    { "id": "1327186", "lat": 43.1828396, "lng": -3.9878427 },
    { "id": "1328577", "lat": 42.8370473, "lng": -2.6862474 },
    { "id": "1328892", "lat": 38.0463092, "lng": -1.0018665 },
    { "id": "1330321", "lat": 42.8370473, "lng": -2.6862474 },
    { "id": "1331882", "lat": 41.6474339, "lng": -0.8861451 },
    { "id": "1331885", "lat": 41.6474339, "lng": -0.8861451 },
    { "id": "1335052", "lat": 38.9066099, "lng": 1.4207403 },
    { "id": "1335348", "lat": 37.2248226, "lng": -3.679599 }
];

async function updateCoords() {
    const collection = db.collection('tournaments');
    for (const item of coords) {
        await collection.doc(item.id).update({
            lat: item.lat,
            lng: item.lng,
            updatedAt: new Date()
        });
        console.log(`Updated ${item.id} with coords ${item.lat}, ${item.lng}`);
    }
}

updateCoords();
