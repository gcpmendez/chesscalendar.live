
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from 'next/link';

interface ScrapedProfile {
    name: string;
    std: number;
    rapid: number;
    blitz: number;
    fed?: string;
    born?: number;
    sex?: string;
    title?: string;
    maxStd?: number;
}

interface TournamentChange {
    name: string;
    change: number;
    kFactor: number;
    dateStr?: string;
    startDate?: string;
    endDate?: string;
    url: string;
    lastUpdate?: string;
    games?: {
        round: string;
        opponentName: string;
        opponentRating: number | null;
        result: string;
        change: number;
    }[];
    ratingType?: 'standard' | 'rapid' | 'blitz';
    isPending?: boolean;
}

interface PlayerData {
    profile: ScrapedProfile;
    history: { date: string, rating: number | null, rapid: number | null, blitz: number | null }[];
    activeTournaments: TournamentChange[];
    pendingTournaments: TournamentChange[];
    nextTournaments: TournamentChange[];
    liveRating: number;
    liveRapid: number;
    liveBlitz: number;
    totalChange: number;
    rapidChange: number;
    blitzChange: number;
    isStale?: boolean;
}

export default function PlayerPage() {
    const { id } = useParams();
    const [data, setData] = useState<PlayerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isStale, setIsStale] = useState(false);

    const fetchData = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        else setIsRefreshing(true);

        try {
            const res = await fetch(`/api/player/${id}?t=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to fetch');
            }
            const d = await res.json();
            setData(d);
            setIsStale(d.isStale || false);
        } catch (e: any) {
            if (!isBackground) setError(e.message);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (!id) return;
        fetchData();
    }, [id]);

    // Polling effect: if data is stale, check every 5 seconds
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isStale && !isRefreshing) {
            interval = setInterval(() => {
                fetchData(true);
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isStale, isRefreshing, id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center font-sans">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Loading Profile</p>
                        <p className="text-neutral-500 text-sm animate-pulse">Fetching global chess data...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center gap-4 font-sans p-4 text-center">
                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-2 border border-rose-500/20">
                    <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Oops! Something went wrong</h2>
                <p className="text-neutral-400 max-w-md">{error}</p>
                <div className="flex gap-4 mt-4">
                    <button onClick={() => fetchData()} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                        Try Again
                    </button>
                    <Link href="/" className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold transition-all">
                        Go Home
                    </Link>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { profile, activeList, pendingList, nextList, liveRating, liveRapid, liveBlitz, totalChange, rapidChange, blitzChange } = (() => {
        const activeList = data.activeTournaments || [];
        const pendingList = data.pendingTournaments || [];
        const nextList = data.nextTournaments || [];
        return { ...data, activeList, pendingList, nextList };
    })();

    const toggleExpand = (tourneyName: string) => {
        const next = new Set(expandedTournaments);
        if (next.has(tourneyName)) next.delete(tourneyName);
        else next.add(tourneyName);
        setExpandedTournaments(next);
    };

    const parseDate = (dateStr?: string) => {
        if (!dateStr) return null;
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return null;
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            return {
                day: d.getDate().toString().padStart(2, '0'),
                month: months[d.getMonth()],
                year: d.getFullYear()
            };
        } catch { return null; }
    };

    const DateBadge = ({ start, end }: { start?: string, end?: string }) => {
        const s = parseDate(start);
        const e = parseDate(end);
        if (!s && !e) return null;
        const isSameDay = start === end;

        return (
            <div className="flex-shrink-0 flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5">
                {s && (
                    <div className="flex flex-col items-center justify-center w-12 sm:w-14 h-[50px] sm:h-[58px] bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                        <span className="text-lg sm:text-xl font-black leading-none text-emerald-600 dark:text-emerald-400">{s.day}</span>
                        <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-emerald-500/80 dark:text-emerald-400/80">{s.month}</span>
                        <span className="text-[8px] sm:text-[9px] font-medium text-emerald-400/70 dark:text-emerald-500/70">{s.year}</span>
                    </div>
                )}
                {e && (
                    <>
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-neutral-400 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <div className="flex flex-col items-center justify-center w-12 sm:w-14 h-[50px] sm:h-[58px] bg-gradient-to-br from-rose-500/15 to-rose-500/5 dark:from-rose-500/20 dark:to-rose-500/5 rounded-xl border border-rose-200 dark:border-rose-800/50 shadow-sm">
                            <span className="text-lg sm:text-xl font-black leading-none text-rose-600 dark:text-rose-400">{e.day}</span>
                            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-rose-500/80 dark:text-rose-400/80">{e.month}</span>
                            <span className="text-[8px] sm:text-[9px] font-medium text-rose-400/70 dark:text-rose-500/70">{e.year}</span>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-neutral-950 font-sans pb-20">
            {/* Syncing Badge */}
            {isRefreshing && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
                    <div className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-blue-200 dark:border-blue-800/50 px-4 py-2 rounded-full shadow-2xl flex items-center gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-widest uppercase">Syncing Live Data...</span>
                    </div>
                </div>
            )}

            {/* Header / Stats Section */}
            <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 pt-12 pb-12 shadow-sm relative overflow-hidden">
                <div className="max-w-6xl mx-auto px-4 relative z-10">
                    <Link href="/" className="inline-flex items-center text-sm font-bold text-neutral-500 hover:text-blue-600 transition mb-8 uppercase tracking-widest gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Search
                    </Link>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-black tracking-[0.2em] uppercase rounded-full">FIDE Profile</span>
                                {profile.title && (
                                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-black tracking-[0.2em] uppercase rounded-full">{profile.title}</span>
                                )}
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-neutral-900 dark:text-white tracking-tight leading-none mb-4">{profile.name}</h1>
                            <div className="flex items-center gap-6 text-neutral-500 font-bold uppercase tracking-wider text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-neutral-400 font-medium tracking-normal">Federation</span>
                                    {profile.fed}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-neutral-400 font-medium tracking-normal">Born</span>
                                    {profile.born || 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 md:gap-6 bg-neutral-50 dark:bg-neutral-800/50 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800">
                            {[
                                { label: 'Standard', live: liveRating, base: profile.std, change: totalChange },
                                { label: 'Rapid', live: liveRapid, base: profile.rapid, change: rapidChange },
                                { label: 'Blitz', live: liveBlitz, base: profile.blitz, change: blitzChange }
                            ].map((stat, idx) => (
                                <div key={idx} className="flex flex-col items-center">
                                    <span className="text-[10px] font-black tracking-widest text-neutral-400 dark:text-neutral-500 uppercase mb-2">{stat.label}</span>
                                    <div className="flex flex-col items-center">
                                        <span className="text-2xl md:text-3xl font-black text-neutral-900 dark:text-white leading-none">{stat.live || stat.base || '-'}</span>
                                        {stat.change !== 0 && (
                                            <span className={`text-[10px] font-black mt-1 ${stat.change > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {stat.change > 0 ? '+' : ''}{stat.change.toFixed(1)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-12">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Main Content: Tournament Lists */}
                    <div className="flex-1 space-y-12">
                        {/* Pending Tournaments List */}
                        {pendingList.length > 0 && (
                            <div>
                                <h2 className="text-2xl font-black mb-6 text-neutral-900 dark:text-white flex items-center gap-3 tracking-tight">
                                    Waiting for FIDE Rating
                                    <span className="text-[10px] font-bold text-white bg-amber-500 px-2 py-1 rounded-full tracking-widest uppercase shadow-sm">Pending</span>
                                </h2>
                                <div className="space-y-3">
                                    {pendingList.map((t, i) => (
                                        <div key={i} className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col sm:flex-row sm:items-center gap-4 group transition-all hover:border-amber-200 dark:hover:border-amber-900/50 shadow-sm">
                                            <DateBadge start={t.startDate} end={t.endDate} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {t.ratingType && (
                                                        <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-[8px] font-black uppercase tracking-widest rounded">{t.ratingType}</span>
                                                    )}
                                                    <span className="text-xs text-neutral-400 font-mono">Last updated: {t.lastUpdate ? new Date(t.lastUpdate).toLocaleDateString() : 'N/A'}</span>
                                                </div>
                                                <a
                                                    href={t.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-lg font-semibold text-neutral-900 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition break-words leading-snug block"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {t.name}
                                                </a>
                                            </div>
                                            <div className="flex items-center gap-4 self-end sm:self-center">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xl font-black text-emerald-500 leading-none">
                                                        {t.change > 0 ? '+' : ''}{t.change.toFixed(1)}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Pending</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Active Tournaments List */}
                        <div>
                            <h2 className="text-2xl font-black mb-6 text-neutral-900 dark:text-white flex items-center gap-3 tracking-tight">
                                Current Live Rating
                                <span className="text-[10px] font-bold text-white bg-blue-600 px-2 py-1 rounded-full tracking-widest uppercase shadow-sm">Active</span>
                            </h2>
                            {activeList.length > 0 ? (
                                <div className="space-y-4">
                                    {activeList.map((t, i) => (
                                        <div
                                            key={i}
                                            onClick={() => toggleExpand(t.name)}
                                            className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden cursor-pointer hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300"
                                        >
                                            <div className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
                                                <DateBadge start={t.startDate} end={t.endDate} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {t.ratingType && (
                                                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase tracking-widest rounded">{t.ratingType}</span>
                                                        )}
                                                        <span className="text-xs text-neutral-400 font-mono">ID: {t.url.split('tnr=')[1]?.split('&')[0] || 'N/A'}</span>
                                                    </div>
                                                    <a
                                                        href={t.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-lg font-semibold text-neutral-900 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition break-words leading-snug block"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {t.name}
                                                    </a>
                                                </div>
                                                <div className="flex items-center gap-6 self-end sm:self-center">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`text-2xl font-black leading-none ${t.change > 0 ? 'text-emerald-500' : t.change < 0 ? 'text-rose-500' : 'text-neutral-400'}`}>
                                                            {t.change > 0 ? '+' : ''}{t.change.toFixed(1)}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Live Var</span>
                                                    </div>
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-transform duration-300 ${expandedTournaments.has(t.name) ? 'rotate-180 bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700' : 'bg-neutral-50 dark:bg-neutral-800/30 border-neutral-100 dark:border-neutral-800'}`}>
                                                        <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {expandedTournaments.has(t.name) && t.games && (
                                                <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/20 p-4 md:p-6 animate-in slide-in-from-top-4 duration-300">
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left text-sm">
                                                            <thead>
                                                                <tr className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                                                                    <th className="pb-4 pl-2">Rd</th>
                                                                    <th className="pb-4">Opponent</th>
                                                                    <th className="pb-4">Elo</th>
                                                                    <th className="pb-4 text-center">Res</th>
                                                                    <th className="pb-4 text-right pr-2">Change</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                                                {t.games.map((g, gi) => (
                                                                    <tr key={gi} className="group hover:bg-neutral-100/50 dark:hover:bg-neutral-800/30 transition-colors">
                                                                        <td className="py-3 pl-2 font-mono text-neutral-400 text-xs">{g.round}</td>
                                                                        <td className="py-3 font-bold text-neutral-700 dark:text-neutral-300">{g.opponentName}</td>
                                                                        <td className="py-3 font-mono text-neutral-500 text-xs">{g.opponentRating || '-'}</td>
                                                                        <td className="py-3 text-center">
                                                                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black ${g.result === '1' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : g.result === '0' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'}`}>
                                                                                {g.result === '1' ? 'W' : g.result === '0' ? 'L' : 'D'}
                                                                            </span>
                                                                        </td>
                                                                        <td className={`py-3 text-right pr-2 font-black ${g.change > 0 ? 'text-emerald-500' : g.change < 0 ? 'text-rose-500' : 'text-neutral-400'}`}>
                                                                            {g.change > 0 ? '+' : ''}{g.change.toFixed(1)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 p-12 text-center">
                                    <p className="text-neutral-500 font-bold">No active tournaments found for current period.</p>
                                </div>
                            )}
                        </div>

                        {/* Next Tournaments List */}
                        {nextList.length > 0 && (
                            <div>
                                <h2 className="text-2xl font-black mb-6 text-neutral-900 dark:text-white flex items-center gap-3 tracking-tight">
                                    Tournament Calendar
                                    <span className="text-[10px] font-bold text-white bg-neutral-900 dark:bg-white dark:text-black px-2 py-1 rounded-full tracking-widest uppercase">Next</span>
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {nextList.map((t, i) => (
                                        <div key={i} className="bg-white dark:bg-neutral-900/40 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex items-center gap-5 group hover:border-blue-400 transition-all shadow-sm">
                                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                                                <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <a
                                                    href={t.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-lg font-semibold text-neutral-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition break-words leading-snug block"
                                                >
                                                    {t.name}
                                                </a>
                                                <span className="text-[10px] font-black tracking-widest text-neutral-400 uppercase">Registered</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar: History / Extra Info */}
                    <div className="lg:w-80 space-y-8">
                        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
                            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-widest mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-4">Rating History</h3>
                            <div className="space-y-4">
                                {data.history && data.history.slice(0, 12).map((item, hi) => (
                                    <div key={hi} className="flex justify-between items-center group">
                                        <span className="text-xs font-bold text-neutral-400 uppercase tabular-nums">{item.date}</span>
                                        <span className="text-sm font-black text-neutral-600 dark:text-neutral-300 group-hover:text-blue-500 transition-colors tabular-nums">{item.rating || '-'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20">
                            <h3 className="font-black text-lg mb-2 uppercase tracking-tight">Stay Updated</h3>
                            <p className="text-blue-100 text-sm font-bold leading-relaxed mb-6">Our live rating scanner updates these numbers directly from FIDE and Chess-Results sources every hour.</p>
                            <Link href="/" className="block w-full py-3 bg-white text-blue-600 rounded-xl font-black text-center text-sm shadow-lg hover:bg-neutral-50 transition-all active:scale-95 uppercase tracking-widest">
                                Search New Player
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
