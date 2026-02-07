
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load environment variables manually
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^"|"$/g, ''); // Remove quotes
            process.env[key] = value;
        }
    });
}

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        const serviceAccountPath = path.resolve(__dirname, '../service-account.json');
        if (!fs.existsSync(serviceAccountPath)) {
            console.error('service-account.json not found!');
            process.exit(1);
        }

        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error('Failed to initialize Firebase Admin:', error);
        process.exit(1);
    }
}

const db = admin.firestore();

async function inspectTournament() {
    console.log('Searching for "Lourdes"...');
    const snapshot = await db.collection('tournaments').get();

    let found = null;
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.name && data.name.includes('Lourdes')) {
            found = { id: doc.id, ...data };
        }
    });

    if (!found) {
        console.log('Not found.');
    } else {
        console.log('Found Data:', JSON.stringify(found, null, 2));
    }
}

inspectTournament().catch(console.error);
