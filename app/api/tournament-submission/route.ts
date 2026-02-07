import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, country, city, location, website, startDate, endDate, type, notes, submitterEmail, posterImage, regulations } = body;

        // Basic validation
        if (!name || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Save to Pending Collection
        const pendingRef = await db.collection('pending_tournaments').add({
            ...body,
            createdAt: new Date().toISOString(),
            status: 'pending'
        });

        // Construct Links (Dynamic from headers, like modification route)
        // Note: In Next.js App Router, we might need to handle headers differently if needed, 
        // but let's try to match the working logic.
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        const approveUrl = `${baseUrl}/api/tournament-submission/action?id=${pendingRef.id}&action=approve`;
        const rejectUrl = `${baseUrl}/api/tournament-submission/action?id=${pendingRef.id}&action=reject`;

        // 2. Send Email
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            console.error('Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variables');
            return NextResponse.json({ error: 'Server misconfiguration: Missing Email Credentials' }, { status: 500 });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        // Prepare attachments
        const attachments = [];
        let htmlAttachmentsList = "";

        if (posterImage && posterImage.startsWith('data:')) {
            attachments.push({
                filename: 'poster.jpg',
                path: posterImage
            });
            htmlAttachmentsList += "<li>Poster Image (Attached)</li>";
        }

        if (regulations && regulations.startsWith('data:')) {
            attachments.push({
                filename: 'regulations.pdf',
                path: regulations
            });
            htmlAttachmentsList += "<li>Regulations PDF (Attached)</li>";
        }

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: 'gcpmendez@gmail.com', // Match the working hardcoded email from modification route
            subject: `New Tournament: ${name}`,
            html: `
                <h2>New Tournament Request</h2>
                <p><strong>Submitter:</strong> ${submitterEmail || 'Anonymous'}</p>
                <hr />
                <h3>Tournament Details</h3>
                <ul>
                    <li><strong>Name:</strong> ${name}</li>
                    <li><strong>Start:</strong> ${startDate}</li>
                    <li><strong>End:</strong> ${endDate}</li>
                    <li><strong>Type:</strong> ${type}</li>
                    <li><strong>City/Location:</strong> ${location || 'N/A'}</li>
                    <li><strong>Website:</strong> <a href="${website}">${website || 'N/A'}</a></li>
                    <li><strong>Notes:</strong> ${notes || 'None'}</li>
                </ul>
                ${htmlAttachmentsList ? `<h3>Attachments</h3><ul>${htmlAttachmentsList}</ul>` : ''}
                <hr />
                <h3>Actions</h3>
                <p>Click below to verify and add this tournament to the live calendar:</p>
                <div style="display: flex; gap: 20px;">
                    <a href="${approveUrl}" style="padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">✅ Approve & Add</a>
                    <a href="${rejectUrl}" style="padding: 10px 20px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">❌ Reject</a>
                </div>
            `,
            attachments: attachments
        };

        console.log(`Sending email to ${process.env.GMAIL_USER} for tournament ${name}...`);
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully.");

        return NextResponse.json({ success: true, pendingId: pendingRef.id });
    } catch (error: any) {
        console.error('Error sending submission email:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
