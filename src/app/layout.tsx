import type { Metadata, Viewport } from "next";
import { Rubik_Wet_Paint } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import BottomNav from "@/components/navigation/BottomNav";
import MiniPlayer from "@/components/player/MiniPlayer";
import FullPlayer from "@/components/player/FullPlayer";
import AudioEngine from "@/components/player/AudioEngine";
import AddToPlaylistModal from "@/components/player/AddToPlaylistModal";
import PwaRegister from "@/components/PwaRegister";
import InstallPrompt from "@/components/InstallPrompt";

const rubikDrip = Rubik_Wet_Paint({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-drip",
});

export const metadata: Metadata = {
  title: "Songify",
  description: "Twoja ulubiona muzyka zawsze z Tobą",
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

const themeScript = `
  try {
    const savedTheme = localStorage.getItem('songify_theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  } catch (e) {}
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
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="bg-[#090e11] text-white antialiased select-none">
        <PwaRegister />
        <InstallPrompt />
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