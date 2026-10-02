import type { Metadata, Viewport } from "next";
import { Rubik_Wet_Paint } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import BottomNav from "@/components/navigation/BottomNav";
import MiniPlayer from "@/components/player/MiniPlayer";
import FullPlayer from "@/components/player/FullPlayer";
import AudioEngine from "@/components/player/AudioEngine";
import ConnectSyncEngine from "@/components/player/ConnectSyncEngine";
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

  console.log(
    "%c☕ Songify Dev Info%c\\njak już tu dotarłeś to możesz docenić pracę i wysłać 10zł na kawę\\n%cPaypal: dklimczuk898@gmail.com",
    "color: #14b8a6; font-size: 15px; font-weight: bold;",
    "color: #e2e8f0; font-size: 12px; margin-top: 4px;",
    "color: #38bdf8; font-size: 12px; font-weight: bold; background: #0e1619; padding: 3px 6px; border-radius: 4px; border: 1px solid #134e4a;"
  );
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
          <ConnectSyncEngine />
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