import { db } from '../lib/firebaseAdmin';

async function verify() {
  const url = 'https://chess-results.com/tnr1332686.aspx?lan=2&turdet=YES';
  const snapshot = await db.collection('tournaments').where('url', '==', url).get();
  if (!snapshot.empty) {
    snapshot.forEach(doc => {
      console.log('Doc:', doc.id);
      const p = doc.data().posterImage;
      if (p) {
        console.log('PosterImage starts with:', p.substring(0, 50));
        console.log('PosterImage length:', p.length);
      } else {
        console.log('PosterImage is null/undefined');
      }
    });
  }
}
verify().catch(console.error);
