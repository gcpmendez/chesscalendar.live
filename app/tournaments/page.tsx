"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import CityCombobox from "@/components/CityCombobox";

interface Tournament {
    name: string;
    id?: string;
    url: string;
    fed: string;
    start: string;
    end: string;
    tempo: string;
    rounds?: string;
    posterImage?: string;
    location?: string;
    lat?: number;
    lng?: number;
    regulations?: any;
    notes?: string;
    submitterEmail?: string;
}

function TournamentsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const country = searchParams.get("country");
    const city = searchParams.get("city");
    const tempo = searchParams.get("tempo");

    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addFormSubmitting, setAddFormSubmitting] = useState(false);
    const [addFormSuccess, setAddFormSuccess] = useState(false);
    const [addForm, setAddForm] = useState({
        name: "",
        city: "",
        location: "", // URL
        website: "",
        startDate: "",
        endDate: "",
        type: "Standard",
        notes: "",
        submitterEmail: ""
    });

    // Refs for file uploads (Reuse logic from edit)
    const addPosterInputRef = useRef<HTMLInputElement>(null);
    const addRegulationsInputRef = useRef<HTMLInputElement>(null);

    const handleOpenAddModal = () => {
        setIsAddModalOpen(true);
        setAddFormSuccess(false);
        setAddForm({
            name: "",
            city: "",
            location: "",
            website: "",
            startDate: "",
            endDate: "",
            type: "Standard",
            notes: "",
            submitterEmail: ""
        });
    };

    const handleSubmitNewTournament = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddFormSubmitting(true);

        try {
            // Validate required fields
            if (!addForm.name || !addForm.city || !addForm.startDate || !addForm.endDate || !addForm.type) {
                throw new Error("Please fill in all required fields (Name, City, Dates, Time Control)");
            }

            // Convert files to Base64 if present
            let posterBase64 = "";
            let regulationsBase64 = "";

            if (addPosterInputRef.current?.files?.[0]) {
                const file = addPosterInputRef.current.files[0];
                if (file.size > 5 * 1024 * 1024) throw new Error("Poster image too large (max 5MB)");
                posterBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });
            }

            if (addRegulationsInputRef.current?.files?.[0]) {
                const file = addRegulationsInputRef.current.files[0];
                if (file.size > 10 * 1024 * 1024) throw new Error("Regulations PDF too large (max 10MB)");
                regulationsBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });
            }

            const res = await fetch('/api/tournament-submission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: addForm.name,
                    country: "ESP",
                    city: addForm.city,
                    location: addForm.location,
                    website: addForm.website,
                    startDate: addForm.startDate,
                    endDate: addForm.endDate,
                    type: addForm.type,
                    notes: addForm.notes,
                    submitterEmail: addForm.submitterEmail,
                    posterImage: posterBase64,
                    regulations: regulationsBase64
                })
            });

            if (!res.ok) throw new Error("Submission failed");
            setAddFormSuccess(true);
        } catch (err: any) {
            alert("Error submitting tournament: " + err.message);
        } finally {
            setAddFormSubmitting(false);
        }
    };

    useEffect(() => {
        if (!country) {
            router.push("/");
            return;
        }

        const fetchTournaments = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (country) params.append("country", country);
                if (city) params.append("city", city);
                if (tempo) params.append("tempo", tempo || "1");

                const res = await fetch(`/api/tournaments?${params.toString()}`);
                if (!res.ok) throw new Error("Failed to fetch tournaments");
                const data = await res.json();
                setTournaments(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTournaments();
    }, [country, city, tempo, router]);

    // Categorize
    const now = new Date();
    // Reset time to compare dates only
    now.setHours(0, 0, 0, 0);

    const parseDate = (dateStr: string) => {
        // format usually YYYY/MM/DD
        return new Date(dateStr);
    };

    const active: Tournament[] = [];
    const future: Tournament[] = [];
    const past: Tournament[] = [];

    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    tournaments.forEach(t => {
        const start = parseDate(t.start);
        const end = parseDate(t.end);

        // Ensure valid dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

        // Filter out tournaments ending more than 30 days ago
        if (end < thirtyDaysAgo) return;

        if (now >= start && now <= end) {
            active.push(t);
        } else if (now < start) {
            future.push(t);
        } else {
            past.push(t);
        }
    });

    // Sort by date: closest first for future, most recent first for past
    future.sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());
    active.sort((a, b) => parseDate(a.end).getTime() - parseDate(b.end).getTime());
    past.sort((a, b) => parseDate(b.end).getTime() - parseDate(a.end).getTime());


    interface TournamentDetails {
        organizer?: string;
        location?: string;
        city?: string;
        description?: string;
        totalPlayers?: number;
        federationsCount?: number;
        rounds?: string;
        timeControl?: string;
        chiefArbiter?: string;
        avgElo?: string;
        posterImage?: string;
        lat?: number;
        lng?: number;
        schedule?: { round: string; date: string; time?: string }[];
        regulations?: { text: string; url: string };
        topPlayers: {
            name: string;
            title?: string;
            rating?: number;
            fed: string;
        }[];
    }

    const TournamentRow = ({ t }: { t: Tournament }) => {
        const [expanded, setExpanded] = useState(false);
        const [details, setDetails] = useState<TournamentDetails | null>(null);
        const [loadingDetails, setLoadingDetails] = useState(false);

        // Edit modal state
        const [showEditModal, setShowEditModal] = useState(false);
        const [editForm, setEditForm] = useState({
            name: '',
            location: '',
            city: '',
            timeControl: '',
            rounds: '',
            notes: '',
            submitterEmail: ''
        });
        const [submitting, setSubmitting] = useState(false);
        const [submitSuccess, setSubmitSuccess] = useState(false);

        const handleExpand = async () => {
            if (expanded) {
                setExpanded(false);
                return;
            }

            setExpanded(true);
            if (!details) {
                // If it's a manual tournament (has submitterEmail), use local data
                if (t.submitterEmail) {
                    setDetails({
                        location: t.location,
                        timeControl: t.tempo,
                        rounds: t.rounds,
                        description: t.notes,
                        posterImage: t.posterImage,
                        regulations: t.regulations ? { text: 'View Regulations', url: t.regulations } : undefined,
                        topPlayers: [] // Manual tournaments don't have player lists yet
                    });
                    return;
                }

                setLoadingDetails(true);
                try {
                    const res = await fetch(`/api/tournament-details?url=${encodeURIComponent(t.url)}`);
                    if (res.ok) {
                        const data = await res.json();
                        setDetails(data);
                    }
                } catch (err) {
                    console.error("Failed to load details", err);
                } finally {
                    setLoadingDetails(false);
                }
            }
        };

        const openEditModal = () => {
            // Pre-fill with current values
            setEditForm({
                name: t.name,
                location: details?.location || '',
                city: details?.city || '',
                timeControl: details?.timeControl || '',
                rounds: details?.rounds || '',
                notes: '',
                submitterEmail: ''
            });
            setSubmitSuccess(false);
            setShowEditModal(true);
        };

        const posterInputRef = useRef<HTMLInputElement>(null);
        const regulationsInputRef = useRef<HTMLInputElement>(null);

        const handleSubmitEdit = async (e: React.FormEvent) => {
            e.preventDefault();
            setSubmitting(true);

            try {
                const modifications = [];

                if (editForm.name !== t.name) {
                    modifications.push({
                        field: 'name',
                        originalValue: t.name,
                        newValue: editForm.name
                    });
                }
                if (editForm.location !== (details?.location || '')) {
                    modifications.push({
                        field: 'location',
                        originalValue: details?.location || '',
                        newValue: editForm.location
                    });
                }
                if (editForm.city !== (details?.city || '')) {
                    modifications.push({
                        field: 'city',
                        originalValue: details?.city || '',
                        newValue: editForm.city
                    });
                }
                if (editForm.timeControl !== (details?.timeControl || '')) {
                    modifications.push({
                        field: 'timeControl',
                        originalValue: details?.timeControl || '',
                        newValue: editForm.timeControl
                    });
                }
                if (editForm.rounds !== (details?.rounds || '')) {
                    modifications.push({
                        field: 'rounds',
                        originalValue: details?.rounds || '',
                        newValue: editForm.rounds
                    });
                }

                // Handle Poster Upload
                if (posterInputRef.current?.files?.[0]) {
                    const file = posterInputRef.current.files[0];
                    if (file.size > 5 * 1024 * 1024) { // 5MB limit
                        alert('Poster image must be less than 5MB');
                        setSubmitting(false);
                        return;
                    }

                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    });

                    modifications.push({
                        field: 'posterImage',
                        originalValue: '',
                        newValue: base64
                    });
                }

                // Handle Regulations Upload
                if (regulationsInputRef.current?.files?.[0]) {
                    const file = regulationsInputRef.current.files[0];
                    if (file.size > 5 * 1024 * 1024) {
                        alert('Regulations PDF must be less than 5MB');
                        setSubmitting(false);
                        return;
                    }

                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    });

                    modifications.push({
                        field: 'regulations',
                        originalValue: '',
                        newValue: base64
                    });
                }

                if (modifications.length === 0) {
                    alert('No changes detected');
                    setSubmitting(false);
                    return;
                }

                const res = await fetch('/api/tournament-modification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tournamentId: t.url || t.id,
                        tournamentName: t.name,
                        modifications,
                        submitterEmail: editForm.submitterEmail || null,
                        notes: editForm.notes || null
                    })
                });

                if (res.ok) {
                    setSubmitSuccess(true);
                } else {
                    const err = await res.json();
                    alert(err.error || 'Failed to submit');
                }
            } catch (err) {
                console.error('Submit error:', err);
                alert('Failed to submit modification request');
            } finally {
                setSubmitting(false);
            }
        };

        // Parse date to get components for visual display
        const parseDate = (dateStr: string) => {
            const d = new Date(dateStr);
            return {
                day: d.getDate(),
                month: d.toLocaleString('es', { month: 'short' }).toUpperCase(),
                year: d.getFullYear()
            };
        };

        const startDate = parseDate(t.start);
        const endDate = parseDate(t.end);
        const isSameDay = t.start === t.end;

        return (
            <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800 mb-3 overflow-hidden transition-all hover:shadow-md">
                {/* Main Row */}
                <div
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition group"
                    onClick={handleExpand}
                >
                    {/* Date Badge - Eye-catching visual */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                        {/* Start Date */}
                        <div className="flex flex-col items-center justify-center w-14 h-[58px] bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                            <span className="text-xl font-black leading-none text-emerald-600 dark:text-emerald-400">{startDate.day}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500/80 dark:text-emerald-400/80">{startDate.month}</span>
                            <span className="text-[9px] font-medium text-emerald-400/70 dark:text-emerald-500/70">{startDate.year}</span>
                        </div>

                        {!isSameDay && (
                            <>
                                <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                {/* End Date */}
                                <div className="flex flex-col items-center justify-center w-14 h-[58px] bg-gradient-to-br from-rose-500/15 to-rose-500/5 dark:from-rose-500/20 dark:to-rose-500/5 rounded-xl border border-rose-200 dark:border-rose-800/50 shadow-sm">
                                    <span className="text-xl font-black leading-none text-rose-600 dark:text-rose-400">{endDate.day}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500/80 dark:text-rose-400/80">{endDate.month}</span>
                                    <span className="text-[9px] font-medium text-rose-400/70 dark:text-rose-500/70">{endDate.year}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Separator */}
                    <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-700/50 mx-2 hidden sm:block"></div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <a
                                href={t.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="font-bold text-neutral-900 dark:text-gray-100 truncate hover:text-blue-600 dark:hover:text-blue-400 transition"
                            >
                                {t.name}
                            </a>

                            {/* Resource Icons */}
                            <div className="flex items-center gap-1.5 ml-1">
                                {t.posterImage && (
                                    <span title="Poster available" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </span>
                                )}
                                {t.regulations && (
                                    <span title="Regulations available" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </span>
                                )}
                                {t.location && t.location.includes('http') ? (
                                    <span title="Map available" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
                            {(t.tempo || '').toLowerCase().includes('blitz') && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">BLITZ</span>
                            )}
                            {(t.tempo || '').toLowerCase().includes('rapid') && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">RAPID</span>
                            )}
                            {((t.tempo || '').toLowerCase().includes('standard') || (t.tempo || '').toLowerCase().includes('clásico') || (!(t.tempo || '').toLowerCase().includes('blitz') && !(t.tempo || '').toLowerCase().includes('rapid'))) && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">STD</span>
                            )}
                            {(t.rounds || (details?.rounds)) && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    {(t.rounds || details?.rounds)?.replace('Rounds', '')?.replace('Rondas', '')?.trim()} Rds
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Expand button (moved to the right) */}
                    <button className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition shrink-0 opacity-0 group-hover:opacity-100">
                        <svg className={`w-5 h-5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>

                {/* Expanded Details */}
                {expanded && (
                    <div className="border-t border-neutral-100 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-900/30 p-4 md:p-6 animate-in slide-in-from-top-2 fade-in duration-300">
                        {loadingDetails ? (
                            <div className="flex justify-center py-8">
                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : details ? (
                            <div className="flex flex-col gap-8">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                                    {/* Column 1: Poster */}
                                    <div className="flex flex-col gap-4">
                                        <div className="space-y-3">
                                            <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                                                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                Poster
                                            </h4>
                                            {details.posterImage ? (
                                                <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-md">
                                                    <img
                                                        src={details.posterImage}
                                                        alt="Tournament Poster"
                                                        className="w-full h-auto object-cover max-h-[600px]"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="bg-neutral-50 dark:bg-neutral-800/50 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-2 h-64">
                                                    <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Poster not available</p>
                                                    <p className="text-xs text-neutral-400 dark:text-neutral-500">Please use "Suggest Edit" to add one</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Column 2: Regulations */}
                                    <div className="flex flex-col gap-4">
                                        <div className="space-y-3">
                                            <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                                                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                Regulations
                                            </h4>
                                            {details.regulations ? (
                                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 flex flex-col gap-4 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-blue-900 dark:text-blue-100 leading-tight">{details.regulations.text || "Bases de la convocatoria"}</span>
                                                            <span className="text-xs text-blue-700 dark:text-blue-300">Read tournament rules</span>
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={details.regulations.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition shadow-sm text-center"
                                                    >
                                                        View PDF
                                                    </a>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-neutral-500 italic">No regulations document available for this tournament.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Column 3: Location Map */}
                                    <div className="flex flex-col gap-4">
                                        <div className="space-y-3">
                                            <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                                                <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                Location Map
                                            </h4>
                                            {/* Location Display Logic: Prioritize explicit URL > Coordinates > Text Search */}

                                            {/* Smart Map Logic: 
                                                1. If URL contains coordinates/query -> Use it (User Verified)
                                                2. If URL is generic/unparseable -> Show Placeholder (Don't show stale coords)
                                                3. If NO URL but Lat/Lng exist -> Show DB Coords (Automatic/Original)
                                            */}
                                            {(() => {
                                                const url = details.location && details.location.includes('http') ? details.location : null;
                                                let mapSrc = null;

                                                if (url) {
                                                    // Try to extract coords from @lat,lng
                                                    const coordsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                                    // Try to extract query from ?q=...
                                                    const queryMatch = url.match(/[?&]q=([^&]+)/);
                                                    // Try to extract place name from /place/NAME/...
                                                    const placeMatch = url.match(/\/maps\/place\/([^/]+)/);

                                                    if (coordsMatch) {
                                                        mapSrc = `https://www.google.com/maps?q=${coordsMatch[1]},${coordsMatch[2]}&output=embed&z=15`;
                                                    } else if (placeMatch) {
                                                        mapSrc = `https://www.google.com/maps?q=${placeMatch[1]}&output=embed&z=15`;
                                                    }
                                                }

                                                if (mapSrc) {
                                                    return (
                                                        <div className="space-y-3">
                                                            <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-sm h-64 w-full bg-neutral-100 dark:bg-neutral-800">
                                                                <iframe
                                                                    width="100%"
                                                                    height="100%"
                                                                    frameBorder="0"
                                                                    style={{ border: 0 }}
                                                                    src={mapSrc}
                                                                    allowFullScreen
                                                                ></iframe>
                                                            </div>
                                                            <a
                                                                href={url || `https://www.google.com/maps/search/?api=1&query=${details.lat},${details.lng}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition shadow-sm"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                                {url ? 'View Location' : 'Open in Google Maps'}
                                                            </a>
                                                        </div>
                                                    );
                                                } else {
                                                    // Placeholder fallback
                                                    return (
                                                        <div className="space-y-3">
                                                            {url ? (
                                                                <>
                                                                    <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-sm h-64 w-full bg-neutral-100 dark:bg-neutral-800">
                                                                        <div className="w-full h-full flex items-center justify-center bg-blue-50 dark:bg-blue-900/10">
                                                                            <svg className="w-12 h-12 text-blue-300 dark:text-blue-700" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                                                                        </div>
                                                                    </div>
                                                                    <a
                                                                        href={url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition shadow-sm"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                                        View Location
                                                                    </a>
                                                                </>
                                                            ) : (
                                                                <div className="bg-neutral-50 dark:bg-neutral-800/50 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-2 h-64">
                                                                    <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                    <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Map not available</p>
                                                                    <p className="text-xs text-neutral-400 dark:text-neutral-500">Please use "Suggest Edit" to add location</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                            })()}


                                        </div>
                                    </div>
                                </div>

                                {/* Suggest Edit Button */}
                                <div className="flex justify-end pt-4 border-t border-neutral-200 dark:border-neutral-700">
                                    <button
                                        onClick={openEditModal}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30 font-semibold text-sm transition"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        Suggest Edit
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-neutral-500">Details not available.</p>
                        )}
                    </div>
                )}

                {/* Edit Modal */}
                {showEditModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
                        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                            {submitSuccess ? (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Request Submitted!</h3>
                                    <p className="text-neutral-600 dark:text-neutral-400 mb-4">Your modification request has been sent for review.</p>
                                    <button
                                        onClick={() => setShowEditModal(false)}
                                        className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmitEdit}>
                                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        Suggest Edit
                                    </h3>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                                        Suggest corrections or updates for <strong className="text-neutral-900 dark:text-white">{t.name}</strong>
                                    </p>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Tournament Name</label>
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Location (Google Maps Link)</label>
                                            <input
                                                type="url"
                                                value={editForm.location}
                                                onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="https://maps.app.goo.gl/..."
                                            />
                                        </div>

                                        <div>
                                            <CityCombobox
                                                value={editForm.city}
                                                onChange={(val) => setEditForm({ ...editForm, city: val })}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Poster Image</label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                ref={posterInputRef}
                                                className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Regulations (PDF)</label>
                                            <input
                                                type="file"
                                                accept="application/pdf"
                                                ref={regulationsInputRef}
                                                className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Time Control</label>
                                            <input
                                                type="text"
                                                value={editForm.timeControl}
                                                onChange={e => setEditForm({ ...editForm, timeControl: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="e.g., 90 min + 30 seg"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Number of Rounds</label>
                                            <input
                                                type="text"
                                                value={editForm.rounds}
                                                onChange={e => setEditForm({ ...editForm, rounds: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="e.g., 9"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Notes (optional)</label>
                                            <textarea
                                                value={editForm.notes}
                                                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                                rows={3}
                                                className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                                placeholder="Explain your suggested changes..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Your Email (optional)</label>
                                            <input
                                                type="email"
                                                value={editForm.submitterEmail}
                                                onChange={e => setEditForm({ ...editForm, submitterEmail: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="For follow-up questions"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowEditModal(false)}
                                            className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                                        >
                                            {submitting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    Submitting...
                                                </>
                                            ) : 'Submit Request'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const TournamentList = ({ title, list, groupByMonth = false }: { title: string, list: Tournament[], groupByMonth?: boolean }) => {
        if (list.length === 0) return null;

        if (groupByMonth) {
            const groups: { [key: string]: Tournament[] } = {};

            // Helper to get sortable key YYYY-MM
            const getSortKey = (dateStr: string) => {
                const d = new Date(dateStr);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            };

            // Helper to get display label
            const getLabel = (dateStr: string) => {
                const d = new Date(dateStr);
                // Capitalize first letter
                const s = d.toLocaleString('es', { month: 'long', year: 'numeric' });
                return s.charAt(0).toUpperCase() + s.slice(1);
            };

            list.forEach(t => {
                const key = getSortKey(t.start);
                if (!groups[key]) groups[key] = [];
                groups[key].push(t);
            });

            const sortedKeys = Object.keys(groups).sort();

            return (
                <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-xl font-bold mb-4 text-neutral-900 dark:text-white flex items-center gap-3 sticky top-0 bg-slate-50 dark:bg-[#0a0a0a] py-2 z-10 backdrop-blur-sm bg-white/80 dark:bg-neutral-950/80 border-b border-transparent">
                        {title}
                        <span className="text-xs font-bold text-white bg-neutral-900 dark:text-black dark:bg-white px-2 py-1 rounded-full">{list.length}</span>
                    </h2>
                    <div className="flex flex-col gap-8">
                        {sortedKeys.map(key => (
                            <div key={key}>
                                <h3 className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-3 pl-3 border-l-4 border-blue-500">
                                    {getLabel(groups[key][0].start)}
                                </h3>
                                <div className="flex flex-col">
                                    {groups[key].map((t, i) => (
                                        <TournamentRow key={i} t={t} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-bold mb-4 text-neutral-900 dark:text-white flex items-center gap-3 sticky top-0 bg-slate-50 dark:bg-[#0a0a0a] py-2 z-10">
                    {title}
                    <span className="text-xs font-bold text-white bg-neutral-900 dark:text-black dark:bg-white px-2 py-1 rounded-full">{list.length}</span>
                </h2>
                <div className="flex flex-col">
                    {list.map((t, i) => (
                        <TournamentRow key={i} t={t} />
                    ))}
                </div>
            </div>
        );
    };


    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 p-4 sm:p-8 font-sans transition-colors duration-300">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                    <Link href="/" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition flex items-center gap-2 group order-2 sm:order-1">
                        <svg className="w-5 h-5 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        <span className="text-sm sm:text-base font-medium">Search another tournament</span>
                    </Link>
                    <Link href="/" className="hover:opacity-80 transition block w-32 h-32 sm:w-20 sm:h-20 relative order-1 sm:order-2">
                        <Image
                            src="/logo.png"
                            alt="Chess Calendar"
                            fill
                            className="object-contain dark:invert-0"
                        />
                    </Link>
                </div>

                <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                        <h1 className="text-3xl font-black flex items-center gap-3">
                            Tournaments
                        </h1>
                        <button
                            onClick={handleOpenAddModal}
                            className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-2 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Add Tournament
                        </button>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-500 text-sm sm:text-base">
                        <span className="font-bold text-neutral-900 dark:text-white">{country || 'ESP'}</span>
                        <span>• {city || 'All Cities'}</span>
                        <span>• {tempo === '1' ? 'Standard' : tempo === '2' ? 'Rapid' : tempo === '3' ? 'Blitz' : 'All Tempos'}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-neutral-500">Searching chess tournaments...</p>
                    </div>
                ) : error ? (
                    <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-xl p-8 text-center text-rose-600 dark:text-rose-400">
                        <p className="font-bold">Error loading tournaments</p>
                        <p className="text-sm mt-2">{error}</p>
                    </div>
                ) : (
                    <>
                        {active.length === 0 && future.length === 0 && past.length === 0 && (
                            <div className="text-center py-20 bg-white dark:bg-neutral-800/30 rounded-2xl border border-neutral-200 dark:border-neutral-800 border-dashed">
                                <p className="text-lg text-neutral-500 font-medium">No tournaments found with these criteria.</p>
                            </div>
                        )}
                        <TournamentList title="Active Tournaments" list={active} groupByMonth={true} />
                        <TournamentList title="Next Tournaments" list={future} groupByMonth={true} />
                        <TournamentList title="Past Tournaments" list={past} />
                    </>
                )}
            </div>
            {/* Add Tournament Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        {addFormSuccess ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Tournament Submitted!</h3>
                                <p className="text-neutral-600 dark:text-neutral-400 mb-4">Your tournament has been sent for review and will be listed shortly.</p>
                                <button
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmitNewTournament}>
                                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                                    <svg className="w-6 h-6 text-neutral-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Add New Tournament
                                </h3>

                                <div className="space-y-6">
                                    {/* Section 1: Event Details */}
                                    <div className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Basic Info
                                        </h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Tournament Name *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={addForm.name}
                                                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                                                    className="w-full rounded-lg border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                                                    placeholder="e.g. III Open Internacional..."
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div>
                                                    <CityCombobox value={addForm.city} onChange={(val) => setAddForm({ ...addForm, city: val })} />
                                                    {/* We can add a visual label asterisk inside CityCombobox if needed, or wrap it. 
                                                        Currently CityCombobox has its own label. Let's assume user knows city is required or validation catches it.
                                                        Actually, let's wrap it to show validation error state if needed, but simple alert is fine for now. 
                                                        Let's just update the CityCombobox existing label if possible, or add a fake label above it?
                                                        CityCombobox has absolute label. Let's stick to validation check for City.
                                                    */}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Dates & Format */}
                                    <div className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Schedule & Format
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Start Date *</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={addForm.startDate}
                                                    onChange={e => setAddForm({ ...addForm, startDate: e.target.value })}
                                                    className="w-full rounded-lg border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 shadow-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">End Date *</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={addForm.endDate}
                                                    onChange={e => setAddForm({ ...addForm, endDate: e.target.value })}
                                                    className="w-full rounded-lg border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 shadow-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Time Control *</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['Standard', 'Rapid', 'Blitz'].map((type) => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => setAddForm({ ...addForm, type })}
                                                        className={`py-2 px-1 text-sm font-semibold rounded-lg border transition-all ${addForm.type === type
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                                                            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50'
                                                            }`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Links & Media */}
                                    <div className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                            Links & Media
                                        </h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Location Link (Google Maps)</label>
                                                <input
                                                    type="url"
                                                    value={addForm.location}
                                                    onChange={e => setAddForm({ ...addForm, location: e.target.value })}
                                                    className="w-full rounded-lg border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 shadow-sm"
                                                    placeholder="https://maps.google.com/..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Chess-result URL</label>
                                                <input
                                                    type="url"
                                                    value={addForm.website}
                                                    onChange={e => setAddForm({ ...addForm, website: e.target.value })}
                                                    className="w-full rounded-lg border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 shadow-sm"
                                                    placeholder="https://chess-results.com/..."
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                                                <div className="relative">
                                                    <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Poster Image</label>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        ref={addPosterInputRef}
                                                        className="block w-full text-xs text-neutral-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                    />
                                                </div>
                                                <div className="relative">
                                                    <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Regulations PDF</label>
                                                    <input
                                                        type="file"
                                                        accept="application/pdf"
                                                        ref={addRegulationsInputRef}
                                                        className="block w-full text-xs text-neutral-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 mt-6">
                                    <div className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Final Details</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Additional Notes</label>
                                                <textarea
                                                    rows={2}
                                                    value={addForm.notes}
                                                    onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                                                    className="w-full rounded-lg border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 shadow-sm"
                                                    placeholder="Any other details..."
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">Your Email (required)</label>
                                                <input
                                                    type="email"
                                                    required
                                                    value={addForm.submitterEmail}
                                                    onChange={e => setAddForm({ ...addForm, submitterEmail: e.target.value })}
                                                    className="w-full rounded-lg border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 shadow-sm"
                                                    placeholder="We'll notify you when it's added"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="px-4 py-2 text-neutral-600 dark:text-neutral-400 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={addFormSubmitting}
                                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-emerald-600 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {addFormSubmitting ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Sending...
                                            </>
                                        ) : (
                                            'Submit Tournament'
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TournamentsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-neutral-50 dark:bg-neutral-900 flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        }>
            <TournamentsContent />
        </Suspense>
    );
}
