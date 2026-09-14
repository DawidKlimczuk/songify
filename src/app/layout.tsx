import type { Metadata, Viewport } from "next";
import { Rubik_Wet_Paint } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import BottomNav from "@/components/navigation/BottomNav";
import MiniPlayer from "@/components/player/MiniPlayer";
import FullPlayer from "@/components/player/FullPlayer";
import AudioEngine from "@/components/player/AudioEngine";
import AddToPlaylistModal from "@/components/player/AddToPlaylistModal";

const rubikDrip = Rubik_Wet_Paint({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-drip",
});

export const metadata: Metadata = {
  title: "Songify",
  description: "Twoja ulubiona muzyka zawsze z Tobą",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Songify",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#090e11",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const pwaAndThemeScript = `
  try {
    const savedTheme = localStorage.getItem('songify_theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  } catch (e) {}

  if ('serviceWorker' in navigator) {
    if (document.readyState === 'complete') {
      navigator.serviceWorker.register('/sw.js').catch(function(e) { console.error('SW error:', e); });
    } else {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').catch(function(e) { console.error('SW error:', e); });
      });
    }
  }
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={rubikDrip.variable} suppressHydrationWarning>
      <head>
        {/* Jawne linki gwarantujące rozpoznanie PWA przez silnik Blink / Chrome */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />

        <Script
          id="pwa-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: pwaAndThemeScript }}
        />
      </head>
      <body className="bg-[#090e11] text-white antialiased select-none">
        <div className="mx-auto flex min-h-screen max-w-md flex-col relative overflow-hidden">
          <AudioEngine />
          {children}
          <FullPlayer />
          <AddToPlaylistModal />
          <MiniPlayer />
          <BottomNav />
        </div>
      </body>
    </html>
  );
}