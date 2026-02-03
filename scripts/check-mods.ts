import { db } from '../lib/firebaseAdmin';

async function checkMods() {
  console.log('Checking last modifications...');
  const snapshot = await db.collection('tournament_modifications')
    .orderBy('submittedAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('No modifications found.');
  } else {
    const doc = snapshot.docs[0];
    console.log('Last Modification (ID:', doc.id, '):', JSON.stringify(doc.data(), null, 2));
    
    // Check tournament by ID
    const tId = doc.data().tournamentId;
    console.log('Try finding tournament doc by ID:', tId);
    
    // Attempt 1: Direct ID
    const tDoc = await db.collection('tournaments').doc(tId).get();
    if (tDoc.exists) {
        console.log('Found by direct ID:', JSON.stringify(tDoc.data()));
    } else {
        console.log('Not found by direct ID. Checking where(url == tId)...');
        const snap2 = await db.collection('tournaments').where('url', '==', tId).limit(1).get();
        if (!snap2.empty) {
            console.log('Found by URL match:', JSON.stringify(snap2.docs[0].data(), null, 2));
        } else {
            console.log('Not found by URL match either.');
        }
    }
  }
}

checkMods().catch(console.error);
