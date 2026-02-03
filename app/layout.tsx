import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chess Calendar - Live",
  description: "Track real-time FIDE rating changes",
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

import BuyMeACoffee from "@/components/BuyMeACoffee";
import Footer from "@/components/Footer";
import ThemeToggle from "@/components/ThemeToggle";

import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <GoogleAnalytics gaId="G-34RKHXCDKY" />
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50 dark:bg-neutral-900 transition-colors duration-700 ease-in-out`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          <div className="flex-grow">
            {children}
          </div>
          <Footer />
          <BuyMeACoffee />
          <div className="fixed top-4 right-4 sm:top-[50px] sm:right-[70px] z-50">
            <ThemeToggle />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
