import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        let credential;
        if (process.env.FIREBASE_PRIVATE_KEY) {
            console.log('[FirebaseAdmin] Initializing using environment variables.');
            credential = admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            });
        } else {
            console.log('[FirebaseAdmin] No environment variables found, attempting local file fallback.');
            const serviceAccountPath = process.cwd() + '/service-account.json';
            const fs = require('fs');
            if (fs.existsSync(serviceAccountPath)) {
                console.log('[FirebaseAdmin] Local service-account.json found.');
                const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                credential = admin.credential.cert(serviceAccount);
            } else {
                console.log('[FirebaseAdmin] Local service-account.json NOT found.');
            }
        }

        if (credential) {
            admin.initializeApp({
                credential,
            });
        } else {
            // Warn but don't crash immediately? Or try default init?
            console.warn('Firebase Admin: No credentials found. Initialization may fail.');
            // Try default (metadata service etc) - unlikely to work locally but worth a shot or just let it fail gracefully later
            if (!admin.apps.length) admin.initializeApp();
        }
    } catch (error) {
        console.error('Firebase admin initialization error', error);
    }
}

export const db = admin.firestore();
