import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    if (!id || !action) {
        return new NextResponse('Missing parameters', { status: 400 });
    }

    try {
        const pendingRef = db.collection('pending_tournaments').doc(id);
        const doc = await pendingRef.get();

        if (!doc.exists) {
            return new NextResponse('<h1>Error: Request not found or already processed.</h1>', {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        const data = doc.data() as any;

        if (action === 'approve') {
            // Remove meta fields
            delete data.status;
            delete data.createdAt;

            // Add to active tournaments
            await db.collection('tournaments').add(data);

            // Delete pending
            await pendingRef.delete();

            return new NextResponse(`<div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #10b981;">✅ Tournament Approved!</h1>
                <p><strong>${data.name}</strong> is now live on the calendar.</p>
                <a href="${process.env.NEXT_PUBLIC_BASE_URL}">Go to Calendar</a>
            </div>`, { headers: { 'Content-Type': 'text/html' } });

        } else if (action === 'reject') {
            await pendingRef.delete();
            return new NextResponse(`<div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #ef4444;">❌ Tournament Rejected</h1>
                <p>The request has been deleted.</p>
            </div>`, { headers: { 'Content-Type': 'text/html' } });
        }

        return new NextResponse('Invalid action', { status: 400 });

    } catch (error: any) {
        console.error('Error processing action:', error);
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}
