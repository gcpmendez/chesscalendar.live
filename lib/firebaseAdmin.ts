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
            credential = admin.credential.cert(require('../service-account.json'));
        }

        admin.initializeApp({
            credential,
        });
    } catch (error) {
        console.error('Firebase admin initialization error', error);
    }
}

export const db = admin.firestore();
