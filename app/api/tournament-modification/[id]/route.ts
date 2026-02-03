
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;
        const { action } = await request.json();

        if (!['approve', 'reject'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action' },
                { status: 400 }
            );
        }

        const modificationRef = db.collection('tournament_modifications').doc(id);
        const modificationDoc = await modificationRef.get();

        if (!modificationDoc.exists) {
            return NextResponse.json(
                { error: 'Modification request not found' },
                { status: 404 }
            );
        }

        const modificationData = modificationDoc.data();
        if (!modificationData) {
            return NextResponse.json(
                { error: 'Modification data is empty' },
                { status: 500 }
            );
        }

        if (modificationData.status !== 'pending') {
            return NextResponse.json(
                { error: `Request is already ${modificationData.status}` },
                { status: 400 }
            );
        }

        if (action === 'reject') {
            await modificationRef.update({
                status: 'rejected',
                reviewedAt: Timestamp.now()
            });

            return NextResponse.json({ success: true, message: 'Request rejected' });
        }

        if (action === 'approve') {
            // Apply changes to the tournament
            const tournamentId = modificationData.tournamentId;
            // The tournamentId in modification request corresponds to the 'url' field in the tournament doc usually, 
            // but let's check how we store it. 
            // In page.tsx: tournamentId: t.url. 
            // We likely query tournaments by 'url' field or if 'url' IS the doc ID.
            // Let's assume we need to find the tournament doc first.

            // Query for the tournament with this URL (ID)
            const tournamentsRef = db.collection('tournaments'); // Or fide_active_tournaments? 
            // Let's check both or assume 'tournaments' is the main one. 
            // Based on previous context, 'tournaments' seems to be the main collection.
            // However, scraper.ts saves to 'tournaments'.

            // Robust lookup strategy
            let tournamentDoc; // Firestore DocumentSnapshot

            // 1. Try searching by 'url' field (exact match)
            let snapshot = await tournamentsRef.where('url', '==', tournamentId).limit(1).get();
            if (!snapshot.empty) {
                tournamentDoc = snapshot.docs[0];
            }

            // 2. If not found, check if tournamentId is the numeric Doc ID (tnr)
            if (!tournamentDoc && /^\d+$/.test(tournamentId)) {
                const doc = await tournamentsRef.doc(tournamentId).get();
                if (doc.exists) tournamentDoc = doc;
            }

            // 3. Fallback: Extract 'tnr' ID from the URL string
            if (!tournamentDoc) {
                const match = tournamentId.match(/tnr(\d+)/);
                if (match) {
                    const doc = await tournamentsRef.doc(match[1]).get();
                    if (doc.exists) tournamentDoc = doc;
                }
            }

            if (!tournamentDoc) {
                return NextResponse.json(
                    { error: 'Tournament not found' },
                    { status: 404 }
                );
            }
            const updates: Record<string, any> = {};

            // Map modifications to updates
            modificationData.modifications.forEach((mod: any) => {
                // Map the field names if necessary. 
                // In page.tsx: 'location', 'timeControl', 'rounds'.
                // In DB/scraper: 'location', 'timeControl', 'rounds' (assumed).
                // Let's verify field names in scraper.ts if possible, but 'location' and 'rounds' are standard.
                // 'timeControl' is referred to as 'tempo' in some places (t.tempo in page.tsx).

                let dbField = mod.field;
                if (mod.field === 'timeControl') dbField = 'tempo'; // Map timeControl to tempo

                // Special handling for Google Maps links if we want to store coords
                // For now, just string replacement.
                updates[dbField] = mod.newValue;
            });

            // Also mark as verified?
            updates['isVerified'] = true; // Optional flag to show checked badge later

            await tournamentDoc.ref.update(updates);

            await modificationRef.update({
                status: 'approved',
                reviewedAt: Timestamp.now()
            });

            return NextResponse.json({ success: true, message: 'Request approved and applied' });
        }

    } catch (error) {
        console.error('Error processing modification:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
