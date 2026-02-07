import * as cheerio from 'cheerio';
import { db } from './firebaseAdmin';
const admin = require('firebase-admin'); // For ServerTimestamp if needed, but db.collection().set() works with new Date()

const CHEERIO_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    },
    cache: 'no-store' as RequestCache // Disable Next.js Data Cache
};

// Simple in-memory cache for FIDE rated tournaments to avoid rate limits and improve performance
const FIDE_RATED_CACHE = new Map<string, { data: { name: string; ratingType: 'standard' | 'rapid' | 'blitz' }[], expiry: number }>();
const FIDE_FETCH_LOCKS = new Map<string, Promise<{ name: string; ratingType: 'standard' | 'rapid' | 'blitz' }[]>>();

export interface ScrapedProfile {
    name: string;
    std: number;
    rapid: number;
    blitz: number;
    fed?: string;
    born?: number;
    sex?: string;
    title?: string;
}

export async function getFideProfile(fideId: string): Promise<ScrapedProfile | null> {
    try {
        const url = `https://ratings.fide.com/profile/${fideId}`;
        const res = await fetch(url, CHEERIO_CONFIG);
        if (!res.ok) return null;

        const html = await res.text();
        const $ = cheerio.load(html);

        // Name handling
        const name = $('.profile-top-title').text().trim() || $('head title').text().replace(' FIDE Profile', '').trim();

        // Robust Regex Parsing for Ratings
        const text = $('body').text();
        // Regex matches "Std Rating 2083" or "2083 Standard"
        // We match both "Label Value" and "Value Label" patterns
        const matchStd = text.match(/Std\.?\s*Rating\s*[:\.]?\s*(\d{4})/i) ||
            text.match(/Standard\s*Rating\s*[:\.]?\s*(\d{4})/i) ||
            text.match(/(\d{4})\s*Std/i) ||
            text.match(/(\d{4})\s*Standard/i);

        const matchRapid = text.match(/Rapid\s*Rating\s*[:\.]?\s*(\d{4})/i) ||
            text.match(/(\d{4})\s*Rapid/i);

        const matchBlitz = text.match(/Blitz\s*Rating\s*[:\.]?\s*(\d{4})/i) ||
            text.match(/(\d{4})\s*Blitz/i);

        let std = matchStd ? parseInt(matchStd[1], 10) : 0;
        let rapid = matchRapid ? parseInt(matchRapid[1], 10) : 0;
        let blitz = matchBlitz ? parseInt(matchBlitz[1], 10) : 0;

        // Fallback to DOM scan if Regex fails
        if (!std) {
            $('.profile-top-rating-data').each((_, el) => {
                const content = $(el).text().trim();
                const valStr = $(el).find('.profile-top-rating-val').text().trim();
                const val = parseInt(valStr, 10);

                if (!isNaN(val)) {
                    if (content.toLowerCase().includes('std') || content.toLowerCase().includes('standard')) std = val;
                    if (content.toLowerCase().includes('rapid')) rapid = val;
                    if (content.toLowerCase().includes('blitz')) blitz = val;
                }
            });
        }

        // Detailed Profile Data
        const fed = $('.profile-info-country').text().trim();
        const bornStr = $('.profile-info-byear').text().trim();
        const born = bornStr ? parseInt(bornStr, 10) : undefined;
        const sex = $('.profile-info-sex').text().trim();
        const title = $('.profile-info-title p').first().text().trim() || $('.profile-info-title').text().trim(); // sometimes generic title

        console.log(`[FIDE DEBUG] Name: ${name}, Fed: ${fed}, Born: ${born}, Sex: ${sex}, Title: ${title}`);

        return {
            name,
            std,
            rapid,
            blitz,
            fed,
            born: isNaN(born!) ? undefined : born,
            sex,
            title: title === 'None' ? undefined : title
        };

    } catch (e) {
        console.error("FIDE Scraper Error:", e);
        return null;
    }
}

export async function getFideRatingHistory(fideId: string): Promise<{ date: string, rating: number | null, rapid: number | null, blitz: number | null }[]> {
    try {
        const url = `https://ratings.fide.com/a_chart_data.phtml?event=${fideId}&period=0`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                ...CHEERIO_CONFIG.headers,
                'Referer': `https://ratings.fide.com/profile/${fideId}/chart`,
                'Origin': 'https://ratings.fide.com',
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded' // Often expected for POST even if empty body
            }
        });

        if (!res.ok) return [];

        const text = await res.text();
        if (!text || text.trim().length === 0) return [];

        try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
                return data.map((item: any) => {
                    const std = parseInt(item.rating || '0', 10);
                    const rapid = parseInt(item.rapid_rtng || '0', 10);
                    const blitz = parseInt(item.blitz_rtng || '0', 10);

                    return {
                        date: item.date_2 || '',
                        rating: std > 0 ? std : null,
                        rapid: rapid > 0 ? rapid : null,
                        blitz: blitz > 0 ? blitz : null
                    };
                }).filter(item => item.rating !== null || item.rapid !== null || item.blitz !== null);
            }
        } catch (jsonErr) {
            console.error(`[FIDE-HISTORY] JSON Parse Error:`, jsonErr);
        }

        return [];
    } catch (e) {
        console.error("FIDE History Error:", e);
        return [];
    }
}


export interface GameResult {
    round: string;
    opponentName: string;
    opponentRating: number | null;
    result: string;
    change: number;
}

export interface TournamentChange {
    name: string;
    change: number;
    kFactor: number;
    dateStr?: string;
    startDate?: Date;
    endDate?: Date;
    url: string;
    lastUpdate?: string;
    games?: GameResult[];
    ratingType?: 'standard' | 'rapid' | 'blitz';
    isPending?: boolean;
    rounds?: string;
}

export interface FideCalculation {
    event: string;
    date: string;
    ratingChange: number;
}

export async function getFideCalculations(fideId: string, period: string): Promise<FideCalculation[]> {
    try {
        // period format: YYYY-MM-DD (usually first of month)
        const url = `https://ratings.fide.com/calculations.phtml?id_number=${fideId}&period=${period}&rating=0`;
        const res = await fetch(url, CHEERIO_CONFIG);
        if (!res.ok) return [];

        const html = await res.text();
        const $ = cheerio.load(html);

        // Find table by header content
        let targetTable: cheerio.Element | null = null;
        $('table').each((i, table) => {
            const text = $(table).text().toLowerCase();
            if (text.includes('event') && text.includes('code') && text.includes('rc')) {
                targetTable = table;
                return false; // break
            }
        });

        const list: FideCalculation[] = [];
        if (targetTable) {
            $(targetTable).find('tr').slice(1).each((j, tr) => {
                const cells = $(tr).find('td');
                if (cells.length >= 2) {
                    // Columns might vary, usually: Code | Event | ... | RC
                    // But based on observation or standard:
                    // Let's assume Name is in 2nd column (index 1) usually? Or check headers?
                    // Let's try to be robust. 
                    // Typically: 
                    // Col 0: Code?, Col 1: Event Name, Col 2: ...

                    // We need to parse headers to be sure, but let's try strict text search for now or just grab index 1
                    const eventName = cells.eq(1).text().trim();
                    if (eventName) {
                        list.push({ event: eventName, date: '', ratingChange: 0 });
                    }
                }
            });
        }
        return list;

    } catch (e) {
        console.error("FIDE Calculations Error:", e);
        return [];
    }
}

export interface PlayerInfo {
    name: string;
    fideId: string;
    fed: string;
    title?: string;
}

