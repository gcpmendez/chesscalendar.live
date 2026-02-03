"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import CityCombobox from "./CityCombobox";

interface SearchHistoryItem {
    id: string;
    city: string;
    tempo: string;
    label: string; // Helper for display, e.g. "Madrid (Standard)"
}

export default function ClientHome() {
    const [city, setCity] = useState("");
    const [tempo, setTempo] = useState("");
    const router = useRouter();

    const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('chess_calendar_recent_searches');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Migrate old items or ensure they have IDs
                const verified = parsed.map((item: any) => ({
                    ...item,
                    id: item.id || crypto.randomUUID()
                }));
                setRecentSearches(verified);
            } catch (e) {
                console.error("Failed to parse recent searches", e);
            }
        }
    }, []);

    const addToHistory = (item: Omit<SearchHistoryItem, 'id'>) => {
        setRecentSearches(prev => {
            // Filter duplicates based on content
            const filtered = prev.filter(p =>
                !(p.city === item.city && p.tempo === item.tempo)
            );

            const newItem: SearchHistoryItem = {
                ...item,
                id: crypto.randomUUID()
            };

            const newHistory = [newItem, ...filtered].slice(0, 5);
            localStorage.setItem('chess_calendar_recent_searches', JSON.stringify(newHistory));
            return newHistory;
        });
    };

    const removeFromHistory = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setRecentSearches(prev => {
            const newHistory = prev.filter(p => p.id !== id);
            localStorage.setItem('chess_calendar_recent_searches', JSON.stringify(newHistory));
            return newHistory;
        });
    };

    const getTempoLabel = (t: string) => {
        if (t === "1") return "Standard";
        if (t === "2") return "Rapid";
        if (t === "3") return "Blitz";
        return "All Tempos";
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams();
        params.set("country", "ESP");
        if (city) params.set("city", city);
        if (tempo) params.set("tempo", tempo);

        // Add to history
        const labelCity = city ? city : "All Cities";
        const label = `${labelCity} (${getTempoLabel(tempo)})`;

        addToHistory({
            city,
            tempo,
            label
        });

        router.push(`/tournaments?${params.toString()}`);
    };

    const handleHistoryClick = (item: SearchHistoryItem) => {
        const params = new URLSearchParams();
        params.set("country", "ESP");
        if (item.city) params.set("city", item.city);
        if (item.tempo) params.set("tempo", item.tempo);
        router.push(`/tournaments?${params.toString()}`);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 p-8 font-sans relative transition-colors duration-300">


            <main className="relative flex flex-col items-center gap-4 text-center max-w-2xl w-full">
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[-70px] sm:mb-[-95px] w-[240px] h-[240px] sm:w-[420px] sm:h-[420px] pointer-events-none">
                    <Image
                        src="/logo.png"
                        alt="Chess Calendar"
                        fill
                        className="object-contain drop-shadow-2xl opacity-90 dark:opacity-100"
                        priority
                    />
                </div>
                <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight flex items-start justify-center gap-2 pb-2">
                    <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent inline-block pb-4 -mb-4">
                        Chess Calendar
                    </span>
                    <span className="self-start -mt-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-500 font-bold border border-rose-500/20 text-xs sm:text-base uppercase tracking-widest shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                        Live
                    </span>
                </h1>
                <p className="text-lg text-neutral-600 dark:text-neutral-400">
                    Find the best chess tournaments in Spain.
                </p>

                <form onSubmit={handleSearch} className="w-full max-w-3xl relative mx-auto z-50 group">
                    {/* Glow Effect */}
                    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600/30 to-emerald-600/30 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-500 scale-95 group-hover:scale-105 focus-within:scale-110" />

                    <div className="relative bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-3xl p-4 shadow-2xl flex flex-col md:flex-row gap-4 items-center transition-all duration-300 transform hover:scale-[1.02] focus-within:scale-[1.02] hover:shadow-blue-500/5">



                        {/* City Select */}
                        <CityCombobox value={city} onChange={setCity} />

                        {/* Tempo Select */}
                        <div className="relative w-full md:w-48 group">
                            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider absolute -top-2.5 left-4 bg-white dark:bg-neutral-900 px-1">Tempo</label>
                            <select
                                value={tempo}
                                onChange={(e) => setTempo(e.target.value)}
                                className="w-full bg-transparent border-2 border-neutral-100 dark:border-neutral-800 rounded-xl px-4 py-3 font-semibold text-neutral-900 dark:text-white outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5"
                            >
                                <option value="">All Tempos</option>
                                <option value="1">Standard</option>
                                <option value="2">Rapid</option>
                                <option value="3">Blitz</option>
                            </select>
                            <svg className="w-4 h-4 text-neutral-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>

                        {/* Search Button */}
                        <button
                            type="submit"
                            className="w-full md:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <span>Search</span>
                        </button>
                    </div>
                </form>

                {/* Popular / Recent Searches */}
                {recentSearches.length > 0 && (
                    <div className="w-full mt-6 animate-in fade-in slide-in-from-top-4 duration-500 delay-150">
                        <div className="flex items-center gap-3 mb-3 px-2">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                Popular
                            </span>
                            <div className="h-px flex-1 bg-gradient-to-r from-neutral-200 dark:from-neutral-800 to-transparent"></div>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                            {recentSearches.map((item, idx) => (
                                <button
                                    key={item.id || idx}
                                    onClick={() => handleHistoryClick(item)}
                                    className="group flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/50 rounded-lg hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5 pr-2"
                                >
                                    <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {item.label}
                                    </span>
                                    {/* Delete Button */}
                                    <div
                                        onClick={(e) => removeFromHistory(e, item.id)}
                                        className="ml-1 p-0.5 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/30 text-neutral-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}


            </main>
        </div>
    );
}
