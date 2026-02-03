const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

// Init check to avoid "already exists" error in standard node run (though this is standalone)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function patchTournament() {
    const tournamentId = "IqQAzF4VeQaxp3xfTU0G"; // The ID found in previous step
    console.log(`Patching tournament ${tournamentId}...`);

    try {
        await db.collection("tournaments").doc(tournamentId).update({
            country: "ESP",
            city: "Santa Cruz de Tenerife",
            // Also ensure it has lat/lng if possible, but city/country is critical for list
            // We can guess coords for Santa Cruz roughly or leave blank for now
            // But let's just fix the filters first.
        });
        console.log("Successfully patched country and city.");
    } catch (error) {
        console.error("Error patching tournament:", error);
    }
}

patchTournament();
