
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
            const value = match[2].trim().replace(/^"|"$/g, ''); // Remove quotes if present
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

async function findAndDelete() {
    console.log('Searching for "I Torneo de Ajedrez Blitz Nuestra Señora de Lourdes 2026"...');

    // Search by name (exact or partial)
    const snapshot = await db.collection('tournaments').get();

    let found = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.name && data.name.includes('Lourdes')) {
            found.push({ id: doc.id, name: data.name, url: data.url });
        }
    });

    if (found.length === 0) {
        console.log('No tournament found with "Lourdes" in the name.');
    } else {
        console.log(`Found ${found.length} tournaments:`);
        for (const t of found) {
            console.log(`- ID: ${t.id}`);
            console.log(`  Name: ${t.name}`);
            console.log(`  URL: ${t.url}`);

            // Delete it
            await db.collection('tournaments').doc(t.id).delete();
            console.log(`  => DELETED`);
        }
    }
}

findAndDelete().catch(console.error);
