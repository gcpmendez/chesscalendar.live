"use client";
import { useState, useEffect } from 'react';

export default function BuyMeACoffeeCustom() {
    const [showBubble, setShowBubble] = useState(false);

    useEffect(() => {
        // Show message after a small delay
        const timer = setTimeout(() => {
            setShowBubble(true);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">

            {/* Message Bubble */}
            <div
                className={`
                    relative bg-neutral-900/80 backdrop-blur-md border border-neutral-700/50 
                    text-neutral-200 p-4 rounded-2xl shadow-2xl max-w-xs
                    transition-all duration-500 transform origin-bottom-right
                    ${showBubble ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4 pointer-events-none'}
                `}
            >
                <button
                    onClick={() => setShowBubble(false)}
                    className="absolute -top-2 -left-2 bg-neutral-800 text-neutral-400 hover:text-white rounded-full p-1 border border-neutral-700 w-6 h-6 flex items-center justify-center transition"
                >
                    &times;
                </button>
                <p className="text-sm font-medium leading-relaxed">
                    I dedicated my free time to making this website. <span className="text-amber-400 font-bold">Hope you like it! :)</span>
                </p>
                <div className="absolute -bottom-2 right-6 w-4 h-4 bg-neutral-900/80 border-r border-b border-neutral-700/50 transform rotate-45"></div>
            </div>

            {/* Floating Button */}
            <a
                href="https://www.buymeacoffee.com/gcpmendez"
                target="_blank"
                rel="noreferrer"
                className="group relative flex items-center justify-center w-14 h-14 bg-[#FFDD00] hover:bg-[#FFEA55] rounded-full shadow-lg hover:shadow-amber-400/20 transition-all duration-300 transform hover:scale-110 active:scale-95"
                onMouseEnter={() => setShowBubble(true)}
            >
                {/* Coffee Icon (Simple SVG) */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-7 h-7 text-black stroke-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                    {/* Actually let's use a proper Coffee Cup path */}
                    <path d="M0 0h24v24H0z" stroke="none" fill="none" />
                </svg>
                {/* Custom Coffee Cup Icon Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-8 h-8 text-black" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2,21H20V19H2M20,8H18V5H20M20,3H4V13A4,4 0 0,0 8,17H14A4,4 0 0,0 18,13V10H20A2,2 0 0,0 22,8V5C22,3.89 21.1,3 20,3Z" />
                    </svg>
                </div>

                <span className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition text-[10px] font-bold bg-black/80 text-white px-2 py-0.5 rounded whitespace-nowrap pointer-events-none">
                    Support Me
                </span>
            </a>
        </div>
    );
}
