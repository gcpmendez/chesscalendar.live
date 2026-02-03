import { db } from '../lib/firebaseAdmin';

async function verify() {
  const url = 'https://chess-results.com/tnr1332686.aspx?lan=2&turdet=YES';
  console.log('Searching for url:', url);
  
  const snapshot = await db.collection('tournaments').where('url', '==', url).get();
  if (snapshot.empty) {
    console.log('Not found by URL.');
  } else {
    snapshot.forEach(doc => {
      console.log('Found doc:', doc.id);
      console.log('Location:', doc.data().location);
      console.log('PosterImage:', doc.data().posterImage ? 'Exists' : 'Null');
    });
  }
}
verify().catch(console.error);