export async function searchPlayers(query: string): Promise<PlayerInfo[]> {
    try {
        const searchUrl = 'https://s1.chess-results.com/SpielerSuche.aspx?lan=2';
        // We will need to fetch state once, or maybe for each request if we want to be safe?
        // Fetching once is usually fine if we don't submit sequentially in the same session,
        // but here we might do parallel independent requests.
        // Let's create a helper to perform a single search given specific criteria.

        const performSearch = async (lastName: string, firstName?: string): Promise<PlayerInfo[]> => {
            const currentState = await fetchInitialState(searchUrl);
            if (!currentState) return [];

            const { viewState, eventValidation, viewStateGenerator, cookies, $ } = currentState;
            const formData = new URLSearchParams();

            // 1. Populate all inputs (hidden + others)
            $('input').each((_: any, el: any) => {
                const n = $(el).attr('name');
                const v = $(el).val();
                if (n && v !== undefined && v !== null && $(el).attr('type') !== 'submit' && $(el).attr('type') !== 'image') {
                    formData.append(n, v as string);
                }
            });

            formData.set('ctl00$P1$txt_nachname', lastName || '');
            formData.set('ctl00$P1$txt_vorname', firstName || '');

            // 3. Find correct submit button
            let submitName = 'ctl00$P1$cb_search';
            let submitValue = 'Search';
            let found = false;

            $('input[type="submit"]').each((_: any, el: any) => {
                const n = $(el).attr('name');
                const v = $(el).val() as string;
                if (n && (n.includes('suchen') || n.includes('search'))) {
                    submitName = n;
                    submitValue = v;
                    found = true;
                }
            });

            if (!found) submitName = 'ctl00$P1$cb_suchen'; // Fallback
            formData.append(submitName, submitValue);

            console.log(`[PLAYER-SEARCH] Submitting L="${lastName}" F="${firstName}"`);

            const res = await fetch(searchUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    ...CHEERIO_CONFIG.headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookies,
                    'Origin': 'https://s1.chess-results.com',
                    'Referer': searchUrl
                }
            });

            const html = await res.text();
            const $2 = cheerio.load(html);
            const list: PlayerInfo[] = [];
            const seenIds = new Set<string>();

            $2('tr').each((i, el) => {
                const tds = $2(el).find('td');
                if (tds.length > 4) {
                    const name = tds.eq(0).text().trim();
                    const fideId = tds.eq(2).text().trim();
                    const fed = tds.eq(4).text().trim();
                    if (name && fideId && /^\d+$/.test(fideId)) {
                        if (!seenIds.has(fideId)) {
                            list.push({ name, fideId, fed });
                            seenIds.add(fideId);
                        }
                    }
                }
            });

            console.log(`[PLAYER-SEARCH] Performed search L="${lastName}" F="${firstName}". Found ${list.length} items.`);
            return list;
        };

        // Parse Logic
        let lastName = query;
        let firstName = '';

        // Remove trailing comma from the raw query if it exists at the very end
        if (query.endsWith(',')) {
            query = query.slice(0, -1).trim();
            lastName = query;
        }

        if (query.includes(',')) {
            const parts = query.split(',');
            lastName = parts[0].trim();
            firstName = parts.length > 1 ? parts[1].trim() : '';

            // If Last Name is empty (e.g. ", German"), use wildcard
            if (!lastName) lastName = '%';

            return await performSearch(lastName, firstName);
        } else {
            // Ambiguous: Could be First Name or Last Name
            // Search both in parallel. 
            // Note: When searching by First Name, we must use '%' for Last Name to match anyone.
            const [resultsLast, resultsFirst] = await Promise.all([
                performSearch(query, ''),      // L=Query, F=""
                performSearch('%', query)      // L="%", F=Query
            ]);

            console.log(`[PLAYER-SEARCH] Merging: Last=${resultsLast.length}, First=${resultsFirst.length}`);

            // Merge results, prioritizing Last Name matches?
            // Deduplicate by FIDE ID
            const map = new Map<string, PlayerInfo>();

            // Add Last Name matches first
            resultsLast.forEach(p => map.set(p.fideId, p));

            // Add First Name matches (if not exists)
            resultsFirst.forEach(p => {
                if (!map.has(p.fideId)) {
                    map.set(p.fideId, p);
                }
            });

            // Fallback: If we have few results, maybe the user typed "First Last" (e.g. "German Paz Mendez")
            if (map.size < 5 && query.includes(' ')) {
                console.log("[PLAYER-SEARCH] Trying heuristic 'First Last' split...");
                const parts = query.split(/\s+/);
                if (parts.length >= 2) {
                    // Heuristic 1: First word is First Name, rest is Last Name (e.g. "German Paz Mendez")
                    const f1 = parts[0];
                    const l1 = parts.slice(1).join(' ');

                    // Heuristic 2: Last word is Last Name, rest is First Name (e.g. "German Christopher Paz")
                    // Less common for Spanish names which have 2 last names, but standard for English
                    // Let's try Heuristic 1 primarily as it fits "German Paz Mendez"

                    const heuristicResults = await performSearch(l1, f1);
                    console.log(`[PLAYER-SEARCH] Heuristic 'F=${f1}, L=${l1}' found ${heuristicResults.length} items.`);

                    heuristicResults.forEach(p => {
                        if (!map.has(p.fideId)) map.set(p.fideId, p);
                    });
                }
            }

            return Array.from(map.values()).slice(0, 100);
        }

    } catch (e) {
        console.error("Player Search Error:", e);
        return [];
    }
}



export async function getChessResultsData(fideId: string, playerName?: string, profile?: ScrapedProfile): Promise<TournamentChange[]> {
    try {
        // User requested s1 and lan=2
        const searchUrl = 'https://s1.chess-results.com/SpielerSuche.aspx?lan=2'; // 2=English
        let currentState = await fetchInitialState(searchUrl);
        if (!currentState) return [];

        console.log(`[CHESS-RESULTS] Searching by ID: ${fideId} on ${searchUrl}`);
        // 1. Try Search by FIDE ID
        let tournamentInfos = await executeSearch(searchUrl, currentState, { fideId });

        // 2. Fallback: Search by Name
        if (tournamentInfos.length === 0 && playerName) {
            console.log(`[CHESS-RESULTS] ID search failed. searching by name: ${playerName}`);
            currentState = await fetchInitialState(searchUrl) || currentState;

            const parts = playerName.split(',');
            if (parts.length >= 1) {
                const lastName = parts[0].trim();
                const firstName = parts.length > 1 ? parts[1].trim() : undefined;
                tournamentInfos = await executeSearch(searchUrl, currentState, { lastName, firstName });
            }
        }

        console.log(`Found ${tournamentInfos.length} tournaments.`);
        const changes: TournamentChange[] = [];

        // Debug: Log found tournaments and dates
        tournamentInfos.forEach((t, i) => {
            if (i < 5) console.log(`[DEBUG] Tournament: ${t.name}, Date: ${t.endDate}, URL: ${t.url}`);
        });

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Determine Previous Month for Pending Check
        // If today is Jan 2026, prev is Dec 2025.
        // FIDE period string: YYYY-MM-DD (e.g. 2025-12-01)
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthStr = `${prevMonthDate.getFullYear()}-${(prevMonthDate.getMonth() + 1).toString().padStart(2, '0')}-01`;

        console.log(`[PENDING] Checking for pending tournaments for period: ${prevMonthStr}`);

        // Fetch FIDE Rated Tournaments for both current and previous month to be exhaustive
        const [ratedPrev, ratedCurrent] = await Promise.all([
            getFideRatedTournaments(fideId, prevMonthDate),
            getFideRatedTournaments(fideId, now)
        ]);
        const ratedCalculations = [...ratedPrev, ...ratedCurrent];

        const activeTournaments = tournamentInfos.filter(t => {
            if (!t.endDate) return false;
            const d = new Date(t.endDate);

            // Case 1: Active (Current Month or later)
            if (d >= firstOfCurrentMonth) return true;

            // Case 2: Pending (Previous Month AND Not Rated)
            const isPrevMonth = d >= prevMonthDate && d < firstOfCurrentMonth;

            if (isPrevMonth) {
                // Using areTournamentsSame for robust matching against truncated Chess-Results names
                const isRated = ratedCalculations.some(rt => areTournamentsSame(t.name, rt.name));
                if (!isRated) {
                    console.log(`[PENDING] Found potential pending tournament: ${t.name}`);
                    return true;
                }
            }

            return false;
        });

        console.log(`Active/Pending Tournaments: ${activeTournaments.length}`);

        // Limit concurrency? 
        const promises = activeTournaments.slice(0, 10).map(async (info) => {
            // Determine filter date based on tournament end date
            // If it ends in previous month, we want games from previous month.
            // If it ends in current or future, we typically want games from current month (unless it's a very long tournament?)
            // For now:
            // - Ends < Current Month Start -> Filter from Previous Month Start
            // - Ends >= Current Month Start -> Filter from Current Month Start (Standard Live Rating logic)

            let minDateObj: Date | undefined = undefined;
            const tEnd = info.endDate ? new Date(info.endDate) : new Date();

            if (tEnd < firstOfCurrentMonth) {
                // Pending Tournament Candidate
                minDateObj = prevMonthDate;
            } else {
                // Active Tournament
                minDateObj = firstOfCurrentMonth;
            }

            const result = await scrapeTournament(info.url, profile, minDateObj);

            if (result) {
                const d = result.endDate || tEnd;
                // Mark as pending if from previous month and NOT in rated list
                if (d >= prevMonthDate && d < firstOfCurrentMonth) {
                    const tName = result.name.toLowerCase();
                    // Check if already rated (fuzzy match)
                    const isRated = ratedCalculations.some(rated => {
                        const rName = rated.name.toLowerCase(); // Updated from event.toLowerCase()
                        return areTournamentsSame(tName, rName); // Use robust matching
                    });

                    if (!isRated) {
                        result.isPending = true;
                    }
                }
            }
            return result;
        });

        const results = await Promise.all(promises);
        return results.filter((r): r is TournamentChange => r !== null);

    } catch (e) {
        console.error("Chess-Results Scrape Error:", e);
        return [];
    }
}

// Helper: Fetch Initial State
async function fetchInitialState(url: string) {
    try {
        const res = await fetch(url, CHEERIO_CONFIG);
        const html = await res.text();
        const $ = cheerio.load(html);

        let cookies = '';
        if ((res.headers as any).getSetCookie) {
            cookies = (res.headers as any).getSetCookie().join('; ');
        } else {
            cookies = res.headers.get('set-cookie') || '';
        }

        return {
            viewState: $('#__VIEWSTATE').val() as string,
            eventValidation: $('#__EVENTVALIDATION').val() as string,
            viewStateGenerator: $('#__VIEWSTATEGENERATOR').val() as string,
            cookies,
            $
        };
    } catch (e) {
        console.error("Error fetching initial state", e);
        return null;
    }
}

interface SearchInfo {
    url: string;
    name: string;
    endDate?: string;
    tempo?: 'Standard' | 'Rapid' | 'Blitz';
}

