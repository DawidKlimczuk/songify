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
    icon: "/icon.svg",
    apple: "/icon.svg",
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
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Rejestracja Service Workera nie powiodła się:', err);
      });
    });
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