"use client";

import { useState, useRef, useEffect, useMemo } from "react";

interface CityComboboxProps {
    value: string;
    onChange: (val: string) => void;
}

const SPANISH_CITIES = [
    // Special Island Requests
    { label: "Santa Cruz de Tenerife", value: "Santa Cruz de Tenerife" },
    { label: "Las Palmas de Gran Canaria", value: "Las Palmas de Gran Canaria" },

    // Mainland Provincial Capitals & Major Cities
    { label: "A Coruña", value: "A Coruña" },
    { label: "Albacete", value: "Albacete" },
    { label: "Alicante", value: "Alicante" },
    { label: "Almería", value: "Almería" },
    { label: "Ávila", value: "Ávila" },
    { label: "Badajoz", value: "Badajoz" },
    { label: "Barcelona", value: "Barcelona" },
    { label: "Bilbao", value: "Bilbao" },
    { label: "Burgos", value: "Burgos" },
    { label: "Cáceres", value: "Cáceres" },
    { label: "Cádiz", value: "Cádiz" },
    { label: "Castellón", value: "Castellón" },
    { label: "Ceuta", value: "Ceuta" },
    { label: "Ciudad Real", value: "Ciudad Real" },
    { label: "Córdoba", value: "Córdoba" },
    { label: "Cuenca", value: "Cuenca" },
    { label: "Girona", value: "Girona" },
    { label: "Gijón", value: "Gijón" },
    { label: "Granada", value: "Granada" },
    { label: "Guadalajara", value: "Guadalajara" },
    { label: "Huelva", value: "Huelva" },
    { label: "Huesca", value: "Huesca" },
    { label: "Jaén", value: "Jaén" },
    { label: "León", value: "León" },
    { label: "Lleida", value: "Lleida" },
    { label: "Logroño", value: "Logroño" },
    { label: "Lugo", value: "Lugo" },
    { label: "Madrid", value: "Madrid" },
    { label: "Málaga", value: "Málaga" },
    { label: "Melilla", value: "Melilla" },
    { label: "Murcia", value: "Murcia" },
    { label: "Ourense", value: "Ourense" },
    { label: "Oviedo", value: "Oviedo" },
    { label: "Palencia", value: "Palencia" },
    { label: "Pamplona", value: "Pamplona" },
    { label: "Pontevedra", value: "Pontevedra" },
    { label: "Salamanca", value: "Salamanca" },
    { label: "San Sebastián", value: "San Sebastián" },
    { label: "Santander", value: "Santander" },
    { label: "Segovia", value: "Segovia" },
    { label: "Sevilla", value: "Sevilla" },
    { label: "Soria", value: "Soria" },
    { label: "Tarragona", value: "Tarragona" },
    { label: "Teruel", value: "Teruel" },
    { label: "Toledo", value: "Toledo" },
    { label: "Valencia", value: "Valencia" },
    { label: "Valladolid", value: "Valladolid" },
    { label: "Vigo", value: "Vigo" },
    { label: "Vitoria", value: "Vitoria" },
    { label: "Zamora", value: "Zamora" },
    { label: "Zaragoza", value: "Zaragoza" },
];

export default function CityCombobox({ value, onChange }: CityComboboxProps) {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial label logic
    useEffect(() => {
        const found = SPANISH_CITIES.find(c => c.value === value);
        if (found) setQuery(found.label);
        else if (!value) setQuery("");
    }, [value]);

    const filteredCities = useMemo(() => {
        if (!query) return SPANISH_CITIES;
        const lower = query.toLowerCase();
        return SPANISH_CITIES.filter(c =>
            c.label.toLowerCase().includes(lower)
        );
    }, [query]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // Reset query to match selected value if invalid input
                const found = SPANISH_CITIES.find(c => c.value === value);
                if (found) setQuery(found.label);
                else if (!value) setQuery(""); // Allow clearing?
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [value]);

    const handleSelect = (cityValue: string, cityLabel: string) => {
        onChange(cityValue);
        setQuery(cityLabel);
        setIsOpen(false);
    };

    return (
        <div className="relative w-full md:flex-1 group" ref={containerRef}>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider absolute -top-2.5 left-4 bg-white dark:bg-neutral-900 px-1 z-10">
                City
            </label>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                        if (e.target.value === "") onChange("");
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="All Cities"
                    className="w-full bg-transparent border-2 border-neutral-100 dark:border-neutral-800 rounded-xl px-4 py-3 font-semibold text-neutral-900 dark:text-white outline-none focus:border-blue-500 transition-colors placeholder-neutral-400"
                />
                <svg className="w-4 h-4 text-neutral-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700/50 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-200">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault(); // Prevent form submit
                            handleSelect("", "");
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors text-neutral-500 font-medium border-b border-neutral-100 dark:border-neutral-700/50"
                    >
                        All Cities
                    </button>
                    {filteredCities.map((city) => (
                        <button
                            key={city.value}
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                handleSelect(city.value, city.label);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors font-semibold ${value === city.value ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10' : 'text-neutral-700 dark:text-neutral-200'}`}
                        >
                            {city.label}
                        </button>
                    ))}
                    {filteredCities.length === 0 && (
                        <div className="px-4 py-3 text-neutral-400 text-sm text-center">
                            No cities found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