// Helper: Execute Search
async function executeSearch(url: string, state: any, criteria: { fideId?: string, lastName?: string, firstName?: string }): Promise<SearchInfo[]> {
    const { viewState, eventValidation, viewStateGenerator, cookies, $ } = state;
    const formData = new URLSearchParams();

    // Populate all inputs found in the form as a baseline
    $('input').each((_: any, el: any) => {
        const name = $(el).attr('name');
        const type = $(el).attr('type');
        const value = $(el).val();

        if (!name) return;

        // Skip image buttons
        if (type === 'image') return;

        // Skip submit buttons (we will add the specific one we want later)
        if (type === 'submit') return;

        // For checkboxes, only include if checked
        if (type === 'checkbox') {
            if ($(el).is(':checked')) {
                formData.append(name, value || 'on');
            }
            return;
        }

        // Include all others (hidden, text)
        if (value !== undefined && value !== null) {
            formData.append(name, value as string);
        }
    });

    // Determine Submit Button (if multiple, we usually need to pick one)
    let submitName = 'ctl00$P1$cb_search';
    let submitValue = 'Search'; // Default
    let foundSubmit = false;

    $('input[type="submit"]').each((_: any, el: any) => {
        const n = $(el).attr('name') || '';
        const v = ($(el).val() as string) || '';
        if (n.includes('cb_suchen') || v.toLowerCase().includes('search')) {
            submitName = n;
            submitValue = v;
            foundSubmit = true;
        }
    });
    // Fallback if not found
    if (!foundSubmit) submitName = 'ctl00$P1$cb_suchen';

    // IMPORTANT: use the captured value (e.g. "Buscar")
    formData.append(submitName, submitValue);

    // Now Set Search Criteria (Override specific fields)
    if (criteria.fideId) {
        formData.set('ctl00$P1$txt_fideID', criteria.fideId);
        formData.delete('ctl00$P1$txt_nachname');
        formData.delete('ctl00$P1$txt_vorname');
    } else if (criteria.lastName) {
        formData.set('ctl00$P1$txt_nachname', criteria.lastName);
        if (criteria.firstName) formData.set('ctl00$P1$txt_vorname', criteria.firstName);
        formData.delete('ctl00$P1$txt_fideID');
    }

    // Ensure critical ASP.NET fields are present
    if (viewState && !formData.has('__VIEWSTATE')) formData.set('__VIEWSTATE', viewState);
    if (eventValidation && !formData.has('__EVENTVALIDATION')) formData.set('__EVENTVALIDATION', eventValidation);
    if (viewStateGenerator && !formData.has('__VIEWSTATEGENERATOR')) formData.set('__VIEWSTATEGENERATOR', viewStateGenerator);

    try {
        console.log(`[DEBUG] Executing search with criteria:`, criteria);
        console.log(`[DEBUG] Submit Button: ${submitName}="${submitValue}"`);

        const res = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                ...CHEERIO_CONFIG.headers,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies,
                'Origin': 'https://s1.chess-results.com',
                'Referer': url
            }
        });

        const html = await res.text();
        const $search = cheerio.load(html);
        const results: SearchInfo[] = [];
        const processedRows = new Set<string>(); // Use text content or index? Index might be safer if we can get it.
        const processedUrls = new Set<string>();

        console.log(`[DEBUG] Response Length: ${html.length}`);

        // Iterate any anchor that looks like a tournament result
        $search('a[href]').each((_: any, el: any) => {
            const link = $search(el).attr('href') || '';
            if (!link.includes('tnr') && !link.includes('SpielerInfo')) return;

            const tr = $search(el).closest('tr');
            if (tr.length === 0) return;

            // Generate a signature for the row to avoid duplicates (Name + Tnr?)
            const rowText = tr.text().trim();
            if (processedRows.has(rowText)) return;
            processedRows.add(rowText);

            const tds = tr.find('td');

            // Columns (Corrected):
            // 0: Name
            // 1: Rating?
            // 2: ID
            // 4: FED
            // 5: Tournament
            // 6: End Date (YYYY/MM/DD)

            let name = '';
            let tournamentName = '';
            let dateStrRaw = '';

            if (tds.length >= 7) {
                name = tds.eq(0).text().trim();
                tournamentName = tds.eq(5).text().trim();
                dateStrRaw = tds.eq(6).text().trim();
            }

            // Determine correct URL
            let bestLink = '';
            tr.find('a').each((__: any, aEl: any) => {
                const h = $search(aEl).attr('href');
                if (h && (h.includes('tnr'))) {
                    // Prefer link with art=9 (Player Info) or just take the tournament link
                    if (!bestLink) bestLink = h;
                    if (h.includes('art=9')) bestLink = h;
                }
            });

            if (!bestLink) bestLink = link;

            // Date Parsing
            let endDateFormatted = '';

            // Try YYYY/MM/DD first
            const ymd = dateStrRaw.match(/^(\d{4})[./-](\d{2})[./-](\d{2})$/);
            if (ymd) {
                const year = ymd[1];
                const month = ymd[2];
                const day = ymd[3];
                endDateFormatted = `${year}-${month}-${day}`;
            } else {
                // Fallback to dd.mm.yyyy or dd/mm/yy
                const dmy = dateStrRaw.match(/^(\d{2})[./-](\d{2})[./-](\d{2,4})$/);
                if (dmy) {
                    let day = parseInt(dmy[1], 10);
                    let month = parseInt(dmy[2], 10);
                    let year = parseInt(dmy[3], 10);
                    if (year < 100) year += 2000;
                    endDateFormatted = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                }
            }

            if (!processedUrls.has(bestLink)) {
                const fullUrl = bestLink.startsWith('http') ? bestLink : `https://s1.chess-results.com/${bestLink}`;
                const urlObj = new URL(fullUrl);
                urlObj.searchParams.set('lan', '2');
                urlObj.searchParams.set('turdet', 'YES'); // show details

                results.push({
                    name: tournamentName || name,
                    url: urlObj.toString(),
                    endDate: endDateFormatted
                });
                processedUrls.add(bestLink);
            }
        });

        return results;

    } catch (e) {
        console.error("Search execution error", e);
        return [];
    }
}

// Helper: Get Tournament Participants Map (Name -> FideID)
async function getTournamentParticipants(tUrl: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
        let listUrl = tUrl;

        // 1. Try to discover the "Alphabetical list" link dynamically
        console.log(`[PARTICIPANTS] Discovering list URL from: ${tUrl}`);
        const menuRes = await fetch(tUrl, CHEERIO_CONFIG);
        const menuHtml = await menuRes.text();
        const $m = cheerio.load(menuHtml);

        let foundLink: string | undefined;

        // Search for specific link text
        $m('a').each((_, el) => {
            if (foundLink) return;
            const txt = $m(el).text().trim().toLowerCase();
            // Match "Alphabetical list" variants
            if (txt.includes('alfabético de jugadores') ||
                txt.includes('alphabetical list of players') ||
                txt.includes('alphabetische liste') ||
                (txt.includes('list') && txt.includes('players') && !txt.includes('ranking'))) {
                foundLink = $m(el).attr('href');
            }
        });

        if (foundLink) {
            // Handle relative URLs
            if (!foundLink.startsWith('http')) {
                // handle both absolute path /tnr... and relative tnr...
                const baseUrl = 'https://chess-results.com/';
                if (foundLink.startsWith('/')) {
                    listUrl = `https://chess-results.com${foundLink}`;
                } else {
                    listUrl = `https://chess-results.com/${foundLink}`;
                }
            } else {
                listUrl = foundLink;
            }
            // console.log(`[PARTICIPANTS] Found List URL: ${listUrl}`);
        } else {
            console.warn(`[PARTICIPANTS] Could not find dynamic link. Fallback to art=0.`);
            if (listUrl.includes('art=')) {
                listUrl = listUrl.replace(/art=\d+/, 'art=0');
            } else {
                listUrl += '&art=0';
            }
        }

        // CRITICAL: Remove 'snr' parameter if present, as it forces Player Info view overriding art=0
        listUrl = listUrl.replace(/&snr=\d+/, '').replace(/\?snr=\d+&/, '?');

        // Add &zeilen=99999 to ensure we get all participants
        if (!listUrl.includes('zeilen=')) {
            listUrl += '&zeilen=99999';
        }

        // console.log(`[PARTICIPANTS] Fetching Participants from: ${listUrl}`);

        const res = await fetch(listUrl, CHEERIO_CONFIG);
        const html = await res.text();
        const $ = cheerio.load(html);

        // Find relevant table
        // Try standard content tables
        const tables = $('table');
        console.log(`[DEBUG-TABLE] Found ${tables.length} tables.`);

        tables.each((_, tbl) => {
            const rows = $(tbl).find('tr');
            if (rows.length === 0) return;

            console.log(`[DEBUG-TABLE] Processing table with ${rows.length} rows.`);

            // Check headers
            let nameIdx = -1;
            let idIdx = -1;

            const headers = rows.eq(0).find('td, th');
            headers.each((i, el) => {
                const txt = $(el).text().trim().toLowerCase();
                console.log(`[DEBUG-HEADERS] Col ${i}: "${txt}"`);
                if (txt === 'name' || txt === 'nombre' || txt.includes('spieler') || txt.includes('player')) nameIdx = i;
                if (txt === 'fideid' || txt === 'fide id' || txt === 'fide-id' || txt === 'id') idIdx = i;
            });

            if (nameIdx !== -1 && idIdx !== -1) {
                console.log(`[DEBUG-TABLE] Found Match: Name=${nameIdx}, ID=${idIdx}`);
                rows.slice(1).each((__, row) => {
                    const cells = $(row).find('td');
                    if (cells.length > Math.max(nameIdx, idIdx)) {
                        const name = cells.eq(nameIdx).text().trim();
                        const id = cells.eq(idIdx).text().trim();
                        // Ensure ID looks like a FIDE ID (numeric, usually 6-8 digits?)
                        if (name && id && /^\d+$/.test(id)) {
                            // Normalize name? "Last, First" is standard
                            map.set(name, id);
                        }
                    }
                });
            }
        });

        console.log(`[PARTICIPANTS] Found ${map.size} participants with FIDE IDs.`);

    } catch (e) {
        console.error("Error fetching participants", e);
    }
    return map;
}

