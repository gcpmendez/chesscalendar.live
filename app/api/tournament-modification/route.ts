
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

interface ModificationRequest {
    tournamentId: string;
    tournamentName: string;
    modifications: {
        field: string;
        originalValue: string;
        newValue: string;
    }[];
    submitterEmail?: string;
    notes?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: ModificationRequest = await request.json();

        // Validate required fields
        if (!body.tournamentId || !body.tournamentName || !body.modifications?.length) {
            return NextResponse.json(
                { error: 'Missing required fields: tournamentId, tournamentName, and modifications' },
                { status: 400 }
            );
        }

        // Filter out modifications where original equals new
        const validModifications = body.modifications.filter(
            m => m.originalValue !== m.newValue && m.newValue.trim() !== ''
        );

        if (validModifications.length === 0) {
            return NextResponse.json(
                { error: 'No valid modifications provided' },
                { status: 400 }
            );
        }

        // Prepare modifications for Firestore (store Base64 is okay for small files, but ideal to upload to storage)
        // For now we store as is, but be mindful of Firestore 1MB limit.
        // If Base64 is large, this might fail. But for MVP this is okay or we can truncate in DB and only email.
        // Let's store full data so if we build Admin UI later it works.
        // LIMIT CHECK: If payload > 900KB, maybe warn?

        // Create the document
        const docRef = await db.collection('tournament_modifications').add({
            tournamentId: body.tournamentId,
            tournamentName: body.tournamentName,
            modifications: validModifications,
            submitterEmail: body.submitterEmail || null,
            notes: body.notes || null,
            status: 'pending',
            submittedAt: Timestamp.now(),
            reviewedAt: null
        });

        // --- Send Email Logic ---
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAIL_APP_PASSWORD,
                },
            });

            // Construct Links
            const host = request.headers.get('host') || 'localhost:3000';
            const protocol = host.includes('localhost') ? 'http' : 'https';
            const baseUrl = `${protocol}://${host}`;

            const approveLink = `${baseUrl}/api/modification-action?id=${docRef.id}&action=approve`;
            const rejectLink = `${baseUrl}/api/modification-action?id=${docRef.id}&action=reject`;

            // Prepare attachments
            const attachments: any[] = [];

            // Build HTML Table for modifications
            const rows = validModifications.map(m => {
                let displayValue = m.newValue;

                // Handle Base64 Content for Display
                if (m.newValue.startsWith('data:')) {
                    const isImage = m.newValue.startsWith('data:image');
                    const isPdf = m.newValue.startsWith('data:application/pdf');

                    if (isImage || isPdf) {
                        const ext = isImage ? 'jpg' : 'pdf'; // simplify
                        const filename = `${m.field}_${docRef.id}.${ext}`;

                        attachments.push({
                            filename: filename,
                            path: m.newValue // Nodemailer handles Data URI automatically
                        });

                        displayValue = `<b>[File Attached: ${filename}]</b>`;
                    } else {
                        displayValue = `[Data: ${m.newValue.substring(0, 30)}...]`;
                    }
                }

                return `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><b>${m.field}</b></td>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #666;">${m.originalValue || '<em> Empty </em>'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #000; font-weight: bold;">${displayValue}</td>
                </tr>
            `}).join('');

            const mailOptions = {
                from: process.env.GMAIL_USER,
                to: 'gcpmendez@gmail.com', // Sending TO user
                subject: `Suggestion: ${body.tournamentName}`,
                html: `
                    <h2>New Modification Request</h2>
                    <p><strong>Tournament:</strong> ${body.tournamentName}</p>
                    <p><strong>Submitter:</strong> ${body.submitterEmail || 'Anonymous'}</p>
                    ${body.notes ? `<p><strong>Notes:</strong> ${body.notes}</p>` : ''}
                    
                    <table style="border-collapse: collapse; width: 100%; max-width: 600px; margin: 20px 0;">
                        <tr style="background-color: #f2f2f2;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Field</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Original</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">New</th>
                        </tr>
                        ${rows}
                    </table>

                    <div style="margin-top: 30px;">
                        <a href="${approveLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 15px;">Approve Changes</a>
                        <a href="${rejectLink}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reject</a>
                    </div>
                `,
                attachments: attachments
            };

            if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
                await transporter.sendMail(mailOptions);
                console.log(`[EMAIL] Sent notification to gcpmendez@gmail.com for request ${docRef.id}`);
            } else {
                console.warn('[EMAIL] Skipping email: GMAIL_USER or GMAIL_APP_PASSWORD not set.');
            }

        } catch (emailError) {
            console.error('Failed to send email:', emailError);
        }

        return NextResponse.json({
            success: true,
            id: docRef.id,
            message: 'Modification request submitted successfully'
        });

    } catch (error) {
        console.error('Error submitting modification request:', error);
        return NextResponse.json(
            { error: 'Failed to submit modification request' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'pending';

        const snapshot = await db.collection('tournament_modifications')
            .where('status', '==', status)
            .orderBy('submittedAt', 'desc')
            .limit(50)
            .get();

        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json(requests);

    } catch (error) {
        console.error('Error fetching modification requests:', error);
        return NextResponse.json(
            { error: 'Failed to fetch modification requests' },
            { status: 500 }
        );
    }
}
