"use client";
import { useEffect, useState } from 'react';

export default function BuyMeACoffee() {
    const [showBubble, setShowBubble] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (showBubble) {
            const timer = setTimeout(() => {
                setShowBubble(false);
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [showBubble]);

    useEffect(() => {
        // Handle responsive state for React render matches script logic
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);

        const script = document.createElement('script');
        script.setAttribute('data-name', 'BMC-Widget');
        script.src = '/bmc-widget.js';
        script.setAttribute('data-id', 'gcpmendez');
        script.setAttribute('data-description', 'Support me on Buy me a coffee!');
        script.setAttribute('data-message', '');
        script.setAttribute('data-color', '#40DCA5');
        script.setAttribute('data-position', 'Right');

        // Responsive margins for Widget
        const xMargin = window.innerWidth < 640 ? '18' : '70';
        const yMargin = window.innerWidth < 640 ? '18' : '50';

        script.setAttribute('data-x_margin', xMargin);
        script.setAttribute('data-y_margin', yMargin);
        script.async = true;

        // Check if script already exists
        const existingScript = document.querySelector('script[data-name="BMC-Widget"]');
        if (!existingScript) {
            document.body.appendChild(script);
        }

        return () => {
            window.removeEventListener('resize', checkMobile);
        };
    }, []);

    if (!showBubble) return null;

    return (
        <div
            className={`fixed z-50 transition-all duration-500 ease-out transform origin-bottom-right ${showBubble ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4'
                }`}
            style={{
                right: isMobile ? '18px' : '70px',
                bottom: isMobile ? '100px' : '140px' // Approx widget height (60px) + margin
            }}
        >
            <div className="relative bg-white border-2 border-black text-black px-4 py-3 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-[200px] sm:max-w-xs">
                {/* Close Button */}
                <button
                    onClick={() => setShowBubble(false)}
                    className="absolute -top-2 -left-2 bg-red-400 text-black border border-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-500 transition shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                    ✕
                </button>

                <p className="font-bold text-sm leading-tight">
                    I dedicated my free time to making this website. Hope you like it :)
                </p>

                {/* Comic Tail */}
                <div className="absolute -bottom-[10px] right-6 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-black"></div>
                <div className="absolute -bottom-[6px] right-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white"></div>
            </div>
        </div>
    );
}
