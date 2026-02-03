import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(require('../service-account.json')),
        });
    } catch (error) {
        console.error('Firebase admin initialization error', error);
    }
}

export const db = admin.firestore();
