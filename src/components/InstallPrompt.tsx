"use client";

import { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Sprawdzamy czy aplikacja już działa w trybie PWA (standalone)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone;

    if (isStandalone) return;

    // Wykrywanie iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    if (isAppleDevice) {
      setIsIOS(true);
      // Pokazujemy baner dla iOS jeśli użytkownik jeszcze nie zainstalował
      const dismissed = sessionStorage.getItem("pwa_prompt_dismissed");
      if (!dismissed) setIsVisible(true);
      return;
    }

    // Wykrywanie Android / Chromium (zdarzenie beforeinstallprompt)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem("pwa_prompt_dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-2 left-3 right-3 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#131d21]/95 p-3.5 backdrop-blur-md border border-pink-500/30 shadow-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/icon-192.png"
            alt="Songify Logo"
            className="h-10 w-10 rounded-xl object-cover border border-pink-500/40 shadow-sm flex-shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-white tracking-wide truncate">
              Zainstaluj Songify
            </span>
            <span className="text-[10px] text-gray-300 truncate">
              {isIOS
                ? "Dotknij Udostępnij i 'Do ekranu początkowego'"
                : "Szybki dostęp i odtwarzanie w tle"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isIOS ? (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-95 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Instaluj</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-medium text-pink-400 bg-pink-500/10 px-2 py-1 rounded-lg border border-pink-500/20">
              <Share className="h-3 w-3" />
            </div>
          )}

          <button
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}