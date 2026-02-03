import { db } from '../lib/firebaseAdmin';

async function check() {
  console.log('Searching for tournament...');
  const snapshot = await db.collection('tournaments')
    .where('name', '>=', 'Campeonato de Tenerife 2026')
    .where('name', '<=', 'Campeonato de Tenerife 2026\uf8ff')
    .get();

  if (snapshot.empty) {
    console.log('No tournament found with that name.');
  } else {
    snapshot.forEach(doc => {
      console.log(`Found doc ID: ${doc.id}`);
      console.log('Data:', JSON.stringify(doc.data(), null, 2));
    });
  }
}

check().catch(console.error);
