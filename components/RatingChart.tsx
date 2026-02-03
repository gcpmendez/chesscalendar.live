"use client";

import { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTheme } from 'next-themes';

interface RatingHistoryItem {
    date: string;
    rating: number | null;
    rapid: number | null;
    blitz: number | null;
}

interface RatingChartProps {
    data: RatingHistoryItem[];
}

type TimeRange = '1y' | '2y' | '5y' | 'all';

// Helper to parse "YYYY-MMM" e.g. "2023-Jan"
const parseDate = (dateStr: string): Date => {
    const parts = dateStr.split('-');
    if (parts.length !== 2) return new Date();
    // Recharts data usually comes from FIDE JSON as YYYY-MMM.
    // Date constructor handles "Jan 1, 2023" well.
    return new Date(`${parts[1]} 1, ${parts[0]}`);
};

export default function RatingChart({ data }: RatingChartProps) {
    const [range, setRange] = useState<TimeRange>('all');
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];
        if (range === 'all') return data;

        const now = new Date();
        const cutoff = new Date();

        switch (range) {
            case '1y': cutoff.setFullYear(now.getFullYear() - 1); break;
            case '2y': cutoff.setFullYear(now.getFullYear() - 2); break;
            case '5y': cutoff.setFullYear(now.getFullYear() - 5); break;
        }

        return data.filter(item => {
            const d = parseDate(item.date);
            return d >= cutoff;
        });
    }, [data, range]);

    if (!data || data.length === 0) return null;

    // Filter out null/0 values for min/max calculation to avoid skewing the chart
    const allRatings = filteredData.flatMap(d => [d.rating, d.rapid, d.blitz].filter((r): r is number => r !== null && r > 0));
    const minRating = allRatings.length > 0 ? Math.min(...allRatings) : 0;
    const maxRating = allRatings.length > 0 ? Math.max(...allRatings) : 2000;

    // Add some padding to domain
    const domainMin = Math.max(0, minRating - 50);
    const domainMax = maxRating + 50;

    const isDark = !mounted || resolvedTheme === 'dark';
    const axisColor = isDark ? '#333' : '#e5e5e5';
    const tickColor = isDark ? '#555' : '#9ca3af';

    const CustomDot = (props: any) => {
        const { cx, cy, payload, stroke } = props;
        if (!cx || !cy) return null;

        const date = parseDate(payload.date);
        const month = date.getMonth(); // 0 = Jan, 6 = Jul

        // Show dot only for Jan (0) and Jul (6)
        if (month === 0 || month === 6) {
            return (
                <circle cx={cx} cy={cy} r={3} stroke={stroke} strokeWidth={2} fill={isDark ? "#000" : "#fff"} />
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[380px] sm:h-[480px] bg-white dark:bg-[#0c0c0c] rounded-2xl sm:rounded-[2.5rem] border border-neutral-200 dark:border-white/[0.05] p-0 relative overflow-hidden shadow-xl dark:shadow-2xl transition-colors duration-700 ease-in-out">
            {/* Decorative subtle glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/[0.03] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/[0.02] rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none"></div>

            <div className="flex flex-wrap items-center justify-between gap-4 mb-2 p-6 sm:p-8 pb-0 relative z-10">
                <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
                    Rating Progress
                </h3>

                <div className="flex bg-neutral-100 dark:bg-neutral-900/60 p-1 rounded-xl sm:rounded-2xl border border-neutral-200 dark:border-white/[0.03] backdrop-blur-3xl overflow-x-auto no-scrollbar">
                    {(['1y', '2y', '5y', 'all'] as TimeRange[]).map((r) => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 sm:px-5 py-1.5 sm:py-2 text-[9px] sm:text-[10px] whitespace-nowrap font-black rounded-lg sm:rounded-xl transition-all duration-500 ease-out tracking-tight ${range === r
                                ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-lg'
                                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300'
                                }`}
                        >
                            {r === 'all' ? 'HISTORIAL' : r.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-full h-[250px] sm:h-[330px] relative mt-2 sm:mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData} margin={{ top: 0, right: -1, left: 10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorStd" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorRapid" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorBlitz" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#eab308" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="0" stroke={isDark ? "#ffffff03" : "#00000005"} vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke={axisColor}
                            tick={{ fontSize: 9, fontWeight: 700, fill: tickColor }}
                            tickMargin={15}
                            minTickGap={45}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            domain={[domainMin, domainMax]}
                            stroke={axisColor}
                            tick={{ fontSize: 9, fontWeight: 700, fill: tickColor }}
                            tickFormatter={(value) => `${value}`}
                            axisLine={false}
                            tickLine={false}
                            orientation="right"
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? '#000' : '#fff',
                                border: isDark ? '1px solid #222' : '1px solid #e5e5e5',
                                borderRadius: '14px',
                                padding: '12px 16px',
                                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)',
                                backdropFilter: 'blur(5px)'
                            }}
                            itemStyle={{ padding: '3px 0', fontSize: '13px', fontWeight: 800 }}
                            labelStyle={{ color: isDark ? '#444' : '#999', fontSize: '9px', fontWeight: 900, marginBottom: '10px', letterSpacing: '0.15em' }}
                            cursor={{ stroke: isDark ? '#1a1a1a' : '#f5f5f5', strokeWidth: 2 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="rating"
                            name="Standard"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorStd)"
                            activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
                            dot={<CustomDot />}
                            connectNulls
                            animationDuration={1500}
                        />
                        <Area
                            type="monotone"
                            dataKey="rapid"
                            name="Rapid"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorRapid)"
                            activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
                            dot={<CustomDot />}
                            connectNulls
                            animationDuration={1800}
                        />
                        <Area
                            type="monotone"
                            dataKey="blitz"
                            name="Blitz"
                            stroke="#eab308"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorBlitz)"
                            activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
                            dot={<CustomDot />}
                            connectNulls
                            animationDuration={2100}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
