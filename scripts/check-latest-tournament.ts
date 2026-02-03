const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkLatest() {
    console.log("Checking latest active tournament...");
    try {
        // We don't have a 'createdAt' in the main collection usually, but the moved doc might have it if we didn't delete it?
        // Actually, the action route deletes 'createdAt'.
        // Let's just list all tournaments and find the one by name "Cpto Tenerife por equipos 2026 - Tercera"

        const snapshot = await db.collection("tournaments")
            .where('name', '>=', 'Cpto Tenerife')
            .where('name', '<=', 'Cpto Tenerife' + '\uf8ff')
            .get();

        if (snapshot.empty) {
            console.log("Tournament not found in 'tournaments' collection.");
            return;
        }

        snapshot.forEach((doc: any) => {
            const data = doc.data();
            console.log(`\nID: ${doc.id}`);
            console.log("Data:", JSON.stringify(data, null, 2));
        });
    } catch (error) {
        console.error("Error fetching tournament:", error);
    }
}

checkLatest();