// Simple Cache for Opponent FIDE Ratings to avoid re-fetching in same request context if possible, 
// though here scoping is per request usually. 
const OP_CACHE = new Map<string, number>();

// Helper: Get Tournament Schedule
/**
 * Resolves a Google Maps URL (handling short links/redirects) and extracts lat/lng
 */
export async function resolveGoogleMapsCoords(mapsUrl: string): Promise<{ lat: number, lng: number } | null> {
    try {
        console.log(`[MAPS] Resolving coordinates for: ${mapsUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(mapsUrl, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                // Use a modern browser user agent
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Cookie': 'CONSENT=YES+;' // Bypass basic consent screen
            }
        });
        clearTimeout(timeoutId);

        const finalUrl = response.url;
        const body = await response.text();
        console.log(`[MAPS] Final URL: ${finalUrl} (Body length: ${body.length})`);

        const extractFromText = (text: string, source: string) => {
            // Pattern 1: @lat,lng
            const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (atMatch) {
                console.log(`[MAPS] Matched Pattern 1 (@lat,lng) from ${source}`);
                return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
            }

            // Pattern 2: !3d... !4d...
            const dataMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
            if (dataMatch) {
                console.log(`[MAPS] Matched Pattern 2 (!3d!4d) from ${source}`);
                return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) };
            }

            // Pattern 3: ll=lat,lng or q=lat,lng
            const queryMatch = text.match(/[?&](?:q|query|center|ll|sll)=(-?\d+\.\d+)(?:,|%20|%2C)(-?\d+\.\d+)/);
            if (queryMatch) {
                console.log(`[MAPS] Matched Pattern 3 (query/ll) from ${source}`);
                return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
            }

            // Pattern 4: [lat, lng] in JSON-like structures
            const jsonMatches = text.matchAll(/\[(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\]/g);
            for (const m of jsonMatches) {
                const lat = parseFloat(m[1]);
                const lng = parseFloat(m[2]);
                if (lat > 27 && lat < 45 && lng > -19 && lng < 5) {
                    console.log(`[MAPS] Matched Pattern 4 ([lat,lng]) from ${source}: ${lat},${lng}`);
                    return { lat, lng };
                }
            }

            // Pattern 5: URL encoded
            const encodedMatch = text.match(/%2C(-?\d+\.\d+)%2C(-?\d+\.\d+)/);
            if (encodedMatch) {
                console.log(`[MAPS] Matched Pattern 5 (encoded) from ${source}`);
                return { lat: parseFloat(encodedMatch[1]), lng: parseFloat(encodedMatch[2]) };
            }

            return null;
        };

        // Try extract from final URL first
        let coords = extractFromText(finalUrl, 'URL');
        if (coords) return coords;

        // Try extract from body
        coords = extractFromText(body, 'Body');

        // Final fallback: if it's a search URL and we still have no coords, 
        // sometimes the coords are hidden in a static map URL in the body
        if (!coords && body.includes('staticmap')) {
            const staticMapMatch = body.match(/staticmap[^?]*\?[^"']*(?:center|ll|markers)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/);
            if (staticMapMatch) {
                coords = { lat: parseFloat(staticMapMatch[1]), lng: parseFloat(staticMapMatch[2]) };
            }
        }

        return coords;

    } catch (e) {
        console.error(`[MAPS] Error resolving coordinates:`, e);
        return null;
    }
}

export async function getTournamentSchedule(tUrl: string): Promise<Map<string, { date: Date, time?: string }>> {
    const scheduleMap = new Map<string, { date: Date, time?: string }>();
    try {
        // Construct Schedule URL: switch to art=14
        const urlObj = new URL(tUrl);
        urlObj.searchParams.set('art', '14');
        const scheduleUrl = urlObj.toString();

        const res = await fetch(scheduleUrl, CHEERIO_CONFIG);
        const html = await res.text();
        const $ = cheerio.load(html);

        $('table.CRs1 tr').each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 2) {
                const round = cells.eq(0).text().trim();
                const dateStr = cells.eq(1).text().trim(); // YYYY/MM/DD
                const timeStr = cells.eq(2).text().trim(); // HH:MM (if present)

                if (round && dateStr) {
                    const parts = dateStr.split(/[./-]/);
                    if (parts.length === 3) {
                        let d: Date | null = null;
                        if (parts[0].length === 4) {
                            // YYYY-MM-DD or YYYY/MM/DD
                            d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
                        } else {
                            // DD-MM-YYYY or DD/MM/YYYY
                            d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        }

                        if (d && !isNaN(d.getTime())) {
                            scheduleMap.set(round, {
                                date: d,
                                time: timeStr || undefined
                            });
                        }
                    }
                }
            }
        });

    } catch (e) {
        console.error("Error fetching schedule", e);
    }
    return scheduleMap;
}

// Helper: Calculate Rating Change (FIDE Formula)
function calculateRatingChange(playerElo: number, opponentElo: number, score: number, kFactor: number): number {
    const diff = opponentElo - playerElo;
    const exponent = diff / 400;
    const expected = 1 / (1 + Math.pow(10, exponent));
    return kFactor * (score - expected);
}

// Helper: Scrape Tournament Page
export async function scrapeTournament(tUrl: string, profile?: ScrapedProfile, minDate?: Date): Promise<TournamentChange | null> {
    try {
        // 1. Fetch Participant Map First (to get Opponent FIDE IDs)
        const participantsMap = await getTournamentParticipants(tUrl);

        const tRes = await fetch(tUrl, CHEERIO_CONFIG);
        const tHtml = await tRes.text();
        const $t = cheerio.load(tHtml);

        const tName = $t('h2').first().text().trim() || $t('h1').first().text().trim();
        console.log("TOURNAMENT NAME:", tName);
        let found = false;
        let ratingType: 'standard' | 'rapid' | 'blitz' = 'standard';

        const allText = $t('body').text();

        // Detect Rating Type
        // Common labels: "Control de tiempo", "Time control", "Ritmo de juego"
        // Values: "Standard", "Rapid", "Blitz", "Rápido"

        const timeControlMatch = allText.match(/(?:Control de tiempo|Time control|Ritmo de juego)[^:]*:\s*([^\n\r]+)/i);
        const timeControl = timeControlMatch ? timeControlMatch[1].toLowerCase() : '';

        if (timeControl.includes('rapid') || timeControl.includes('rápido') || timeControl.includes('rapido')) {
            ratingType = 'rapid';
            console.log(`[RATING-DETECT] Matched 'rapid' in timeControl: "${timeControl}"`);
        } else if (timeControl.includes('blitz')) {
            ratingType = 'blitz';
            console.log(`[RATING-DETECT] Matched 'blitz' in timeControl: "${timeControl}"`);
        } else if (timeControl.includes('standard') || timeControl.includes('estándar')) {
            ratingType = 'standard';
            console.log(`[RATING-DETECT] Matched 'standard' in timeControl: "${timeControl}"`);
        } else {
            // Fallback: Check global text / title if no specific label found or it's ambiguous
            const lowerText = allText.toLowerCase();
            const lowerTitle = tName.toLowerCase();

            // Checks for explicit "Time control (Type)" format which might be missing a colon
            if (allText.match(/Control de tiempo\s*\(Rapid\)/i) || allText.match(/Time control\s*\(Rapid\)/i)) {
                ratingType = 'rapid';
            } else if (allText.match(/Control de tiempo\s*\(Blitz\)/i) || allText.match(/Time control\s*\(Blitz\)/i)) {
                ratingType = 'blitz';
            } else if (allText.match(/Control de tiempo\s*\(Standard\)/i) || allText.match(/Time control\s*\(Standard\)/i)) {
                ratingType = 'standard';
            } else if (lowerTitle.includes('rapid') || lowerTitle.includes('rápido') || lowerTitle.includes('rapido')) {
                ratingType = 'rapid';
            } else if (lowerTitle.includes('blitz')) {
                ratingType = 'blitz';
            } else if (lowerText.includes('ritmo de juego: rápido') || lowerText.includes('ritmo de juego: rapid')) {
                ratingType = 'rapid';
            } else {
                // LAST RESORT: Fetch art=1 (Tournament Details) if not found
                // This is necessary because art=9 (Team/Player view) often lacks Time Control info
                const tnrMatch = tUrl.match(/tnr(\d+)/i);
                if (tnrMatch) {
                    try {
                        // Construct details URL using the same domain as tUrl to avoid session/redirect issues
                        const urlObj = new URL(tUrl);
                        const detailsUrl = `${urlObj.origin}/tnr${tnrMatch[1]}.aspx?art=1&lan=2&turdet=YES&SNode=S0`;
                        const dRes = await fetch(detailsUrl, CHEERIO_CONFIG);
                        if (dRes.ok) {
                            const dHtml = await dRes.text();

                            // Check if content is hidden behind "Show Details" button (archive mode)
                            const $ = cheerio.load(dHtml);
                            let finalHtml = dHtml;

                            if ($('#cb_alleDetails').length > 0) {
                                const viewState = $('#__VIEWSTATE').val();
                                const eventValidation = $('#__EVENTVALIDATION').val();
                                const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val();

                                if (viewState && eventValidation) {
                                    const params = new URLSearchParams();
                                    params.append('__VIEWSTATE', viewState as string);
                                    params.append('__EVENTVALIDATION', eventValidation as string);
                                    if (viewStateGenerator) params.append('__VIEWSTATEGENERATOR', viewStateGenerator as string);
                                    params.append('cb_alleDetails', 'Mostrar detalles del torneo');

                                    const postRes = await fetch(detailsUrl, {
                                        ...CHEERIO_CONFIG,
                                        method: 'POST',
                                        body: params,
                                        headers: {
                                            ...CHEERIO_CONFIG.headers,
                                            'Content-Type': 'application/x-www-form-urlencoded',
                                            'Origin': urlObj.origin,
                                            'Referer': detailsUrl
                                        }
                                    });

                                    if (postRes.ok) {
                                        finalHtml = await postRes.text();
                                    }
                                }
                            }

                            // Simple text scan on details page
                            if (finalHtml.match(/Time control\s*[^:]*:\s*Rapid/i) || finalHtml.match(/Time control\s*\(Rapid\)/i) || finalHtml.includes('Rapid Rating') ||
                                finalHtml.match(/Control de tiempo\s*[^:]*:\s*Rapid/i) || finalHtml.match(/Control de tiempo\s*\(Rapid\)/i)) {
                                ratingType = 'rapid';
                                console.log("[SCRAPER] Detected RAPID from details.");
                            } else if (finalHtml.match(/Time control\s*[^:]*:\s*Blitz/i) || finalHtml.match(/Time control\s*\(Blitz\)/i) || finalHtml.includes('Blitz Rating') ||
                                finalHtml.match(/Control de tiempo\s*[^:]*:\s*Blitz/i) || finalHtml.match(/Control de tiempo\s*\(Blitz\)/i)) {
                                ratingType = 'blitz';
                                console.log("[SCRAPER] Detected BLITZ from details.");
                            } else {
                                console.log("[SCRAPER] No rating type found in details.");
                            }
                        }
                    } catch (err) {
                        console.error("Failed to fetch details", err);
                    }
                }
            }
        }

        // Extract Rounds
        const roundsMatch = allText.match(/(?:Rondas|Rounds):?\s*(\d+)/i);
        const rounds = roundsMatch ? roundsMatch[1] : undefined;



        // Extract Player Info for fallback calculation
        const playerEloMatch = allText.match(/Elo internacional\s*(\d+)/i) || allText.match(/FIDE-Elo\s*(\d+)/i) || allText.match(/Elo\s*(\d+)/i);
        let playerElo = playerEloMatch ? parseInt(playerEloMatch[1], 10) : 0;

        // Use FIDE Profile Elo if available (preferable source)
        if (profile) {
            if (ratingType === 'standard' && profile.std > 0) playerElo = profile.std;
            if (ratingType === 'rapid' && profile.rapid > 0) playerElo = profile.rapid;
            if (ratingType === 'blitz' && profile.blitz > 0) playerElo = profile.blitz;
        }

        const birthYearMatch = allText.match(/Fecha de nacimiento\s*(\d{4})/i) || allText.match(/Year of birth\s*(\d{4})/i);
        const birthYear = birthYearMatch ? parseInt(birthYearMatch[1], 10) : 0;

        // Determine K-factor
        let kFactor = 20; // Default
        const currentYear = new Date().getFullYear();
        if (birthYear > 0 && (currentYear - birthYear) < 18) {
            kFactor = 40;
        } else if (playerElo >= 2400) {
            kFactor = 10; // Simple heuristic
        }

        const games: GameResult[] = [];

        // Parse Games Table (CRs1)
        const tables = $t('table.CRs1');

        // We need to process games sequentially to await FIDE fetches if needed?
        // Actually, we can collect promises.

        const gamePromises: Promise<void>[] = [];

        tables.each((ti, tbl) => {
            const rows = $t(tbl).find('tr');
            if (rows.length === 0) return;

            const headerCells = rows.eq(0).find('td, th');
            const headers: string[] = [];
            headerCells.each((_, el) => {
                headers.push($t(el).text().trim().toLowerCase());
            });

            let changeColIndex = -1;
            let roundColIndex = -1;
            let nameColIndex = -1;
            let rtgColIndex = -1;
            let resColIndex = -1;

            headers.forEach((h, i) => {
                if (h.includes('elo +/-') || h.includes('elo+/-') || h.includes('rtg +/-') || h.includes('rtg+/-') || h.includes('var.') || h.includes('w-we')) {
                    changeColIndex = i;
                }
                if (h === 'rd' || h === 'rd.' || h.includes('round') || h.includes('ronda')) roundColIndex = i;
                if ((h.includes('name') || h.includes('nombre')) && !h.includes('team') && !h.includes('club')) nameColIndex = i;
                if (h === 'rtg' || h === 'elo' || h === 'fide-elo' || h === 'elo fide') rtgColIndex = i;
                if (h.includes('res') || h.includes('pts.')) resColIndex = i;
            });

            if (changeColIndex !== -1) {
                // Extract Games
                rows.slice(1).each((_, row) => {
                    const cells = $t(row).find('td');
                    // Skip empty/spacer rows
                    if (cells.length < headers.length) return;

                    // Handle column misalignment (extra columns in body vs header)
                    // Usually "elo+/-" is near the end, so we can try to map from the right if lengths differ
                    let actualChangeIndex = changeColIndex;
                    const offset = cells.length - headers.length;

                    if (offset > 0) {
                        const rightIndex = cells.length - (headers.length - changeColIndex);
                        if (rightIndex >= 0 && rightIndex < cells.length) {
                            actualChangeIndex = rightIndex;
                        }
                    }

                    if (cells.length > actualChangeIndex) {
                        gamePromises.push((async () => {
                            const changeTxt = cells.eq(actualChangeIndex).text().trim();
                            // Normalize minus signs (U+2212, U+2013, etc) to standard hyphen
                            const normalizedTxt = changeTxt.replace(/[\u2212\u2013\u2014]/g, '-').replace(',', '.');

                            const rd = roundColIndex !== -1 ? cells.eq(roundColIndex).text().trim() : '';
                            const nm = nameColIndex !== -1 ? cells.eq(nameColIndex).text().trim() : 'Unknown';
                            const rtgTxt = rtgColIndex !== -1 ? cells.eq(rtgColIndex).text().trim() : '';
                            let rtg = parseInt(rtgTxt, 10) || 0; // Opponent Rating (Scraped)
                            const res = resColIndex !== -1 ? cells.eq(resColIndex).text().trim() : '';

                            // Determine Score
                            let score = -1;
                            if (res === '1') score = 1;
                            else if (res === '0') score = 0;
                            else if (res === '½' || res === '0,5' || res === '0.5') score = 0.5;

                            let finalChange = 0;

                            // Default to scraped change if sensible
                            if (normalizedTxt && /^[+-]?\d/.test(normalizedTxt)) {
                                finalChange = parseFloat(normalizedTxt);
                            }

                            // Try to Find Opponent FIDE ID and Fetch Live Rating
                            if (playerElo > 0 && nm !== 'Unknown') {
                                const opFideId = participantsMap.get(nm);
                                if (opFideId) {
                                    if (OP_CACHE.has(opFideId)) {
                                        rtg = OP_CACHE.get(opFideId)!;
                                    } else {
                                        const opProfile = await getFideProfile(opFideId);
                                        if (opProfile) {
                                            let liveOp = 0;
                                            if (ratingType === 'standard') liveOp = opProfile.std;
                                            if (ratingType === 'rapid') liveOp = opProfile.rapid;
                                            if (ratingType === 'blitz') liveOp = opProfile.blitz;

                                            if (liveOp > 0) {
                                                rtg = liveOp;
                                                OP_CACHE.set(opFideId, liveOp);
                                            }
                                        }
                                    }
                                }
                            }

                            if (playerElo > 0 && rtg > 0 && score !== -1) {
                                const calculated = calculateRatingChange(playerElo, rtg, score, kFactor);
                                finalChange = parseFloat(calculated.toFixed(2));
                            }

                            if (finalChange !== 0 || score !== -1) {
                                games.push({
                                    round: rd,
                                    opponentName: nm,
                                    opponentRating: rtg > 0 ? rtg : null,
                                    result: res,
                                    change: finalChange
                                });
                                found = true;
                            }
                        })());
                    }
                });
            } else if (playerElo > 0 && rtgColIndex !== -1 && resColIndex !== -1) {
                // FALLBACK: Manual Calculation
                rows.slice(1).each((_, row) => {
                    gamePromises.push((async () => {
                        const cells = $t(row).find('td');
                        if (cells.length <= rtgColIndex || cells.length <= resColIndex) return;

                        const rd = roundColIndex !== -1 ? cells.eq(roundColIndex).text().trim() : '';
                        const nm = nameColIndex !== -1 ? cells.eq(nameColIndex).text().trim() : 'Unknown';

                        const rtgTxt = cells.eq(rtgColIndex).text().trim();
                        let rtg = parseInt(rtgTxt, 10) || 0;

                        const resTxt = cells.eq(resColIndex).text().trim();

                        let score = -1;
                        if (resTxt === '1') score = 1;
                        else if (resTxt === '0') score = 0;
                        else if (resTxt === '½' || resTxt === '0,5' || resTxt === '0.5') score = 0.5;

                        if (playerElo > 0 && nm !== 'Unknown') {
                            const opFideId = participantsMap.get(nm);
                            if (opFideId) {
                                if (OP_CACHE.has(opFideId)) {
                                    rtg = OP_CACHE.get(opFideId)!;
                                } else {
                                    const opProfile = await getFideProfile(opFideId);
                                    if (opProfile) {
                                        let liveOp = 0;
                                        if (ratingType === 'standard') liveOp = opProfile.std;
                                        if (ratingType === 'rapid') liveOp = opProfile.rapid;
                                        if (ratingType === 'blitz') liveOp = opProfile.blitz;

                                        if (liveOp > 0) {
                                            rtg = liveOp;
                                            OP_CACHE.set(opFideId, liveOp);
                                        }
                                    }
                                }
                            }
                        }

                        if (rtg > 0 && score !== -1) {
                            const chg = calculateRatingChange(playerElo, rtg, score, kFactor);
                            const rd = roundColIndex !== -1 ? cells.eq(roundColIndex).text().trim() : '';
                            const nm = nameColIndex !== -1 ? cells.eq(nameColIndex).text().trim() : 'Unknown';

                            games.push({
                                round: rd,
                                opponentName: nm,
                                opponentRating: rtg,
                                result: resTxt,
                                change: parseFloat(chg.toFixed(2))
                            });
                            found = true;
                        }
                    })());
                });
            }
        });

        if (gamePromises.length > 0) {
            await Promise.all(gamePromises);
        }

        let filteredGames = games;
        let finalChange = 0;

        if (found) {
            const schedule = await getTournamentSchedule(tUrl);

            let filterDate = minDate;
            if (!filterDate) {
                const now = new Date();
                filterDate = new Date(now.getFullYear(), now.getMonth(), 1);
                filterDate.setHours(0, 0, 0, 0);
            }

            if (schedule.size > 0) {
                filteredGames = games.filter(g => {
                    const info = schedule.get(g.round);
                    if (!info) return false;
                    return info.date >= filterDate!;
                });
            }

            finalChange = parseFloat(filteredGames.reduce((acc, g) => acc + g.change, 0).toFixed(2));
        }

        let startDate: Date | undefined;
        let endDate: Date | undefined;

        const dateLineMatch = allText.match(/(?:Fecha|Date)\s*(\d{4}\/\d{2}\/\d{2})\s*(?:al|to|-)\s*(\d{4}\/\d{2}\/\d{2})/i);
        if (dateLineMatch) {
            startDate = new Date(dateLineMatch[1]);
            endDate = new Date(dateLineMatch[2]);
        } else {
            const singleDateMatch = allText.match(/(?:Fecha|Date)\s*(\d{4}\/\d{2}\/\d{2})/i);
            if (singleDateMatch) {
                startDate = new Date(singleDateMatch[1]);
                endDate = new Date(singleDateMatch[1]);
            }
        }

        if (found || tName) {
            return {
                name: tName,
                change: finalChange,
                kFactor: 0,
                url: tUrl,
                lastUpdate: undefined,
                games: filteredGames,
                ratingType: ratingType,
                startDate,
                endDate,
                rounds
            };
        }
        return null;
    } catch (e) {
        console.error(`Error scraping ${tUrl}`, e);
        return null;
    }
}

export async function getFideRatedTournamentNames(fideId: string): Promise<string[]> {
    const names: string[] = [];
    const now = new Date();
    const periodDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodStr = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}-01`;
    const types = [0, 1, 2];

    for (const t of types) {
        try {
            const url = `https://ratings.fide.com/a_indv_calculations.php?id_number=${fideId}&rating_period=${periodStr}&t=${t}`;
            const res = await fetch(url, {
                ...CHEERIO_CONFIG,
                headers: {
                    ...CHEERIO_CONFIG.headers,
                    'Connection': 'keep-alive'
                }
            });

            if (res.ok) {
                const html = await res.text();
                const $ = cheerio.load(html);
                $('.rtng_line01 a.head1').each((i, el) => {
                    const txt = $(el).text().trim();
                    if (txt) names.push(txt);
                });
            }
            await new Promise(r => setTimeout(r, 200));
        } catch (e) {
            console.error(`Failed to fetch FIDE calculations for type ${t}`, e);
        }
    }
    return names;
}

export function areTournamentsSame(name1: string, name2: string): boolean {
    const normalize = (s: string) => {
        return s.toLowerCase()
            .replace(/[^a-z0-9 ]/g, ' ')
            .split(' ')
            .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'club', 'chess', 'torneo', 'campeonato', 'open', 'ajedrez'].includes(w));
    };

    const w1 = [...new Set(normalize(name1))];
    const w2 = [...new Set(normalize(name2))];

    if (w1.length === 0 || w2.length === 0) return false;

    const intersection = w1.filter(x => w2.includes(x));
    const score = intersection.length;

    if (score >= 2) return true;
    if (score >= 1 && (w1.length === 1 || w2.length === 1)) return true;

    return false;
}

