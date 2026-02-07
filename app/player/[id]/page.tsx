"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import RatingChart from "@/components/RatingChart";


interface GameResult {
    round: string;
    opponentName: string;
    opponentRating: number | null;
    result: string;
    change: number;
}

interface Tournament {
    name: string;
    change: number;
    url: string;
    ratingType?: 'standard' | 'rapid' | 'blitz';
    games?: GameResult[];
    startDate?: string;
    endDate?: string;
    rounds?: string;
}

interface RatingHistoryItem {
    date: string;
    rating: number | null;
    rapid: number | null;
    blitz: number | null;
}

interface PlayerData {
    profile: {
        name: string;
        std: number;
        rapid: number;
        blitz: number;
        fed?: string;
        born?: number;
        sex?: string;
        title?: string;
    };
    tournaments: Tournament[]; // Active
    pendingTournaments?: Tournament[]; // Pending
    nextTournaments?: Tournament[]; // Next
    activeTournaments?: Tournament[]; // Explicit Active
    history?: RatingHistoryItem[];
    liveRating: number;
    liveRapid: number;
    liveBlitz: number;
    totalChange: number;
    rapidChange: number;
    blitzChange: number;
}

export default function PlayerPage() {
    const { id } = useParams();
    const [data, setData] = useState<PlayerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!id) return;

        fetch(`/api/player/${id}`, { cache: 'no-store' })
            .then(async (res) => {
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to fetch');
                }
                return res.json();
            })
            .then((d) => {
                setData(d);
                setLoading(false);
            })
            .catch((e) => {
                setError(e.message);
                setLoading(false);
            });
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-4 w-48 bg-neutral-800 rounded mb-4"></div>
                    <p className="text-neutral-500">Calculating Live Ratings...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center gap-4">
                <p className="text-red-400 text-xl">Error: {error}</p>
                <Link href="/" className="px-4 py-2 bg-neutral-800 rounded hover:bg-neutral-700 transition">
                    Go Back
                </Link>
            </div>
        );
    }

    if (!data) return null;

    // For now we assume all changes affect Standard rating unless we parse otherwise.
    // In the future we should distinguish rating types in the scraper.
    const { profile, tournaments, activeTournaments, pendingTournaments, nextTournaments, liveRating, liveRapid, liveBlitz, totalChange, rapidChange, blitzChange } = data;

    // Use explicit list if available, fallback to 'tournaments' (which might be mixed if API wasn't updated, but we updated it)
    const activeList = activeTournaments || tournaments;
    const pendingList = pendingTournaments || [];
    const nextList = nextTournaments || [];

    // Use API values


    const RatingCard = ({ title, live, official, change, color }: { title: string, live: number, official: number, change: number, color: 'blue' | 'emerald' | 'yellow' }) => {
        const colorMap = {
            blue: {
                border: 'hover:border-blue-500/30',
                glow: 'from-blue-500/10',
                bar: 'bg-blue-500'
            },
            emerald: {
                border: 'hover:border-emerald-500/30',
                glow: 'from-emerald-500/10',
                bar: 'bg-emerald-500'
            },
            yellow: {
                border: 'hover:border-yellow-500/30',
                glow: 'from-yellow-500/10',
                bar: 'bg-yellow-500'
            }
        };

        const theme = colorMap[color];

        return (
            <div className={`bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700 relative overflow-hidden group ${theme.border} transition-all duration-700 ease-in-out hover:duration-200 shadow-xl dark:shadow-none`}>
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${theme.glow} to-transparent rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none`}></div>

                <div className="flex items-center gap-2 mb-4">
                    <span className={`w-1 h-4 ${theme.bar} rounded-full`}></span>
                    <h3 className="text-neutral-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider">{title}</h3>
                </div>

                <div className="flex flex-col gap-1 mb-6">
                    <span className="text-sm text-neutral-500 dark:text-gray-500 font-medium">Live Rating</span>
                    <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-extrabold text-neutral-900 dark:text-white">{live.toFixed(1)}</span>
                        {change !== 0 && (
                            <span className={`text-lg font-bold ${change > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                {change > 0 ? '+' : ''}{change.toFixed(1)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 dark:border-neutral-700/50 flex justify-between items-center bg-neutral-50 dark:bg-neutral-900/40 -mx-6 -mb-6 px-6 py-4">
                    <span className="text-sm text-neutral-500 dark:text-gray-400">Official</span>
                    <span className="text-lg font-mono font-bold text-neutral-700 dark:text-gray-200">{official}</span>
                </div>
            </div>
        );
    };

    const toggleTournament = (name: string) => {
        setExpandedTournaments(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const parseDateHelper = (dateStr?: string) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return {
            day: d.getDate(),
            month: d.toLocaleString('es', { month: 'short' }).toUpperCase(),
            year: d.getFullYear()
        };
    };

    const DateBadge = ({ start, end }: { start?: string, end?: string }) => {
        if (!start && !end) return null;
        const s = parseDateHelper(start);
        const e = parseDateHelper(end);
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
        <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 p-4 sm:p-8 font-sans transition-colors duration-300">
            <div className="max-w-5xl mx-auto">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-12">
                    <Link href="/" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition flex items-center gap-2 group order-2 sm:order-1">
                        <svg className="w-5 h-5 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        <span className="text-sm sm:text-base font-medium">Search another player</span>
                    </Link>
                    <Link href="/" className="hover:opacity-80 transition block w-32 h-32 sm:w-40 sm:h-40 relative order-1 sm:order-2">
                        <Image
                            src="/logo.png"
                            alt="Chess Calendar"
                            fill
                            className="object-contain dark:invert-0"
                        />
                    </Link>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
                    <div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-start gap-1 flex-wrap">
                                <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-neutral-900 dark:text-white tracking-tight leading-tight">{profile.name}</h1>
                                {profile.title && (
                                    <span className="self-start -mt-2 ml-2 px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 font-bold border border-yellow-500/20 text-xs md:text-sm shadow-glow-sm">
                                        {profile.title}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-4 text-neutral-500 dark:text-neutral-400 font-mono text-sm md:text-base flex-wrap">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    FIDE ID: {id}
                                </div>

                                {profile.fed && (
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm dark:shadow-none">
                                        <span className="text-neutral-400 dark:text-neutral-500">FED:</span>
                                        <span className="text-neutral-700 dark:text-white font-bold">{profile.fed}</span>
                                    </div>
                                )}

                                {profile.born && (
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm dark:shadow-none">
                                        <span className="text-neutral-400 dark:text-neutral-500">BORN:</span>
                                        <span className="text-neutral-700 dark:text-white font-bold">{profile.born}</span>
                                    </div>
                                )}

                                {profile.sex && (
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm dark:shadow-none">
                                        <span className="text-neutral-400 dark:text-neutral-500">SEX:</span>
                                        <span className="text-neutral-700 dark:text-white font-bold">{profile.sex}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ratings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <RatingCard title="Classical" live={liveRating} official={profile.std} change={totalChange} color="blue" />
                    <RatingCard title="Rapid" live={liveRapid} official={profile.rapid} change={rapidChange} color="emerald" />
                    <RatingCard title="Blitz" live={liveBlitz} official={profile.blitz} change={blitzChange} color="yellow" />
                </div>

                {/* Rating Chart */}
                {data.history && data.history.length > 0 && (
                    <div className="mb-12">
                        <RatingChart data={data.history} />
                    </div>
                )}

                {/* Past Tournaments List */}
                {pendingList.length > 0 && (
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-6 text-neutral-900 dark:text-white flex items-center gap-3">
                            Past Tournaments
                            <span className="text-xs font-bold text-white bg-neutral-900 dark:text-black dark:bg-white px-2 py-1 rounded-full">{pendingList.length}</span>
                        </h2>
                        <div className="grid gap-6">
                            {pendingList.map((t, i) => {
                                const isExpanded = expandedTournaments.has(t.name);
                                const hasGames = !!(t.games && t.games.filter(g => g.change !== 0).length > 0);

                                return (
                                    <div
                                        key={i}
                                        className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm dark:shadow-none transition-all duration-300 relative group"
                                    >
                                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-[10px] font-bold text-amber-600 dark:text-amber-400 rounded-b-lg border-b border-x border-amber-200 dark:border-amber-800/50 shadow-sm z-10">
                                            PENDING FIDE
                                        </div>
                                        <div
                                            className={`p-4 sm:p-5 flex justify-between items-center gap-4 transition-colors ${hasGames ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02]' : ''}`}
                                            onClick={() => hasGames && toggleTournament(t.name)}
                                        >
                                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                                <DateBadge start={t.startDate} end={t.endDate} />
                                                <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-700/50 mx-2 hidden sm:block"></div>
                                                <div className="min-w-0 flex-1">
                                                    <a
                                                        href={t.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-lg font-semibold text-neutral-900 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition break-words leading-snug block"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {t.name}
                                                    </a>
                                                    <div className="mt-1 text-sm text-neutral-500 flex items-center gap-2">
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800 tracking-wider uppercase">Live</span>
                                                        {t.ratingType === 'rapid' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">RAPID</span>}
                                                        {t.ratingType === 'blitz' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">BLITZ</span>}
                                                        {(t.ratingType === 'standard' || !t.ratingType) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">STD</span>}
                                                        {t.rounds && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 flex items-center gap-1">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                                {t.rounds.replace('Rounds', '')?.replace('Rondas', '')?.trim()} Rds
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {hasGames && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTournament(t.name);
                                                        }}
                                                        className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition shrink-0 opacity-0 group-hover:opacity-100"
                                                        title={isExpanded ? "Collapse" : "Expand"}
                                                    >
                                                        <svg
                                                            className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>
                                                )}
                                                <div className={`px-4 py-2 rounded-lg font-mono font-bold text-lg min-w-[80px] text-center ${t.change >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                                                    {t.change > 0 ? '+' : ''}{t.change}
                                                </div>
                                            </div>
                                        </div>

                                        {hasGames && isExpanded && (
                                            <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 animate-in slide-in-from-top-2 duration-300">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-sm">
                                                        <thead>
                                                            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase text-xs">
                                                                <th className="px-6 py-3 font-medium">Rd</th>
                                                                <th className="px-6 py-3 font-medium">Opponent</th>
                                                                <th className="px-6 py-3 font-medium">Rtg</th>
                                                                <th className="px-6 py-3 font-medium">Res</th>
                                                                <th className="px-6 py-3 font-medium text-right">Chg</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                                                            {t.games?.filter(g => g.change !== 0).map((g, gi) => (
                                                                <tr key={gi} className="hover:bg-white dark:hover:bg-neutral-800/50 transition">
                                                                    <td className="px-6 py-3 text-neutral-400">{g.round}</td>
                                                                    <td className="px-6 py-3 font-medium text-neutral-700 dark:text-neutral-300">{g.opponentName}</td>
                                                                    <td className="px-6 py-3 text-neutral-400">{g.opponentRating || '-'}</td>
                                                                    <td className="px-6 py-3">
                                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${g.result === '1' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                                                            g.result === '0' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' :
                                                                                'bg-gray-500/20 text-gray-500 dark:text-gray-400'
                                                                            }`}>
                                                                            {g.result}
                                                                        </span>
                                                                    </td>
                                                                    <td className={`px-6 py-3 text-right font-mono font-bold ${g.change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                        {g.change > 0 ? '+' : ''}{g.change}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Active Tournaments List */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold mb-6 text-neutral-900 dark:text-white flex items-center gap-3">
                        Active Tournaments
                        {activeList.length > 0 && <span className="text-xs font-bold text-white bg-neutral-900 dark:text-black dark:bg-white px-2 py-1 rounded-full">{activeList.length}</span>}
                    </h2>

                    {activeList.length === 0 ? (
                        <div className="bg-white dark:bg-neutral-900/50 p-12 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                            <p className="text-neutral-500 text-lg">No active tournament rating changes found.</p>
                            <p className="text-neutral-400 dark:text-neutral-600 text-sm mt-2">Check back later for updates.</p>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {activeList.map((t, i) => {
                                const isExpanded = expandedTournaments.has(t.name);
                                const hasGames = !!(t.games && t.games.filter(g => g.change !== 0).length > 0);

                                return (
                                    <div
                                        key={i}
                                        className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm dark:shadow-none transition-all duration-300 relative group"
                                    >
                                        <div
                                            className={`p-4 sm:p-5 flex justify-between items-center gap-4 transition-colors ${hasGames ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/[0.02]' : ''}`}
                                            onClick={() => hasGames && toggleTournament(t.name)}
                                        >
                                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                                <DateBadge start={t.startDate} end={t.endDate} />
                                                <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-700/50 mx-2 hidden sm:block"></div>
                                                <div className="min-w-0 flex-1">
                                                    <a
                                                        href={t.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-lg font-semibold text-neutral-900 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition break-words leading-snug block"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {t.name}
                                                    </a>
                                                    <div className="mt-1 text-sm text-neutral-500 flex items-center gap-2">
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800 tracking-wider uppercase">Live</span>
                                                        {t.ratingType === 'rapid' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">RAPID</span>}
                                                        {t.ratingType === 'blitz' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">BLITZ</span>}
                                                        {(t.ratingType === 'standard' || !t.ratingType) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">STD</span>}
                                                        {t.rounds && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 flex items-center gap-1">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                                {t.rounds.replace('Rounds', '')?.replace('Rondas', '')?.trim()} Rds
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {hasGames && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTournament(t.name);
                                                        }}
                                                        className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition shrink-0 opacity-0 group-hover:opacity-100"
                                                        title={isExpanded ? "Collapse" : "Expand"}
                                                    >
                                                        <svg
                                                            className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>
                                                )}
                                                <div className={`px-4 py-2 rounded-lg font-mono font-bold text-lg min-w-[80px] text-center ${t.change >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                                                    {t.change > 0 ? '+' : ''}{t.change}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Games Table */}
                                        {hasGames && isExpanded && (
                                            <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 animate-in slide-in-from-top-2 duration-300">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-sm">
                                                        <thead>
                                                            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase text-xs">
                                                                <th className="px-6 py-3 font-medium">Rd</th>
                                                                <th className="px-6 py-3 font-medium">Opponent</th>
                                                                <th className="px-6 py-3 font-medium">Rtg</th>
                                                                <th className="px-6 py-3 font-medium">Res</th>
                                                                <th className="px-6 py-3 font-medium text-right">Chg</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                                                            {t.games?.filter(g => g.change !== 0).map((g, gi) => (
                                                                <tr key={gi} className="hover:bg-white dark:hover:bg-neutral-800/50 transition">
                                                                    <td className="px-6 py-3 text-neutral-400">{g.round}</td>
                                                                    <td className="px-6 py-3 font-medium text-neutral-700 dark:text-neutral-300">{g.opponentName}</td>
                                                                    <td className="px-6 py-3 text-neutral-400">{g.opponentRating || '-'}</td>
                                                                    <td className="px-6 py-3">
                                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${g.result === '1' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                                                            g.result === '0' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' :
                                                                                'bg-gray-500/20 text-gray-500 dark:text-gray-400'
                                                                            }`}>
                                                                            {g.result}
                                                                        </span>
                                                                    </td>
                                                                    <td className={`px-6 py-3 text-right font-mono font-bold ${g.change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                        {g.change > 0 ? '+' : ''}{g.change}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Next Tournaments List */}
                {nextList.length > 0 && (
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-6 text-neutral-900 dark:text-white flex items-center gap-3">
                            Next Tournaments
                            <span className="text-xs font-bold text-white bg-neutral-900 dark:text-black dark:bg-white px-2 py-1 rounded-full">{nextList.length}</span>
                        </h2>
                        <div className="grid gap-4">
                            {nextList.map((t, i) => (
                                <div key={i} className="bg-white dark:bg-neutral-800/30 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 flex justify-between items-center group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300 shadow-sm dark:shadow-none">
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <DateBadge start={t.startDate} end={t.endDate} />
                                        <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-700/50 mx-2 hidden sm:block"></div>
                                        <div className="min-w-0 flex-1">
                                            <a
                                                href={t.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-lg font-semibold text-neutral-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition break-words leading-snug block"
                                            >
                                                {t.name}
                                            </a>
                                            <div className="mt-1 flex items-center gap-2">
                                                <span className="text-xs text-neutral-500 font-mono">Registered</span>
                                                {t.ratingType === 'rapid' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">RAPID</span>}
                                                {t.ratingType === 'blitz' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">BLITZ</span>}
                                                {(t.ratingType === 'standard' || !t.ratingType) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">STD</span>}
                                                {t.rounds && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                        {t.rounds.replace('Rounds', '')?.replace('Rondas', '')?.trim()} Rds
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <svg className="w-5 h-5 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
