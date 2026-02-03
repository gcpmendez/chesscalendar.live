import { NextRequest, NextResponse } from 'next/server';
import { searchPlayers } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 3) {
        return NextResponse.json({ error: 'Query too short' }, { status: 400 });
    }

    const players = await searchPlayers(query);
    return NextResponse.json(players);
}