export async function getFideRatedTournaments(fideId: string, date: Date = new Date()): Promise<{ name: string; ratingType: 'standard' | 'rapid' | 'blitz' }[]> {
    const periodDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const periodStr = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}-01`;

    const cacheKey = `${fideId}-${periodStr}`;
    const cached = FIDE_RATED_CACHE.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
        return cached.data;
    }

    if (FIDE_FETCH_LOCKS.has(cacheKey)) {
        return FIDE_FETCH_LOCKS.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
        const results: { name: string; ratingType: 'standard' | 'rapid' | 'blitz' }[] = [];
        const types = [0, 1, 2];
        const typeMap: { [key: number]: 'standard' | 'rapid' | 'blitz' } = { 0: 'standard', 1: 'rapid', 2: 'blitz' };
        let allSuccess = true;

        for (const t of types) {
            let success = false;
            let retries = 2;

            while (!success && retries >= 0) {
                try {
                    const url = `https://ratings.fide.com/a_indv_calculations.php?id_number=${fideId}&rating_period=${periodStr}&t=${t}`;
                    const res = await fetch(url, {
                        ...CHEERIO_CONFIG,
                        headers: {
                            ...CHEERIO_CONFIG.headers,
                            'Connection': 'keep-alive'
                        }
                    });

                    if (res.ok) {
                        const html = await res.text();
                        const $ = cheerio.load(html);

                        $('.rtng_line01 a.head1').each((i, el) => {
                            const txt = $(el).text().trim();
                            if (txt) {
                                results.push({ name: txt, ratingType: typeMap[t] });
                            }
                        });
                        success = true;
                    } else {
                        retries--;
                        if (retries >= 0) await new Promise(r => setTimeout(r, 1000));
                    }
                } catch (e: any) {
                    retries--;
                    if (retries >= 0) await new Promise(r => setTimeout(r, 1000));
                }
            }

            if (!success) allSuccess = false;

            if (t < 2) await new Promise(r => setTimeout(r, 1000));
        }

        if (allSuccess) {
            FIDE_RATED_CACHE.set(cacheKey, { data: results, expiry: Date.now() + 15 * 60 * 1000 });
        }

        return results;
    })();

    FIDE_FETCH_LOCKS.set(cacheKey, fetchPromise);
    try {
        return await fetchPromise;
    } finally {
        FIDE_FETCH_LOCKS.delete(cacheKey);
    }
}

