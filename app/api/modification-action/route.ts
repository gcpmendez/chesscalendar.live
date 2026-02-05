
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const action = searchParams.get('action');

        if (!id || !action || !['approve', 'reject'].includes(action)) {
            return new NextResponse('Invalid Request: Missing ID or Action', { status: 400 });
        }

        const modificationRef = db.collection('tournament_modifications').doc(id);
        const modificationDoc = await modificationRef.get();

        if (!modificationDoc.exists) {
            return new NextResponse('Request Not Found', { status: 404 });
        }

        const modificationData = modificationDoc.data();
        if (!modificationData) return new NextResponse('Data Error', { status: 500 });

        if (modificationData.status !== 'pending') {
            return new NextResponse(`Response: Request was already ${modificationData.status}`, { status: 200, headers: { 'Content-Type': 'text/html' } });
        }

        if (action === 'reject') {
            await modificationRef.update({
                status: 'rejected',
                reviewedAt: Timestamp.now()
            });

            return new NextResponse(`
                <html>
                    <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #fce7f3;">
                        <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center;">
                            <h1 style="color: #be185d;">Request Rejected</h1>
                            <p>The modification suggestion for <strong>${modificationData.tournamentName}</strong> has been rejected.</p>
                        </div>
                    </body>
                </html>
            `, { headers: { 'Content-Type': 'text/html' } });
        }

        if (action === 'approve') {
            // --- Robust Lookup Logic (Reused) ---
            const tournamentId = modificationData.tournamentId;
            const tournamentsRef = db.collection('tournaments');

            let tournamentDoc;

            // 1. URL match
            let snapshot = await tournamentsRef.where('url', '==', tournamentId).limit(1).get();
            if (!snapshot.empty) {
                tournamentDoc = snapshot.docs[0];
            }

            // 2. Doc ID match (Try generic ID if no URL match)
            if (!tournamentDoc) {
                const doc = await tournamentsRef.doc(tournamentId).get();
                if (doc.exists) {
                    tournamentDoc = doc;
                }
            }

            // 3. Regex match
            if (!tournamentDoc) {
                const match = tournamentId.match(/tnr(\d+)/);
                if (match) {
                    const doc = await tournamentsRef.doc(match[1]).get();
                    if (doc.exists) tournamentDoc = doc;
                }
            }

            if (!tournamentDoc) {
                return new NextResponse('Error: Tournament Not Found in Database. Cannot Apply Changes.', { status: 404 });
            }

            const updates: Record<string, any> = {};
            const modifiedFields: string[] = [];

            // Map modifications
            modificationData.modifications.forEach((mod: any) => {
                let dbField = mod.field;
                if (mod.field === 'timeControl') dbField = 'tempo';
                updates[dbField] = mod.newValue;
                modifiedFields.push(dbField);
            });

            // Mark fields as manually edited
            if (modifiedFields.length > 0) {
                updates['editedFields'] = FieldValue.arrayUnion(...modifiedFields);
            }

            // Mark as verified optionally?
            // updates['isVerified'] = true; 

            await tournamentDoc.ref.update(updates);

            await modificationRef.update({
                status: 'approved',
                reviewedAt: Timestamp.now()
            });

            return new NextResponse(`
                <html>
                    <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #ecfdf5;">
                        <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center;">
                            <h1 style="color: #059669;">Request Approved!</h1>
                            <p>The changes for <strong>${modificationData.tournamentName}</strong> have been successfully applying to the database.</p>
                        </div>
                    </body>
                </html>
            `, { headers: { 'Content-Type': 'text/html' } });
        }

        return new NextResponse('Unknown Action', { status: 400 });

    } catch (error) {
        console.error('Error processing action:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
