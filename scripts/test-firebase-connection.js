
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Manual .env parser to avoid 'dotenv' dependency
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    let key = match[1].trim();
                    let value = match[2].trim();
                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    process.env[key] = value;
                }
            });
            console.log('.env file loaded manually.');
        } else {
            console.log('No .env file found.');
        }
    } catch (err) {
        console.error('Error loading .env:', err);
    }
}

loadEnv();

async function testConnection() {
    console.log('--- Testing Firebase Connection ---');
    console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'Set' : 'Missing');
    // console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY); // DEBUG ONLY

    try {
        if (!admin.apps.length) {
            console.log('Initializing Firebase App...');
            let credential;
            if (process.env.FIREBASE_PRIVATE_KEY) {
                console.log('Using Environment Variables for Auth');

                // Construct config
                // Handle newlines in private key manually if needed
                let privateKey = process.env.FIREBASE_PRIVATE_KEY;
                if (privateKey.includes('\\n')) {
                    privateKey = privateKey.replace(/\\n/g, '\n');
                }

                credential = admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey,
                });
            } else {
                console.log('Using fs fallback for Auth');
                const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
                if (fs.existsSync(serviceAccountPath)) {
                    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                    credential = admin.credential.cert(serviceAccount);
                } else {
                    console.log('Service account file NOT found at:', serviceAccountPath);
                }
            }

            if (credential) {
                admin.initializeApp({
                    credential,
                });
                console.log('Firebase App Initialized successfully.');
            } else {
                console.error('Failed to create credential. Neither Env Vars nor File found.');
                return;
            }
        }

        const db = admin.firestore();
        console.log('Attempting to fetch a document from "tournaments"...');
        const snapshot = await db.collection('tournaments').limit(1).get();
        if (snapshot.empty) {
            console.log('Connection successful, but no tournaments found.');
        } else {
            console.log(`Connection successful! Found ${snapshot.size} tournament(s).`);
            console.log('First tournament ID:', snapshot.docs[0].id);
        }

    } catch (error) {
        console.error('CONNECTION FAILED:', error);
    }
}

testConnection();
