"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
    const pathname = usePathname();

    // Hide footer on the home page (search page)
    if (pathname === "/") {
        return null;
    }

    return (
        <footer className="w-full py-8 text-center text-neutral-500 text-sm bg-neutral-900 border-t border-neutral-800">
            <div className="max-w-2xl mx-auto px-4">
                <p>
                    If you have any suggestions or find any bugs, please email me at{" "}
                    <a
                        href="mailto:chess.calendar.live@gmail.com"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        chess.calendar.live@gmail.com
                    </a>
                </p>
            </div>
        </footer>
    );
}
