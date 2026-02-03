import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        let credential;
        if (process.env.FIREBASE_PRIVATE_KEY) {
            credential = admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            });
        } else {
            // Use fs to avoid Webpack bundling issues with dynamic require
            // This fallback is for local development only
            const serviceAccountPath = process.cwd() + '/service-account.json';
            // We use fs explicit check to prevent crashing if file is missing (e.g. in Vercel if environment vars were also missing)
            // But usually Vercel should have Env Vars.
            const fs = require('fs');
            if (fs.existsSync(serviceAccountPath)) {
                const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                credential = admin.credential.cert(serviceAccount);
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
