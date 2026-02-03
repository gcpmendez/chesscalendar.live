import { db } from '../lib/firebaseAdmin';

async function verify() {
  const url = 'https://chess-results.com/tnr1332686.aspx?lan=2&turdet=YES';
  const snapshot = await db.collection('tournaments').where('url', '==', url).get();
  if (!snapshot.empty) {
    snapshot.forEach(doc => {
      console.log('Doc:', doc.id);
      const data = doc.data();
      console.log('Lat:', data.lat);
      console.log('Lng:', data.lng);
      console.log('Location:', data.location);
    });
  }
}
verify().catch(console.error);