export interface TournamentDetails {
    organizer?: string;
    location?: string;
    description?: string; // e.g. "9 rounds, Swiss system"
    totalPlayers?: number;
    federationsCount?: number;
    rounds?: string;
    timeControl?: string;
    tempo?: 'Standard' | 'Rapid' | 'Blitz';
    startDate?: string;
    endDate?: string;
    mapsUrl?: string;
    lat?: number;
    lng?: number;
    chiefArbiter?: string;
    avgElo?: string;
    posterImage?: string;
    schedule?: { round: string, date: string, time?: string }[];
    regulations?: { text: string, url: string };
    topPlayers: {
        name: string;
        title?: string;
        rating?: number;
        fed: string;
    }[];
}

export async function getTournamentDetails(url: string): Promise<TournamentDetails | null> {
    try {
        // 1. Fetch General Details (art=1)
        const urlObj = new URL(url);
        // Clean params
        urlObj.searchParams.set('lan', '2');
        urlObj.searchParams.set('turdet', 'YES');
        // Force art=1 for general info
        urlObj.searchParams.set('art', '1');

        const res = await fetch(urlObj.toString(), CHEERIO_CONFIG);
        if (!res.ok) return null;
        const html = await res.text();
        const $ = cheerio.load(html);

        const details: TournamentDetails = {
            topPlayers: []
        };

        // Populate Schedule
        const scheduleMap = await getTournamentSchedule(url);
        if (scheduleMap.size > 0) {
            const sortedSchedule = Array.from(scheduleMap.entries())
                .sort((a, b) => a[1].date.getTime() - b[1].date.getTime());

            details.schedule = sortedSchedule.map(([round, info]) => ({
                round,
                date: info.date.toISOString().split('T')[0],
                time: info.time
            }));

            // Derive start/end from schedule
            if (!details.startDate) {
                details.startDate = sortedSchedule[0][1].date.toISOString().split('T')[0];
            }
            if (!details.endDate) {
                details.endDate = sortedSchedule[sortedSchedule.length - 1][1].date.toISOString().split('T')[0];
            }
        }

        // Search for Poster Image
        // Often in a specific div "SchachturnierBildBox" or just an img with src containing "TournamentImages"
        const posterImg = $('img[src*="TournamentImages"]').first();
        if (posterImg.length > 0) {
            let src = posterImg.attr('src');
            if (src) {
                if (!src.startsWith('http')) {
                    const origin = urlObj.origin;
                    src = src.startsWith('/') ? `${origin}${src}` : `${origin}/${src}`;
                }
                details.posterImage = src;
            }
        }


        // Scrape tables: CRs1, CRs2, (standard), 'daten' (legacy/mobile/specific views)
        // We look for rows where the first cell is a label
        $('.CRs1 tr, .CRs2 tr, .daten tr').each((_, el) => {
            const cells = $(el).find('td, th'); // Headers might be th
            if (cells.length < 2) return;

            const label = cells.eq(0).text().trim().toLowerCase();
            const value = cells.eq(1).text().trim();

            if (!value) return;

            if (label.includes('organizer') || label.includes('organizador')) {
                details.organizer = value;
            } else if (label.includes('location') || label.includes('lugar')) {
                // Look for a link inside this cell
                const link = cells.eq(1).find('a');
                if (link.length > 0) {
                    details.location = link.text().trim();
                    details.mapsUrl = link.attr('href');
                } else {
                    details.location = value;
                }
            } else if (label.includes('elo average') || label.includes('media de elo')) {
                details.avgElo = value;
            } else if (label.includes('chief arbiter') || label.includes('árbitro principal')) {
                details.chiefArbiter = value;
            } else if (label.includes('time control') || label.includes('control de tiempo') || label.includes('ritmo de juego')) {
                details.timeControl = value;
                // Heuristic for tempo based on time control
                const valLower = value.toLowerCase();
                if (valLower.includes('min') || valLower.includes('\'')) {
                    const minsMatch = valLower.match(/(\d+)\s*(?:min|')/);
                    if (minsMatch) {
                        const mins = parseInt(minsMatch[1], 10);
                        if (mins < 10) details.tempo = 'Blitz';
                        else if (mins < 60) details.tempo = 'Rapid';
                        else details.tempo = 'Standard';
                    }
                }
            } else if (label.includes('rounds') || label.includes('rondas')) {
                details.rounds = value;
            } else if (label.includes('end date') || label.includes('fecha final')) {
                // Parse date like 2026/02/01
                const d = value.match(/(\d{4})[./-](\d{2})[./-](\d{2})/);
                if (d) details.endDate = `${d[1]}-${d[2]}-${d[3]}`;
            } else if (label === 'fecha' || label === 'date') {
                // Single date tournament
                const d = value.match(/(\d{4})[./-](\d{2})[./-](\d{2})/);
                if (d) {
                    const formattedDate = `${d[1]}-${d[2]}-${d[3]}`;
                    if (!details.startDate) details.startDate = formattedDate;
                    if (!details.endDate) details.endDate = formattedDate;
                }
            }
        });

        // 3. Look for "Show regulations" or similar links
        // Common pattern: <a href="...">Show tournament regulations</a>
        $('a').each((_, el) => {
            const txt = $(el).text().trim().toLowerCase();
            const href = $(el).attr('href');
            if (href && (txt.includes('regulations') || txt.includes('bases') || txt.includes('convocatoria'))) {
                // Fix relative URLs
                let fullUrl = href;
                if (!fullUrl.startsWith('http')) {
                    const origin = urlObj.origin;
                    fullUrl = fullUrl.startsWith('/') ? `${origin}${fullUrl}` : `${origin}/${fullUrl}`;
                }
                details.regulations = {
                    text: $(el).text().trim(),
                    url: fullUrl
                };
            }
        });

        // Resolve coordinates if mapsUrl is present
        if (details.mapsUrl) {
            const coords = await resolveGoogleMapsCoords(details.mapsUrl);
            if (coords) {
                details.lat = coords.lat;
                details.lng = coords.lng;
            }
        }

        // 2. Fetch Top Players (art=0 usually is Starting Rank)
        urlObj.searchParams.set('art', '0');

        const resPlayers = await fetch(urlObj.toString(), CHEERIO_CONFIG);
        if (resPlayers.ok) {
            const htmlPlayers = await resPlayers.text();
            const $p = cheerio.load(htmlPlayers);

            // Find valid table. CRs1 is standard.
            // If not found, try CRs2 or first table with reasonable rows?
            let table = $p('table.CRs1');
            if (table.length === 0) table = $p('table.CRs2');

            // If still not found, stick to empty
            if (table.length > 0) {
                const rows = table.find('tr');
                // Check header to detect columns?
                // Standard: No. | Name | FideID | FED | Rtg
                // Team: No. | Team | Rtg
                // We will just try to scrape typical columns.

                // Skip header
                rows.slice(1).each((i, el) => {
                    if (details.topPlayers.length >= 5) return false;

                    const tds = $p(el).find('td');
                    if (tds.length < 3) return;
                    // Need at least Rank, Name, (something)

                    let name = "";
                    let title = "";
                    let fed = "";
                    let rtg = 0;

                    // 1. Name: Look for link to SpielerInfo/TeamInfo
                    const link = tds.find('a[href*="Info"]');
                    if (link.length > 0) {
                        name = link.text().trim();
                        // Title: often in previous column
                        const parentIdx = link.parent().index();
                        if (parentIdx > 0) {
                            const val = tds.eq(parentIdx - 1).text().trim();
                            if (['GM', 'IM', 'FM', 'CM', 'WGM', 'WIM', 'WFM', 'WCM'].includes(val)) {
                                title = val;
                            }
                        }
                    } else {
                        // Heuristic: Column 2 (index 1) or 3 (index 2)
                        // If there is no link (rare), assume Col 2 is Name
                        const val2 = tds.eq(1).text().trim();
                        const val3 = tds.eq(2).text().trim();
                        // If Col 2 is long and not a number, it's name
                        if (isNaN(parseInt(val2)) && val2.length > 3) {
                            name = val2;
                        } else if (isNaN(parseInt(val3)) && val3.length > 3) {
                            name = val3;
                        }
                    }

                    if (!name) return;

                    // 2. FED: Look for 3-letter uppercase code
                    tds.each((j, td) => {
                        const txt = $p(td).text().trim();
                        if (/^[A-Z]{3}$/.test(txt) && !fed) {
                            fed = txt;
                        }
                        // 3. Rating: 3-4 digits, usually after name
                        // Avoid Rank (index 0)
                        if (j > 1) {
                            // Check if it's a number
                            if (/^\d{3,4}$/.test(txt)) {
                                // If we already have one, maybe take the higher/first one?
                                // Standard often has FideElo and NatElo.
                                // We take the first plausible rating found (Fide usually first)
                                if (rtg === 0) rtg = parseInt(txt, 10);
                            }
                        }
                    });

                    details.topPlayers.push({
                        name,
                        title,
                        fed,
                        rating: rtg
                    });
                });

                // Count totals
                const bodyText = $p('body').text();
                const countMatch = bodyText.match(/(\d+)\s*(?:players|teilnehmer|jugadores|teams|equipos)/i);
                if (countMatch) {
                    details.totalPlayers = parseInt(countMatch[1], 10);
                } else {
                    details.totalPlayers = rows.length - 1; // approximate
                }
            }
        }

        return details;

    } catch (e) {
        console.error("Error getting tournament details", e);
        return null;
    }
}

export async function getLatestSpainTournaments(): Promise<SearchInfo[]> {
    try {
        const url = 'https://chess-results.com/fed.aspx?lan=2&fed=ESP';
        console.log(`[SPAIN-SEARCH] Fetching recent tournaments from ${url}`);

        const res = await fetch(url, CHEERIO_CONFIG);
        if (!res.ok) throw new Error(`Failed to fetch ${url}`);

        const html = await res.text();
        const $ = cheerio.load(html);

        const results: SearchInfo[] = [];
        const processedUrls = new Set<string>();

        // Select all rows in the results tables
        $('.CRs1 tr, .CRs2 tr').each((_, el) => {
            const tds = $(el).find('td');
            // Normally index 1 is the tournament name with link
            const linkEl = tds.find('a').filter((_, a) => {
                const href = $(a).attr('href');
                return !!(href && href.includes('tnr'));
            }).first();

            if (linkEl.length > 0) {
                const name = linkEl.text().trim();
                const href = linkEl.attr('href');

                if (name && href) {
                    const fullUrl = href.startsWith('http') ? href : `https://chess-results.com/${href}`;
                    const urlObj = new URL(fullUrl);
                    urlObj.searchParams.set('turdet', 'YES');
                    urlObj.searchParams.set('lan', '2');
                    const normalizedUrl = urlObj.toString();

                    if (!processedUrls.has(normalizedUrl)) {
                        let tempo: 'Standard' | 'Rapid' | 'Blitz' = 'Standard';
                        const nameLower = name.toLowerCase();
                        if (nameLower.includes(' bz') || nameLower.endsWith(' bz')) tempo = 'Blitz';
                        else if (nameLower.includes(' rp') || nameLower.endsWith(' rp')) tempo = 'Rapid';

                        results.push({
                            name,
                            url: normalizedUrl,
                            endDate: '', // fed.aspx doesn't show it directly, sync will fetch it
                            tempo
                        } as any);
                        processedUrls.add(normalizedUrl);
                    }
                }
            }
        });

        console.log(`[SPAIN-SEARCH] Found ${results.length} recent tournaments.`);
        return results;

    } catch (e) {
        console.error("Error fetching Spain tournaments", e);
        return [];
    }
}

/**
 * Mapping of UI city names to Chess-Results search terms
 */
const CITY_SEARCH_MAPPING: Record<string, string[]> = {
    "Santa Cruz de Tenerife": ["Tenerife", "La Laguna"],
    "Las Palmas de Gran Canaria": ["Gran Canaria", "Las Palmas"],
    "Madrid": ["Madrid"],
    "Barcelona": ["Barcelona"],
    "Valencia": ["Valencia"],
    "Sevilla": ["Sevilla"],
    "Bilbao": ["Bilbao", "Vizcaya"],
    "Málaga": ["Málaga"],
    "Zaragoza": ["Zaragoza"],
};

/**
 * Parses relative "Last Update" strings from Chess-Results
 * Examples: "23 Horas 27 Min.", "1 Días 1 Horas", "105 Días 10 Horas"
 */
function parseLastUpdateDays(text: string): number {
    const lower = text.toLowerCase();

    // Header detection
    if (lower.includes('actualización') || lower.includes('update')) return -1;

    // Match "1 Día", "2 Días", etc. FIRST to avoid mis-parsing as 0 hours
    const daysMatch = text.match(/(\d+)\s*Día/i);
    if (daysMatch) return parseInt(daysMatch[1]);

    if (lower.includes('min') || lower.includes('hora') || lower.includes('ayer')) return 0;

    return 999; // Unknown
}

/**
 * Performs a search on the tournament search page (TurnierSuche.aspx)
 * Stops scraping if encounters tournaments updated more than 60 days ago.
 */
export async function searchTournamentsByPlace(country: string, place: string): Promise<any[]> {
    try {
        // Chess-Results uses ASP.NET WebForms - requires POST with ViewState
        const searchUrl = 'https://s2.chess-results.com/TurnierSuche.aspx?lan=2';

        console.log(`[BACKGROUND-SCRAPE] Searching Place="${place}"...`);

        // Step 1: GET the form page to extract __VIEWSTATE and other hidden fields
        const initialRes = await fetch(searchUrl, {
            headers: CHEERIO_CONFIG.headers
        });
        const initialHtml = await initialRes.text();
        const $ = cheerio.load(initialHtml);

        // Extract cookies from response
        const cookieHeader = initialRes.headers.get('set-cookie') || '';
        const cookies = cookieHeader.split(',').map((c: string) => c.split(';')[0].trim()).filter(Boolean).join('; ');

        // Step 2: Build form data with all hidden fields
        const formData = new URLSearchParams();

        // Add all hidden input fields (crucial for ASP.NET postback)
        $('input[type="hidden"]').each((_, el) => {
            const name = $(el).attr('name');
            const value = $(el).val();
            if (name && value !== undefined) {
                formData.append(name, String(value));
            }
        });

        // Set search parameters
        formData.set('ctl00$P1$txt_ort', place);
        formData.set('ctl00$P1$combo_land', country === 'Spain' || country === 'ESP' ? 'ESP' : country);
        formData.set('ctl00$P1$combo_sort', '1');  // Sort by last update
        formData.set('ctl00$P1$cb_suchen', 'Buscar');  // Search button

        // Step 3: POST the form
        const res = await fetch(searchUrl, {
            method: 'POST',
            body: formData.toString(),
            headers: {
                ...CHEERIO_CONFIG.headers,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies,
                'Origin': 'https://s2.chess-results.com',
                'Referer': searchUrl
            }
        });

        const html = await res.text();

        // DEBUG: Save HTML
        const fs = require('fs');
        fs.writeFileSync(`/tmp/scraper-${place}.html`, html);

        const $search = cheerio.load(html);
        const results: any[] = [];

        // Find the results table - look for table containing result rows (CRg1/CRg2 classes)
        let $table = $search('table').filter((_, table) => {
            return $search(table).find('tr.CRg1, tr.CRg2').length > 0;
        }).first();

        if ($table.length === 0) {
            // Fallback: look for table with many columns
            $search('table').each((_, table) => {
                const firstDataRow = $search(table).find('tr').filter((_, tr) => {
                    return $search(tr).find('td').length >= 5;
                }).first();
                if (firstDataRow.length > 0 && $search(firstDataRow).find('a[href*="tnr"]').length > 0) {
                    $table = $search(table);
                    return false;
                }
            });
        }

        if ($table.length === 0) {
            console.warn(`[BACKGROUND-SCRAPE] Results table not found for "${place}".`);
            return [];
        }

        const rowCount = $table.find('tr.CRg1, tr.CRg2').length;
        console.log(`[BACKGROUND-SCRAPE] Found results table with ${rowCount} tournament rows`);

        // Column indices for Chess-Results search results table
        // Col 0: Number, Col 1: Tournament Name, Col 2: FED, Col 3: Flag, Col 4: Last Update
        const nameIdx = 1;
        const updateIdx = 4;

        // Process only tournament result rows (CRg1 or CRg2)
        $table.find('tr.CRg1, tr.CRg2').each((i: number, tr: any) => {
            const tds = $search(tr).find('td');
            if (tds.length < 5) return;

            const lastUpdateText = tds.eq(updateIdx).text().trim();
            const daysSinceUpdate = parseLastUpdateDays(lastUpdateText);

            // Skip if can't parse days
            if (daysSinceUpdate < 0) return;

            // LOG Columns for first row to debug
            if (i === 0) {
                const cols = [];
                tds.each((_: any, t: any) => cols.push($search(t).text().trim()));
                console.log('[BACKGROUND-SCRAPE] First Row Columns:', cols);
            }

            // Stop if tournament is too old (updated more than 60 days ago)
            if (daysSinceUpdate > 60) {
                console.log(`[BACKGROUND-SCRAPE] Stopping at row ${i}: ${lastUpdateText} (${daysSinceUpdate} days)`);
                return false; // Break loop
            }

            const name = tds.eq(nameIdx).text().trim();
            const link = tds.eq(nameIdx).find('a').attr('href');

            if (!name || !link) return;

            const fullUrl = link.startsWith('http') ? link : `https://chess-results.com/${link}`;
            const urlObj = new URL(fullUrl);
            urlObj.searchParams.set('lan', '2');
            urlObj.searchParams.set('turdet', 'YES');

            results.push({
                name,
                url: urlObj.toString(),
                fed: country
            });
        });

        return results;
    } catch (e) {
        console.error("Error in searchTournamentsByPlace:", e);
        return [];
    }
}

const SYNC_LOCKS = new Set<string>();

/**
 * Orchestrates the background sync for a specific city
 */
export async function backgroundSyncTournaments(country: string, city: string) {
    const lockKey = `${country}:${city}`;
    if (SYNC_LOCKS.has(lockKey)) {
        console.log(`[BACKGROUND-SYNC] Sync already in progress for ${lockKey}. Skipping.`);
        return;
    }

    try {
        SYNC_LOCKS.add(lockKey);
        console.log(`[BACKGROUND-SYNC] Starting sync for City="${city}", Country="${country}"`);

        // Load search terms from JSON file
        let searchTerms = [city];
        try {
            const fs = require('fs');
            const path = require('path');
            const configPath = path.join(process.cwd(), 'lib/city_search_terms.json');

            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf-8');
                const mapping = JSON.parse(configData);
                if (mapping[city]) {
                    searchTerms = mapping[city];
                }
            } else {
                // Fallback to internal mapping if file missing (optional, or just use city)
                searchTerms = CITY_SEARCH_MAPPING[city] || [city];
            }
        } catch (err) {
            console.error("[BACKGROUND-SYNC] Failed to load city_search_terms.json", err);
            searchTerms = CITY_SEARCH_MAPPING[city] || [city];
        }

        if (!city) {
            console.log("[BACKGROUND-SYNC] No city provided. Skipping sync.");
            return;
        }

        const collection = db.collection('tournaments');
        const now = new Date();
        const processedThisSession = new Set<string>();

        for (const term of searchTerms) {
            const found = await searchTournamentsByPlace(country, term);
            console.log(`[BACKGROUND-SYNC] Term="${term}" found ${found.length} active tournaments.`);

            for (const t of found) {
                const match = t.url.match(/tnr(\d+)/);
                const tournamentId = match ? match[1] : null;
                if (!tournamentId || processedThisSession.has(tournamentId)) continue;

                processedThisSession.add(tournamentId);

                // Check if we should update
                const docRef = collection.doc(tournamentId);
                const doc = await docRef.get();

                if (doc.exists) {
                    const data = doc.data();
                    const lastUpdated = data?.updatedAt?.toDate() || new Date(0);
                    // Update every 12 hours max unless forced
                    if (now.getTime() - lastUpdated.getTime() < 12 * 60 * 60 * 1000) {
                        continue;
                    }
                }

                console.log(`[BACKGROUND-SYNC] Fetching details for ${tournamentId}: ${t.name}`);
                const details = await getTournamentDetails(t.url);

                if (details && details.location && details.location !== 'N/A') {
                    const payload: any = {
                        ...t,
                        ...details,
                        country,
                        updatedAt: now
                    };

                    // Preserve manually edited fields
                    if (doc.exists) {
                        const currentData = doc.data();
                        const editedFields = currentData?.editedFields || [];

                        if (Array.isArray(editedFields)) {
                            editedFields.forEach((field: string) => {
                                if (currentData && currentData[field] !== undefined) {
                                    payload[field] = currentData[field];
                                }
                            });
                            // Keep the list itself
                            payload.editedFields = editedFields;
                        }
                    }

                    await docRef.set(payload);
                    console.log(`[BACKGROUND-SYNC] Updated ${tournamentId} (${t.name})`);
                }

                // Sleep to be gentle
                await new Promise(r => setTimeout(r, 500));
            }
        }
        console.log(`[BACKGROUND-SYNC] Completed for ${city}`);
    } catch (e) {
        console.error("Background sync error:", e);
    } finally {
        SYNC_LOCKS.delete(lockKey);
    }
}
