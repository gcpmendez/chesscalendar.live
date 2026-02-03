const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkPending() {
    console.log("Checking pending_tournaments collection...");
    try {
        const snapshot = await db.collection("pending_tournaments").get();
        if (snapshot.empty) {
            console.log("No pending tournaments found.");
            return;
        }

        console.log(`Found ${snapshot.size} pending tournaments:`);
        snapshot.forEach((doc: any) => {
            const data = doc.data();
            console.log(`\nID: ${doc.id}`);
            console.log(`Name: ${data.name}`);
            console.log(`Submitted By: ${data.submitterEmail}`);
            console.log(`Created At: ${data.createdAt}`);
            console.log("-------------------");
        });
    } catch (error) {
        console.error("Error fetching pending tournaments:", error);
    }
}
checkPending();
