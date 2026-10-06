"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePlayerStore } from "@/lib/store/player-store";
import { toggleLikeTrack, isTrackLiked, addSongToPlaylist, updateSongCover, overrideYouTubeTrack, savePlainLyricsToDb, updateSongLyrics } from "@/app/actions/playlist";
import { sendConnectCommand } from "@/components/player/ConnectSyncEngine";
import {
  MoreVertical,
  Disc3,
  AlertTriangle,
  ChevronDown,
  Heart,
  Shuffle,
  ArrowRight,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Share2,
  FolderPlus,
  Loader2,
  Repeat,
  Repeat1,
  Check,
  FileText,
  ListMusic,
  Music2,
  X,
  GripVertical,
  Trash2,
  ListPlus,
  Volume2,
  Moon,
  Laptop,
  Link as LinkIcon,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useDeviceStore } from "@/lib/store/device-store";
import DevicePickerModal from "./DevicePickerModal";
import { useJamStore } from "@/lib/store/jam-store";

interface LyricLine {
  time: number;
  text: string;
}

function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split("\n");
  const result: LyricLine[] = [];
  const timeExp = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;

  for (const line of lines) {
    const match = timeExp.exec(line);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] || "0";
      const ms = parseFloat(`0.${msStr}`);
      const time = min * 60 + sec + ms;
      const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, "").trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

function YoutubeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#FF0000"
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
      />
      <polygon fill="#FFFFFF" points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  );
}

function JamJarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="7" y="2" width="10" height="3" rx="1" />
      <path d="M6 5h12" />
      <path d="M5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8z" />
      <path d="M8 12h8" />
      <path d="M9 15h6" />
    </svg>
  );
}

export default function FullPlayer() {
  const {
    currentTrack,
    isPlaying,
    isPlayerExpanded,
    isLiked,
    isShuffle,
    currentTime,
    duration,
    isLoadingAudio,
    youtubeUrl,
    setPlayerExpanded,
    togglePlay,
    setIsLiked,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    nextTrack,
    previousTrack,
    seekTo,
    queue,
    setCurrentTrack,
    reorderQueue,
    removeFromQueue,
    playNextInQueue,
    setAddToPlaylistOpen,
    sleepTimerEndsAt,
    sleepTimerMode,
    setSleepTimer,
  } = usePlayerStore();

  const { setDevicePickerOpen, activeDeviceId, deviceId } = useDeviceStore();
  const isPlayingRemotely = Boolean(activeDeviceId && activeDeviceId !== deviceId);
  const { isJamModalOpen, setJamModalOpen, jamCode } = useJamStore();
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [remainingTimerText, setRemainingTimerText] = useState<string | null>(null);
  const [selectedWheelMinutes, setSelectedWheelMinutes] = useState<number>(30);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [scrubbingTime, setScrubbingTime] = useState<number | null>(null);

  // --- LYRICS & DYNAMIC COLOR STATES ---
  const [lyricsData, setLyricsData] = useState<{
    synced: LyricLine[] | null;
    plain: string | null;
  }>({ synced: null, plain: null });
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [dominantRgb, setDominantRgb] = useState<string>("24, 34, 40");
  const [scrollOpacity, setScrollOpacity] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardLyricsRef = useRef<HTMLDivElement>(null);
  const fullLyricsRef = useRef<HTMLDivElement>(null);

  // Ekstrakcja koloru z okładki (zabezpieczona przed białymi/jasnymi tłami)
  useEffect(() => {
    if (!currentTrack?.albumCover) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = currentTrack.albumCover;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 30;
        canvas.height = 30;
        ctx.drawImage(img, 0, 0, 30, 30);
        const data = ctx.getImageData(0, 0, 30, 30).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Konwersja RGB na HSL
        const rn = r / 255, gn = g / 255, bn = b / 255;
        const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
            case gn: h = (bn - rn) / d + 2; break;
            case bn: h = (rn - gn) / d + 4; break;
          }
          h /= 6;
        }

        // Zabezpieczenie: jeśli tło jest blade lub jasne, obniżamy jasność
        s = Math.max(s, 0.65);
        l = Math.min(Math.max(l, 0.14), 0.22);

        // Powrót do RGB
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const finalR = Math.round(hue2rgb(p, q, h + 1/3) * 255);
        const finalG = Math.round(hue2rgb(p, q, h) * 255);
        const finalB = Math.round(hue2rgb(p, q, h - 1/3) * 255);

        setDominantRgb(`${finalR}, ${finalG}, ${finalB}`);
      } catch {
        setDominantRgb("24, 34, 40");
      }
    };
  }, [currentTrack?.albumCover]);

  // Pobieranie tekstu z LRCLIB
  useEffect(() => {
    if (!currentTrack?.title || !currentTrack?.artist) {
      setLyricsData({ synced: null, plain: null });
      return;
    }

    let isMounted = true;
    setIsLoadingLyrics(true);

    const cleanTitle = currentTrack.title
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/feat\..*$/gi, "")
      .replace(/ft\..*$/gi, "")
      .trim();

    const cleanArtist = currentTrack.artist.split(/[,;&/]/)[0].trim();
    const durSec = Math.round(duration || currentTrack.duration || 0);

    const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}${durSec > 0 ? `&duration=${durSec}` : ""}`;

    fetch(url, {
      headers: { "User-Agent": "SongifyClient/1.0" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.syncedLyrics) {
          setLyricsData({
            synced: parseLrc(data.syncedLyrics),
            plain: data.plainLyrics || null,
          });
          // Zapis czystego tekstu w tle do bazy
          const textToSave = data.plainLyrics || data.syncedLyrics;
          savePlainLyricsToDb(currentTrack.title, currentTrack.artist || "", textToSave);
        } else if (data?.plainLyrics) {
          setLyricsData({ synced: null, plain: data.plainLyrics });
          // Zapis czystego tekstu w tle do bazy
          savePlainLyricsToDb(currentTrack.title, currentTrack.artist || "", data.plainLyrics);
        } else {
          setLyricsData({ synced: null, plain: null });
        }
      })
      .catch(() => {
        if (isMounted) setLyricsData({ synced: null, plain: null });
      })
      .finally(() => {
        if (isMounted) setIsLoadingLyrics(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id, duration]);

  // Indeks aktualnej linijki
  const activeLineIndex = useMemo(() => {
    if (!lyricsData.synced || lyricsData.synced.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lyricsData.synced.length; i++) {
      if (currentTime >= lyricsData.synced[i].time) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [lyricsData.synced, currentTime]);

  // Auto-scroll aktywny WYŁĄCZNIE w małej karcie pod playerem
  useEffect(() => {
    if (activeLineIndex < 0) return;

    // Gdy tryb pełnoekranowy jest otwarty, nie ściągamy widoku użytkownika
    if (isLyricsExpanded) return;

    if (cardLyricsRef.current) {
      const activeEl = cardLyricsRef.current.querySelector(`[data-index="${activeLineIndex}"]`) as HTMLElement;
      if (activeEl) {
        const container = cardLyricsRef.current;
        const targetTop = activeEl.offsetTop - container.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
        container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      }
    }
  }, [activeLineIndex, isLyricsExpanded]);

  // Zanikanie napisu "Dostępny tekst" przy scrollu
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const opacity = Math.max(0, 1 - top / 90);
    setScrollOpacity(opacity);
  };

  useEffect(() => {
    if (!sleepTimerEndsAt || sleepTimerMode !== "time") {
      setRemainingTimerText(null);
      return;
    }

    const updateTimer = () => {
      const diffMs = sleepTimerEndsAt - Date.now();
      if (diffMs <= 0) {
        setRemainingTimerText(null);
      } else {
        const mins = Math.ceil(diffMs / 60000);
        setRemainingTimerText(`${mins}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 5000);
    return () => clearInterval(interval);
  }, [sleepTimerEndsAt, sleepTimerMode]);

  useEffect(() => {
    if (isSleepModalOpen && wheelRef.current) {
      const itemHeight = 44;
      wheelRef.current.scrollTop = (selectedWheelMinutes - 1) * itemHeight;
    }
  }, [isSleepModalOpen]);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [swipedItem, setSwipedItem] = useState<{
    idx: number;
    startX: number;
    startY: number;
    currentX: number;
    isLockedVertical?: boolean;
    isLockedHorizontal?: boolean;
    isMouseDown?: boolean;
  } | null>(null);

  const [animatingHeart, setAnimatingHeart] = useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAddedSuccess, setQuickAddedSuccess] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isReloadCoverModalOpen, setIsReloadCoverModalOpen] = useState(false);
  const [isReloadingCover, setIsReloadingCover] = useState(false);

  const [isCustomCoverModalOpen, setIsCustomCoverModalOpen] = useState(false);
  const [customCoverUrl, setCustomCoverUrl] = useState("");
  const [isSavingCustomCover, setIsSavingCustomCover] = useState(false);
  const [customCoverError, setCustomCoverError] = useState<string | null>(null);

  const handleSaveCustomCover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrack || isSavingCustomCover) return;

    const trimmedUrl = customCoverUrl.trim();
    if (!trimmedUrl) {
      setCustomCoverError("Wklej bezpośredni link do grafiki.");
      return;
    }

    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      setCustomCoverError("Link musi zaczynać się od https:// lub http://");
      return;
    }

    setIsSavingCustomCover(true);
    setCustomCoverError(null);

    try {
      await updateSongCover(currentTrack.id, trimmedUrl);
      const updated = { ...currentTrack, albumCover: trimmedUrl };
      setCurrentTrack(updated);
      setIsCustomCoverModalOpen(false);
      setCustomCoverUrl("");
    } catch (err) {
      console.error("Błąd zapisu własnej okładki:", err);
      setCustomCoverError("Nie udało się zapisać okładki w bazie danych.");
    } finally {
      setIsSavingCustomCover(false);
    }
  };

  const [isCustomYtModalOpen, setIsCustomYtModalOpen] = useState(false);
  const [customYtUrl, setCustomYtUrl] = useState("");
  const [isSavingCustomYt, setIsSavingCustomYt] = useState(false);
  const [customYtError, setCustomYtError] = useState<string | null>(null);
  // Stany dla własnego tekstu
  const [isCustomLyricsModalOpen, setIsCustomLyricsModalOpen] = useState(false);
  const [customLyricsText, setCustomLyricsText] = useState("");
  const [isSavingCustomLyrics, setIsSavingCustomLyrics] = useState(false);

  const extractYouTubeId = (url: string): string | null => {
    const clean = url.trim();
    if (clean.length === 11 && !clean.includes("/") && !clean.includes(".")) {
      return clean;
    }
    const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const handleSaveCustomYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrack || isSavingCustomYt) return;

    const videoId = extractYouTubeId(customYtUrl);
    if (!videoId) {
      setCustomYtError("Wklej poprawny link do filmu YouTube (np. https://www.youtube.com/watch?v=...).");
      return;
    }

    setIsSavingCustomYt(true);
    setCustomYtError(null);

    try {
      await overrideYouTubeTrack(currentTrack.title, currentTrack.artist || "", videoId);
      const updatedTrack = {
        ...currentTrack,
        youtubeId: videoId,
        _forcedTimestamp: Date.now(),
      };
      setCurrentTrack(updatedTrack);
      seekTo(0);
      setIsCustomYtModalOpen(false);
      setCustomYtUrl("");
    } catch (err: any) {
      console.error("Błąd zapisu YouTube linku:", err);
      setCustomYtError(err.message || "Błąd podczas zapisywania linku w bazie.");
    } finally {
      setIsSavingCustomYt(false);
    }
  };

  useEffect(() => {
    if (currentTrack?.id) {
      isTrackLiked(currentTrack.id, currentTrack.title, currentTrack.artist).then((liked) => {
        setIsLiked(liked);
      });
    }
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, setIsLiked]);

  const handleSaveCustomLyrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrack || isSavingCustomLyrics) return;

    const trimmed = customLyricsText.trim();
    if (!trimmed) return;

    setIsSavingCustomLyrics(true);
    try {
      await updateSongLyrics(currentTrack.title, currentTrack.artist || "", trimmed);

      const isSynced = /\[\d{2}:\d{2}/.test(trimmed);
      if (isSynced) {
        setLyricsData({
          synced: parseLrc(trimmed),
          plain: trimmed.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, "").trim(),
        });
      } else {
        setLyricsData({
          synced: null,
          plain: trimmed,
        });
      }

      setIsCustomLyricsModalOpen(false);
      setCustomLyricsText("");
    } catch (err) {
      console.error("Błąd zapisu tekstu:", err);
    } finally {
      setIsSavingCustomLyrics(false);
    }
  };

  const handleLikeClick = async () => {
    if (!currentTrack) return;
    setAnimatingHeart(true);
    setTimeout(() => setAnimatingHeart(false), 500);

    const nextState = !isLiked;
    setIsLiked(nextState);

    sendConnectCommand({
      type: "SET_LIKED",
      trackId: currentTrack.id,
      isLiked: nextState,
    });

    try {
      const res = await toggleLikeTrack({
        id: String(currentTrack.id),
        title: currentTrack.title,
        artist: currentTrack.artist,
        albumCover: currentTrack.albumCover,
        duration: currentTrack.duration,
      });
      setIsLiked(res.liked);

      if (res.liked !== nextState) {
        sendConnectCommand({
          type: "SET_LIKED",
          trackId: currentTrack.id,
          isLiked: res.liked,
        });
      }
    } catch (err) {
      console.error("Błąd zapisu polubienia:", err);
      setIsLiked(!nextState);
      sendConnectCommand({
        type: "SET_LIKED",
        trackId: currentTrack.id,
        isLiked: !nextState,
      });
    }
  };

  useEffect(() => {
    const hasCover = Boolean(currentTrack?.albumCover && currentTrack.albumCover.trim() !== "");
    if (!currentTrack || hasCover) return;

    let isMounted = true;
    const cleanTitle = (currentTrack.title || "")
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/feat\..*$/gi, "")
      .replace(/ft\..*$/gi, "")
      .trim();

    const cleanArtist = (currentTrack.artist || "").split(/[,;&/]/)[0].trim();

    fetch(`/api/deezer/cover?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.cover) {
          const updated = { ...currentTrack, albumCover: data.cover };
          setCurrentTrack(updated);
          updateSongCover(currentTrack.id, data.cover).catch(() => {});
        }
      })
      .catch((err) => console.error("Błąd pobierania okładki:", err));

    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id]);

  const handleForceReloadCover = async () => {
    if (!currentTrack || isReloadingCover) return;
    setIsReloadingCover(true);

    try {
      const cleanTitle = (currentTrack.title || "")
        .replace(/\(.*?\)/g, "")
        .replace(/\[.*?\]/g, "")
        .replace(/feat\..*$/gi, "")
        .replace(/ft\..*$/gi, "")
        .trim();

      const fullArtist = (currentTrack.artist || "").trim();
      const trackAlbum = (
        (currentTrack as any).album?.title ||
        (currentTrack as any).album ||
        (currentTrack as any).albumName ||
        ""
      ).trim();

      const queryParams = new URLSearchParams({
        title: cleanTitle,
        artist: fullArtist,
        album: trackAlbum,
        t: String(Date.now()),
      });

      const res = await fetch(`/api/deezer/cover?${queryParams.toString()}`, {
        cache: "no-store",
      });
      const data = res.ok ? await res.json() : null;

      const nextCover = typeof data?.cover === "string" ? data.cover : "";
      const updated = { ...currentTrack, albumCover: nextCover };
      setCurrentTrack(updated);
      await updateSongCover(currentTrack.id, nextCover);

      setIsReloadCoverModalOpen(false);
    } catch (err) {
      console.error("Błąd wymuszenia okładki:", err);
    } finally {
      setIsReloadingCover(false);
    }
  };

  if (!isPlayerExpanded || !currentTrack) return null;

  const handleShare = async () => {
    const shareUrl = youtubeUrl || window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentTrack.title,
          text: `Posłuchaj ${currentTrack.title} - ${currentTrack.artist} na Songify!`,
          url: shareUrl,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("Skopiowano link do schowka!");
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isLongTitle = currentTrack.title.length > 20;
  const isLongArtist = (currentTrack.artist || "").length > 26;
  const artistLoopDuration = Math.max(16, Math.round((currentTrack.artist || "").length * 0.38 + 6));
  const titleLoopDuration = Math.max(12, Math.round(currentTrack.title.length * 0.4 + 5));
  const displayedTime = scrubbingTime !== null ? scrubbingTime : currentTime;
  const progressPercent = duration > 0 ? (displayedTime / duration) * 100 : 0;

  const hasLyrics = Boolean(lyricsData.synced || lyricsData.plain);
  const currentLiveLine = activeLineIndex >= 0 && lyricsData.synced ? lyricsData.synced[activeLineIndex].text : "";

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="fixed inset-0 z-50 overflow-y-auto bg-[#090e11] text-white animate-in slide-in-from-bottom duration-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      {/* Dynamiczny Ambient Glow */}
      {currentTrack.albumCover && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 h-[65vh] overflow-hidden z-0"
          style={{
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 45%, rgba(0,0,0,0.2) 75%, transparent 100%)",
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 45%, rgba(0,0,0,0.2) 75%, transparent 100%)",
          }}
        >
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 h-[120%] w-[140%] max-w-2xl opacity-60 blur-3xl transition-all duration-700"
            style={{
              backgroundImage: `url(${currentTrack.albumCover})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        </div>
      )}

      {/* GŁÓWNY EKRAN ODTWARZACZA */}
      <div className="relative z-10 flex min-h-screen flex-col justify-between px-6 pt-4 pb-4">
        {/* Górny pasek */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPlayerExpanded(false)}
            className="p-2 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <ChevronDown className="h-6 w-6" />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest text-gray-400">
              Odtwarzanie z
            </span>
            <span className="text-xs font-semibold text-teal-400">
              {currentTrack.source || "Wyszukiwarka"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsOptionsMenuOpen(true)}
            className="p-2 text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] transition active:scale-90 cursor-pointer"
            title="Więcej opcji"
          >
            <MoreVertical className="h-6 w-6 stroke-[2.2]" />
          </button>
        </div>

        {/* Sekcja Okładki - dynamiczny rozmiar z luzem na dole */}
        <div className="my-auto flex flex-col items-center w-full pt-1">
          <div className="relative aspect-square w-full max-w-[245px] sm:max-w-[280px] overflow-hidden rounded-3xl border border-teal-800/40 shadow-2xl shadow-teal-950/80 bg-[#121c20] flex items-center justify-center transition-all duration-300">
            {currentTrack.albumCover && currentTrack.albumCover.trim() !== "" ? (
              <img
                src={currentTrack.albumCover}
                alt={currentTrack.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-teal-400/60">
                <Music2 className="h-14 w-14" />
              </div>
            )}
            {isLoadingAudio && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-teal-400" />
              </div>
            )}
          </div>

          {/* Tytuł i Wykonawca */}
          <div className="mt-3 flex w-full max-w-[310px] items-center justify-between gap-4">
            <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,black_85%,transparent_100%)]">
              <div className="overflow-hidden">
                {isLongTitle ? (
                  <div
                    className="animate-spotify-loop"
                    style={{ animationDuration: `${titleLoopDuration}s` }}
                  >
                    <span className="text-lg sm:text-xl font-bold tracking-tight text-white pr-12 whitespace-nowrap">
                      {currentTrack.title}
                    </span>
                    <span className="text-lg sm:text-xl font-bold tracking-tight text-white pr-12 whitespace-nowrap">
                      {currentTrack.title}
                    </span>
                  </div>
                ) : (
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate">
                    {currentTrack.title}
                  </h2>
                )}
              </div>

              <div className="overflow-hidden mt-0.5">
                {isLongArtist ? (
                  <div
                    className="animate-spotify-loop-artist"
                    style={{ animationDuration: `${artistLoopDuration}s` }}
                  >
                    <span className="text-xs sm:text-sm font-medium text-teal-400/90 pr-12 whitespace-nowrap">
                      {currentTrack.artist}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-teal-400/90 pr-12 whitespace-nowrap">
                      {currentTrack.artist}
                    </span>
                  </div>
                ) : (
                  <p className="truncate text-xs sm:text-sm font-medium text-teal-400/90">
                    {currentTrack.artist}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleLikeClick}
              className={`p-2 transition active:scale-90 flex-shrink-0 z-10 cursor-pointer ${
                animatingHeart ? "animate-heart-shake" : ""
              }`}
            >
              <Heart
                className={`h-6 w-6 sm:h-7 sm:w-7 transition-colors ${
                  isLiked ? "fill-teal-400 text-teal-400" : "text-gray-400 hover:text-white"
                }`}
              />
            </button>
          </div>
        </div>

        {/* DOLNA CZĘŚĆ (Linijka Live + Kontrolki + Napis tekstu) */}
        <div className="w-full max-w-[340px] mx-auto space-y-3 pb-2">
          {/* IDEALNIE WYPOZIOMOWANA I POWIĘKSZONA LINIJKA TEKSTU */}
          <div className="h-[48px] w-full flex items-center justify-center overflow-hidden px-4 -mt-6 mb-3.5 select-none pointer-events-none">
            {lyricsData.synced && currentLiveLine ? (
              <p
                key={`line-${activeLineIndex}`}
                style={{
                  animation: "lyricsSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
                className="text-[15px] sm:text-base font-semibold text-white/95 text-center leading-snug tracking-normal line-clamp-2 antialiased drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] [html.light_&]:text-[#831843] [html.light_&]:drop-shadow-none"
              >
                {currentLiveLine}
              </p>
            ) : null}

          </div>
          {/* Pasek postępu */}
          <div className="w-full">
            <div className="relative flex items-center h-4 w-full cursor-pointer group">
              <div className="absolute w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full bg-teal-400 rounded-full transition-[width] duration-75"
                  style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
                />
              </div>

              <input
                type="range"
                min={0}
                max={duration > 0 ? duration : 100}
                step="0.1"
                value={displayedTime}
                onInput={(e) => setScrubbingTime(Number((e.target as HTMLInputElement).value))}
                onChange={(e) => {
                  const targetSec = Number(e.target.value);
                  setScrubbingTime(null);
                  seekTo(targetSec);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />

              <div
                className="absolute h-3.5 w-3.5 -ml-1.5 rounded-full bg-teal-400 shadow-md shadow-teal-500/50 pointer-events-none transition-[left] duration-75"
                style={{
                  left: `${Math.min(Math.max(progressPercent, 0), 100)}%`,
                }}
              />
            </div>

            <div className="mt-1 flex justify-between text-[11px] font-mono text-gray-400">
              <span>{formatTime(displayedTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Przyciski sterowania */}
          <div className="flex items-center justify-between px-2">
            <button
              onClick={() => {
                toggleShuffle();
                const state = usePlayerStore.getState();
                sendConnectCommand({
                  type: "SET_SHUFFLE",
                  isShuffle: state.isShuffle,
                  queue: state.queue,
                });
              }}
              className="p-2 text-gray-400 hover:text-white transition active:scale-90 cursor-pointer"
            >
              {isShuffle ? <Shuffle className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
            </button>

            <button
              onClick={previousTrack}
              className="p-2 text-gray-300 hover:text-white transition active:scale-90 cursor-pointer"
            >
              <SkipBack className="h-7 w-7" />
            </button>

            <button
              onClick={() => {
                if (isLoadingAudio) return;
                togglePlay();
              }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-400 text-black shadow-lg shadow-teal-500/30 transition hover:scale-105 active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="h-7 w-7 fill-black" /> : <Play className="h-7 w-7 fill-black ml-1" />}
            </button>

            <button
              onClick={() => nextTrack()}
              className="p-2 text-gray-300 hover:text-white transition active:scale-90 cursor-pointer"
            >
              <SkipForward className="h-7 w-7" />
            </button>

            <button
              onClick={() => {
                const modes: ("off" | "playlist" | "track")[] = ["off", "playlist", "track"];
                const currentIdx = modes.indexOf(repeatMode || "off");
                const nextMode = modes[(currentIdx + 1) % modes.length];
                toggleRepeat();
                sendConnectCommand({
                  type: "SET_REPEAT",
                  mode: nextMode,
                });
              }}
              className={`p-2 transition relative active:scale-90 cursor-pointer ${
                repeatMode !== "off" ? "text-teal-400" : "text-gray-400 hover:text-white"
              }`}
            >
              {repeatMode === "track" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
              {repeatMode === "playlist" && (
                <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-teal-400" />
              )}
            </button>
          </div>

          {/* Dolny pasek 5 ikonek */}
          <div className="flex items-center justify-between px-3 pt-1">
            <button
              onClick={() => setIsQueueOpen(true)}
              className={`p-2 transition active:scale-90 cursor-pointer ${
                isQueueOpen ? "text-teal-400" : "text-gray-400 hover:text-white"
              }`}
              title="Kolejka odtwarzania"
            >
              <ListMusic className="h-5 w-5 stroke-[2.2]" />
            </button>

            <button
              onClick={() => setJamModalOpen(true)}
              className={`relative p-2 transition active:scale-90 cursor-pointer ${
                jamCode || isJamModalOpen ? "text-teal-400" : "text-gray-400 hover:text-white"
              }`}
              title="Songify Dżem"
            >
              <JamJarIcon className="h-5 w-5" />
              {jamCode && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setDevicePickerOpen(true)}
              className={`p-2 transition active:scale-90 cursor-pointer ${
                isPlayingRemotely ? "text-teal-400 animate-pulse" : "text-gray-400 hover:text-white"
              }`}
              title="Urządzenia"
            >
              <Laptop className="h-5 w-5 stroke-[2.2]" />
            </button>

            <button
              onClick={() => setAddToPlaylistOpen(true)}
              className="p-2 text-gray-400 hover:text-white transition active:scale-90 cursor-pointer"
              title="Dodaj do playlisty"
            >
              <FolderPlus className="h-5 w-5 stroke-[2.2]" />
            </button>

            <button
              onClick={() => setIsSleepModalOpen(true)}
              className={`flex items-center gap-1.5 p-2 transition active:scale-90 cursor-pointer ${
                sleepTimerEndsAt || sleepTimerMode === "end_of_track" ? "text-teal-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
              title="Sleep Timer"
            >
              <Moon className="h-5 w-5 stroke-[2.2] flex-shrink-0" />
              {remainingTimerText ? (
                <span className="font-mono text-xs font-bold tracking-tight">{remainingTimerText}</span>
              ) : sleepTimerMode === "end_of_track" ? (
                <span className="text-[11px] font-semibold tracking-tight">Koniec</span>
              ) : null}
            </button>
          </div>

          {/* WYRAŹNY WSKAŹNIK "DOSTĘPNY TEKST" */}
          {hasLyrics && (
            <div
              style={{ opacity: scrollOpacity }}
              className="pt-2 flex items-center justify-center gap-1.5 transition-opacity duration-150 pointer-events-none select-none"
            >
              <ChevronDown className="h-3.5 w-3.5 text-teal-400 stroke-[2.5]" />
              <span className="text-xs font-bold tracking-wider text-gray-200 uppercase">
                Dostępny tekst
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-teal-400 stroke-[2.5]" />
            </div>
          )}
        </div>
      </div>

      {/* SEKCJA TEKSTU POD SPODEM (Identyczna w dark i light: biały tekst, pełny kontrast) */}
      {hasLyrics && (
        <div className="relative z-10 px-5 pb-12 pt-2 max-w-lg mx-auto">
          <div
            className="rounded-3xl p-6 shadow-2xl border border-white/10 transition-colors duration-500 backdrop-blur-md"
            style={{
              backgroundColor: `rgba(${dominantRgb}, 0.88)`,
            }}
          >
            {/* Nagłówek karty tekstu */}
            <div className="flex items-center justify-between pb-4 border-b border-white/15 mb-4">
              <span className="text-xs font-bold uppercase tracking-widest !text-white drop-shadow-sm select-none">
                Tekst utworu
              </span>
              <button
                type="button"
                onClick={() => setIsLyricsExpanded(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 !text-white text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm border border-white/15"
                title="Rozwiń na pełny ekran"
              >
                <span className="!text-white">Rozwiń</span>
                <Maximize2 className="h-3.5 w-3.5 !text-white stroke-[2.2]" />
              </button>
            </div>

            {/* Treść w karcie */}
            <div
              ref={cardLyricsRef}
              className="h-64 overflow-y-auto space-y-4 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {lyricsData.synced ? (
                lyricsData.synced.map((line, idx) => {
                  const isCurrent = idx === activeLineIndex;
                  const isPast = activeLineIndex >= 0 && idx < activeLineIndex;

                  return (
                    <p
                      key={idx}
                      data-index={idx}
                      onClick={() => seekTo(line.time)}
                      className={`cursor-pointer transition-all duration-300 select-none ${
                        isCurrent
                          ? "text-xl font-bold !text-white scale-100 drop-shadow-[0_0_14px_rgba(255,255,255,0.7)]"
                          : isPast
                          ? "text-base font-medium !text-white/80"
                          : "text-base font-medium !text-white/40"
                      }`}
                    >
                      {line.text}
                    </p>
                  );
                })
              ) : (
                lyricsData.plain?.split("\n").map((line, idx) => (
                  <p
                    key={idx}
                    className="text-base font-medium !text-white/85 select-none tracking-normal"
                  >
                    {line.trim() || "\u00A0"}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PEŁNOEKRANOWY MODAL TEKSTU (1:1 DYNAMICZNY CZYSTY KOLOR JAK W DARK MODE) */}
      {isLyricsExpanded && (
        <div className="fixed inset-0 z-50 flex flex-col p-6 animate-in fade-in duration-200 !bg-black">
          {/* Warstwa nasyconego koloru wyciągniętego z okładki */}
          <div
            className="absolute inset-0 pointer-events-none transition-colors duration-500"
            style={{
              backgroundColor: `rgb(${dominantRgb})`,
              opacity: 0.85,
            }}
          />

          {/* Górna belka */}
          <div className="relative z-10 flex items-center justify-between pb-4 border-b border-white/20 mb-4">
            <div className="truncate pr-4">
              <h3 className="text-lg font-bold !text-white truncate drop-shadow-sm select-none">{currentTrack.title}</h3>
              <p className="text-xs !text-white/70 truncate select-none">{currentTrack.artist}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsLyricsExpanded(false)}
              className="p-2.5 rounded-full bg-black/50 hover:bg-black/70 !text-white transition cursor-pointer flex-shrink-0 border border-white/20 shadow-lg"
              title="Zwiń"
            >
              <Minimize2 className="h-5 w-5 !text-white stroke-[2.2]" />
            </button>
          </div>

          {/* Treść wersów */}
          <div
            ref={fullLyricsRef}
            className="relative z-10 flex-1 overflow-y-auto space-y-6 py-6 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {lyricsData.synced ? (
              lyricsData.synced.map((line, idx) => {
                const isCurrent = idx === activeLineIndex;
                const isPast = activeLineIndex >= 0 && idx < activeLineIndex;

                return (
                  <p
                    key={idx}
                    data-index={idx}
                    onClick={() => seekTo(line.time)}
                    className={`cursor-pointer transition-all duration-300 select-none ${
                      isCurrent
                        ? "text-2xl font-bold !text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.75)] scale-100"
                        : isPast
                        ? "text-lg font-medium !text-white/80"
                        : "text-lg font-medium !text-white/40"
                    }`}
                  >
                    {line.text}
                  </p>
                );
              })
            ) : (
              lyricsData.plain?.split("\n").map((line, idx) => (
                <p
                  key={idx}
                  className="text-lg font-medium !text-white/90 select-none leading-relaxed"
                >
                  {line.trim() || "\u00A0"}
                </p>
              ))
            )}
          </div>
        </div>
      )}

      {/* Widok Kolejki */}
      {isQueueOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#070b0d] text-white px-5 pt-4 pb-8 select-none animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-teal-950/60">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Kolejka</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Odtwarzanie z: <span className="font-semibold text-teal-400">{currentTrack.source || "Kolejka"}</span>
              </p>
            </div>
            <button
              onClick={() => setIsQueueOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#121c20] border border-teal-900/60 text-gray-300 hover:text-white transition active:scale-90 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pt-3 pr-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-400">
                Teraz odtwarzane
              </span>

              <div className="mt-2 flex items-center justify-between rounded-2xl bg-[#0c1518] border border-teal-500/50 p-3 shadow-lg">
                <div className="flex items-center gap-3.5 min-w-0 pr-3">
                  <div className="relative h-12 w-12 rounded-xl overflow-hidden flex-shrink-0 bg-[#142025] border border-teal-900/60">
                    {currentTrack.albumCover ? (
                      <img
                        src={currentTrack.albumCover}
                        alt={currentTrack.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Music2 className="h-5 w-5 text-teal-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col truncate">
                    <div className="flex items-center gap-1.5 truncate">
                      <Volume2 className="h-3.5 w-3.5 text-teal-400 flex-shrink-0 animate-pulse" />
                      <span className="truncate text-sm font-bold text-teal-300">
                        {currentTrack.title}
                      </span>
                    </div>
                    <span className="truncate text-xs text-gray-400 mt-0.5">
                      {currentTrack.artist}
                    </span>
                  </div>
                </div>

                <button
                  onClick={togglePlay}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-400 text-black shadow-md shadow-teal-500/30 transition hover:scale-105 active:scale-90 cursor-pointer"
                >
                  {isPlaying && !isLoadingAudio ? (
                    <Pause className="h-5 w-5 fill-black" />
                  ) : (
                    <Play className="h-5 w-5 fill-black ml-0.5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
                  Następne w kolejce ({Math.max(queue.length - 1, 0)})
                </span>
              </div>

              {queue.length <= 1 ? (
                <div className="py-12 text-center text-xs text-gray-500">
                  Kolejka dobiegła końca.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {queue.slice(1).map((track, relativeIdx) => {
                    const actualIdx = relativeIdx + 1;
                    const isBeingSwiped = swipedItem?.idx === actualIdx && swipedItem.isLockedHorizontal;
                    const rawDiff = isBeingSwiped ? swipedItem.currentX - swipedItem.startX : 0;
                    const offsetX = Math.abs(rawDiff) > 10 ? rawDiff : 0;

                    const handleSwipeEnd = () => {
                      if (swipedItem?.idx === actualIdx && swipedItem.isLockedHorizontal) {
                        const diff = swipedItem.currentX - swipedItem.startX;
                        if (diff < -75) {
                          removeFromQueue(actualIdx);
                        } else if (diff > 75) {
                          playNextInQueue(actualIdx);
                        }
                      }
                      setSwipedItem(null);
                    };

                    return (
                      <div
                        key={`${track.id}-${actualIdx}`}
                        className="group relative overflow-hidden rounded-xl bg-[#091013]"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedIdx !== null && draggedIdx !== actualIdx) {
                            reorderQueue(draggedIdx, actualIdx);
                            setDraggedIdx(null);
                          }
                        }}
                      >
                        {isBeingSwiped && Math.abs(offsetX) > 8 && (
                          <div
                            className={`absolute inset-0 flex items-center justify-between px-4 z-0 ${
                              offsetX < 0
                                ? "bg-red-950 text-red-400"
                                : "bg-teal-950 text-teal-400 swipe-action-next"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-xs font-bold">
                              <ListPlus className="h-4 w-4 stroke-[2.5]" />
                              <span>Zagraj jako następny</span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs font-bold">
                              <span>Usuń</span>
                              <Trash2 className="h-4 w-4 stroke-[2.5]" />
                            </div>
                          </div>
                        )}

                        <div
                          draggable
                          onDragStart={() => setDraggedIdx(actualIdx)}
                          onTouchStart={(e) => {
                            setSwipedItem({
                              idx: actualIdx,
                              startX: e.touches[0].clientX,
                              startY: e.touches[0].clientY,
                              currentX: e.touches[0].clientX,
                              isLockedVertical: false,
                              isLockedHorizontal: false,
                            });
                          }}
                          onTouchMove={(e) => {
                            if (!swipedItem || swipedItem.idx !== actualIdx) return;
                            if (swipedItem.isLockedVertical) return;

                            const touch = e.touches[0];
                            const diffX = touch.clientX - swipedItem.startX;
                            const diffY = touch.clientY - swipedItem.startY;

                            if (!swipedItem.isLockedHorizontal) {
                              if (Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
                                setSwipedItem({ ...swipedItem, isLockedVertical: true });
                                return;
                              }
                              if (Math.abs(diffX) > 12 && Math.abs(diffX) > Math.abs(diffY)) {
                                setSwipedItem({
                                  ...swipedItem,
                                  isLockedHorizontal: true,
                                  currentX: touch.clientX,
                                });
                                return;
                              }
                              return;
                            }

                            setSwipedItem({
                              ...swipedItem,
                              currentX: touch.clientX,
                            });
                          }}
                          onTouchEnd={handleSwipeEnd}
                          onMouseDown={(e) => {
                            if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".drag-handle")) {
                              return;
                            }
                            setSwipedItem({
                              idx: actualIdx,
                              startX: e.clientX,
                              startY: e.clientY,
                              currentX: e.clientX,
                              isMouseDown: true,
                              isLockedHorizontal: true,
                            });
                          }}
                          onMouseMove={(e) => {
                            if (swipedItem?.idx === actualIdx && swipedItem.isMouseDown) {
                              setSwipedItem({
                                ...swipedItem,
                                currentX: e.clientX,
                              });
                            }
                          }}
                          onMouseUp={handleSwipeEnd}
                          onMouseLeave={() => {
                            if (swipedItem?.idx === actualIdx && swipedItem.isMouseDown) {
                              handleSwipeEnd();
                            }
                          }}
                          style={{
                            transform: `translateX(${offsetX}px)`,
                            transition: isBeingSwiped ? "none" : "transform 0.2s ease-out",
                          }}
                          onClick={() => {
                            if (Math.abs(offsetX) < 6) {
                              const newQ = queue.slice(actualIdx);
                              setCurrentTrack(track, newQ);
                            }
                          }}
                          className="relative z-10 flex items-center justify-between p-2.5 rounded-xl bg-[#0e1619] border border-teal-950/60 hover:bg-[#131f23] transition cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-3 overflow-hidden min-w-0 pr-2">
                            <span className="w-5 text-center text-xs font-mono text-gray-500 flex-shrink-0">
                              {relativeIdx + 1}
                            </span>

                            <QueueTrackCover track={track} />

                            <div className="flex flex-col truncate">
                              <span className="truncate text-xs font-semibold text-white">
                                {track.title}
                              </span>
                              <span className="truncate text-[11px] text-gray-400 mt-0.5">
                                {track.artist}
                              </span>
                            </div>
                          </div>

                          <div
                            className="p-1 text-gray-500 hover:text-teal-400 transition cursor-grab active:cursor-grabbing flex-shrink-0"
                            title="Przeciągnij, aby zmienić kolejność"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Sleep Timera */}
      {isSleepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 px-4 pb-6 sm:pb-0 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xs rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl animate-in slide-from-bottom-4 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]">
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-3">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
                <h3 className="text-sm font-bold tracking-tight text-white [html.light_&]:text-[#5c0612]">
                  Wyłącznik czasowy
                </h3>
              </div>
              <button
                onClick={() => setIsSleepModalOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {(sleepTimerEndsAt || sleepTimerMode) && (
              <div className="mb-4 rounded-xl bg-teal-950/40 border border-teal-800/40 p-2.5 flex items-center justify-between text-xs [html.light_&]:bg-[#fff1f2] [html.light_&]:border-[#fecdd3]">
                <div>
                  <span className="text-gray-400 text-[10px] block uppercase font-bold [html.light_&]:text-[#be123c]">
                    Aktywne uśpienie
                  </span>
                  <span className="font-bold text-teal-300 [html.light_&]:text-[#9f1239]">
                    {sleepTimerMode === "end_of_track" ? "Po bieżącym utworze" : `Za około ${remainingTimerText}`}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSleepTimer(null);
                    setIsSleepModalOpen(false);
                    sendConnectCommand({
                      type: "SET_SLEEP_TIMER",
                      sleepTimerEndsAt: null,
                      sleepTimerMode: null,
                    });
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[11px] font-bold transition cursor-pointer"
                >
                  Wyłącz
                </button>
              </div>
            )}

            <div className="relative my-3 flex flex-col items-center select-none">
              <div className="pointer-events-none absolute top-1/2 left-0 right-0 h-11 -translate-y-1/2 rounded-xl border border-teal-500/40 bg-teal-500/10" />

              <div
                ref={wheelRef}
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const itemHeight = 44;
                  const index = Math.round(target.scrollTop / itemHeight);
                  const minute = Math.min(Math.max(index + 1, 1), 60);
                  setSelectedWheelMinutes(minute);
                }}
                className="relative h-[132px] w-full overflow-y-auto snap-y snap-mandatory scrollbar-none py-[44px]"
              >
                {Array.from({ length: 60 }, (_, i) => i + 1).map((minute) => {
                  const isSelected = selectedWheelMinutes === minute;
                  return (
                    <div
                      key={minute}
                      onClick={() => {
                        setSelectedWheelMinutes(minute);
                        if (wheelRef.current) {
                          wheelRef.current.scrollTo({
                            top: (minute - 1) * 44,
                            behavior: "smooth",
                          });
                        }
                      }}
                      className={`flex h-[44px] items-center justify-center snap-center font-bold transition cursor-pointer ${
                        isSelected
                          ? "text-xl text-teal-400 scale-110"
                          : "text-gray-500 opacity-40 hover:opacity-80 text-sm"
                      }`}
                    >
                      <span>{minute} min</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => {
                setSleepTimer(null, "end_of_track");
                setIsSleepModalOpen(false);
                sendConnectCommand({
                  type: "SET_SLEEP_TIMER",
                  sleepTimerEndsAt: null,
                  sleepTimerMode: "end_of_track",
                });
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border mb-3 text-xs font-semibold transition cursor-pointer ${
                sleepTimerMode === "end_of_track"
                  ? "border-teal-400 bg-teal-950/40 text-teal-300"
                  : "border-teal-950/70 bg-[#121c20] text-gray-300 hover:text-teal-400"
              }`}
            >
              <span>Uśpij na koniec tego utworu</span>
              {sleepTimerMode === "end_of_track" && <Check className="h-4 w-4 text-teal-400" />}
            </button>

            <button
              onClick={() => {
                const endsAt = Date.now() + selectedWheelMinutes * 60 * 1000;
                setSleepTimer(selectedWheelMinutes, "time");
                setIsSleepModalOpen(false);
                sendConnectCommand({
                  type: "SET_SLEEP_TIMER",
                  sleepTimerEndsAt: endsAt,
                  sleepTimerMode: "time",
                });
              }}
              className="w-full rounded-2xl bg-teal-400 py-3 text-xs font-bold text-black shadow-lg shadow-teal-500/20 hover:scale-[1.02] active:scale-95 transition cursor-pointer"
            >
              Ustaw wyłącznik na {selectedWheelMinutes} min
            </button>
          </div>
        </div>
      )}

      {/* 1. MODAL OPCJI (3 KROPKI) */}
      {isOptionsMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 px-4 pb-6 sm:pb-0 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xs rounded-3xl border border-teal-900/80 bg-[#0c1417] p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:shadow-xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-3">
              <h3 className="text-sm font-bold tracking-tight text-white [html.light_&]:text-[#831843]">
                Opcje utworu
              </h3>
              <button
                type="button"
                onClick={() => setIsOptionsMenuOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:bg-[#fff1f2] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  handleShare();
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-semibold text-gray-200 bg-[#121c20] border border-teal-900/40 hover:bg-teal-950/60 hover:text-teal-400 transition active:scale-95 cursor-pointer [html.light_&]:!bg-[#fff5f7] [html.light_&]:!border-[#fce7f3] [html.light_&]:!text-[#881337] [html.light_&]:hover:!bg-[#fae8ed] [html.light_&]:hover:!border-[#fbcfe8]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 [html.light_&]:!bg-[#f43f5e]/10 [html.light_&]:!text-[#9f1239] flex-shrink-0 transition-colors">
                  <Share2 
                    className="h-4 w-4 !stroke-[#2dd4bf] [html.light_&]:!stroke-[#9f1239] !fill-none" 
                    style={{ stroke: "currentColor", fill: "none" }}
                    strokeWidth={2.2}
                  />
                </div>
                <span className="font-semibold">Udostępnij utwór</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  setIsReloadCoverModalOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-semibold text-gray-200 bg-[#121c20] border border-teal-900/40 hover:bg-teal-950/60 hover:text-teal-400 transition active:scale-95 cursor-pointer [html.light_&]:!bg-[#fff5f7] [html.light_&]:!border-[#fce7f3] [html.light_&]:!text-[#881337] [html.light_&]:hover:!bg-[#fae8ed] [html.light_&]:hover:!border-[#fbcfe8]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 [html.light_&]:!bg-[#f43f5e]/10 [html.light_&]:!text-[#9f1239] flex-shrink-0 transition-colors">
                  <Disc3 
                    className="h-4 w-4 !stroke-[#2dd4bf] [html.light_&]:!stroke-[#9f1239] !fill-none" 
                    style={{ stroke: "currentColor", fill: "none" }}
                    strokeWidth={2.2}
                  />
                </div>
                <span className="font-semibold">Przeładuj okładkę</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  setCustomCoverUrl("");
                  setCustomCoverError(null);
                  setIsCustomCoverModalOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-semibold text-gray-200 bg-[#121c20] border border-teal-900/40 hover:bg-teal-950/60 hover:text-teal-400 transition active:scale-95 cursor-pointer [html.light_&]:!bg-[#fff5f7] [html.light_&]:!border-[#fce7f3] [html.light_&]:!text-[#881337] [html.light_&]:hover:!bg-[#fae8ed] [html.light_&]:hover:!border-[#fbcfe8]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 [html.light_&]:!bg-[#f43f5e]/10 [html.light_&]:!text-[#9f1239] flex-shrink-0 transition-colors">
                  <LinkIcon 
                    className="h-4 w-4 !stroke-[#2dd4bf] [html.light_&]:!stroke-[#9f1239] !fill-none" 
                    style={{ stroke: "currentColor", fill: "none" }}
                    strokeWidth={2.2}
                  />
                </div>
                <span className="font-semibold">Wklej link do okładki</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  setCustomYtUrl("");
                  setCustomYtError(null);
                  setIsCustomYtModalOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-semibold text-gray-200 bg-[#121c20] border border-teal-900/40 hover:bg-teal-950/60 hover:text-teal-400 transition active:scale-95 cursor-pointer [html.light_&]:!bg-[#fff5f7] [html.light_&]:!border-[#fce7f3] [html.light_&]:!text-[#881337] [html.light_&]:hover:!bg-[#fae8ed] [html.light_&]:hover:!border-[#fbcfe8]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-500/15 [html.light_&]:!bg-[#f43f5e]/10 flex-shrink-0">
                  <YoutubeIcon className="h-4 w-4" />
                </div>
                <span className="font-semibold">Podmień wersję audio (YouTube)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  setCustomLyricsText(lyricsData.plain || "");
                  setIsCustomLyricsModalOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-semibold text-gray-200 bg-[#121c20] border border-teal-900/40 hover:bg-teal-950/60 hover:text-teal-400 transition active:scale-95 cursor-pointer [html.light_&]:!bg-[#fff5f7] [html.light_&]:!border-[#fce7f3] [html.light_&]:!text-[#881337] [html.light_&]:hover:!bg-[#fae8ed] [html.light_&]:hover:!border-[#fbcfe8]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 [html.light_&]:!bg-[#f43f5e]/10 [html.light_&]:!text-[#9f1239] flex-shrink-0 transition-colors">
                  <FileText 
                    className="h-4 w-4 !stroke-[#2dd4bf] [html.light_&]:!stroke-[#9f1239] !fill-none" 
                    style={{ stroke: "currentColor", fill: "none" }}
                    strokeWidth={2.2}
                  />
                </div>
                <span className="font-semibold">Dodaj / edytuj tekst</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL POTWIERDZENIA PRZEŁADOWANIA OKŁADKI */}
      {isReloadCoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-white">
            <div className="flex items-center gap-2.5 text-teal-400 mb-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <h3 className="text-sm font-bold tracking-tight text-white">
                Przeładowanie okładki
              </h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed mb-5">
              Jeśli masz pewność że okładka nie zgadza się z piosenką kliknij poniższy przycisk <b>Przeładuj okładkę</b>.
              <span className="block mt-2 text-gray-400">
                Nie naduzywaj tej opcji, okładka powinna sie zmienić na poprawną po pierwszym przeładowaniu.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReloadCoverModalOpen(false)}
                disabled={isReloadingCover}
                className="rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white transition cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleForceReloadCover}
                disabled={isReloadingCover}
                className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-teal-500/20 hover:scale-[1.02] active:scale-95 transition disabled:opacity-50 cursor-pointer"
              >
                {isReloadingCover && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isReloadingCover ? "Przeładowywanie..." : "Przeładuj okładkę"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* 3. MODAL WKLEJANIA LINKU DO OKŁADKI */}
      {isCustomCoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#831843] [html.light_&]:shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-4">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
                <h3 className="text-sm font-bold tracking-tight">Wklej link do okładki</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomCoverModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:bg-[#fff1f2] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomCover} className="space-y-4">
              <p className="text-[11px] text-gray-300 [html.light_&]:text-[#9d174d] leading-relaxed">
                Skopiuj i wklej bezpośredni adres grafiki. Okładka natychmiast nadpisze się w bazie danych dla tego utworu.
              </p>

              <div>
                <label className="text-[10px] font-bold text-gray-400 [html.light_&]:text-[#be185d] uppercase tracking-wider block mb-1.5">
                  Link URL okładki
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://is1-ssl.mzstatic.com/image/..."
                  value={customCoverUrl}
                  onChange={(e) => {
                    setCustomCoverUrl(e.target.value);
                    if (customCoverError) setCustomCoverError(null);
                  }}
                  className="w-full rounded-xl border border-teal-900/60 bg-[#162125] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#831843] [html.light_&]:placeholder-[#f472b6]"
                />
              </div>

              {customCoverUrl.trim().startsWith("http") && (
                <div className="flex items-center gap-3 p-2 rounded-2xl bg-[#121c20] border border-teal-950/60 [html.light_&]:bg-[#fff1f2] [html.light_&]:border-[#fecdd3]">
                  <img
                    src={customCoverUrl.trim()}
                    alt="Podgląd"
                    className="h-12 w-12 rounded-xl object-cover bg-black/40 flex-shrink-0"
                    onError={() => setCustomCoverError("Podany link nie jest poprawnym adresem obrazka.")}
                  />
                  <div className="flex flex-col truncate text-[11px]">
                    <span className="font-semibold text-white [html.light_&]:text-[#831843]">Podgląd okładki</span>
                    <span className="text-gray-400 truncate [html.light_&]:text-[#be185d]">{customCoverUrl}</span>
                  </div>
                </div>
              )}

              {customCoverError && (
                <div className="rounded-xl bg-red-950/40 border border-red-800/50 p-2.5 text-xs text-red-300 [html.light_&]:bg-[#ffe4e6] [html.light_&]:text-[#be123c] [html.light_&]:border-[#fecdd3]">
                  {customCoverError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCustomCoverModalOpen(false)}
                  disabled={isSavingCustomCover}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomCover || !customCoverUrl.trim()}
                  className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-black hover:bg-teal-300 disabled:opacity-50 cursor-pointer shadow-lg shadow-teal-500/20 [html.light_&]:bg-[#db2777] [html.light_&]:text-white [html.light_&]:shadow-[#db2777]/30"
                >
                  {isSavingCustomCover && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSavingCustomCover ? "Zapisywanie..." : "Zapisz okładkę"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL PODMIANY LINKU YT */}
      {isCustomYtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#831843] [html.light_&]:shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-4">
              <div className="flex items-center gap-2">
                <YoutubeIcon className="h-5 w-5 text-red-500" />
                <h3 className="text-sm font-bold tracking-tight">Własny link YouTube</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomYtModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:bg-[#fff1f2] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomYouTube} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 [html.light_&]:text-[#be185d] uppercase tracking-wider block mb-1.5">
                  Link do utworu na YouTube
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={customYtUrl}
                  onChange={(e) => {
                    setCustomYtUrl(e.target.value);
                    if (customYtError) setCustomYtError(null);
                  }}
                  className="w-full rounded-xl border border-teal-900/60 bg-[#162125] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#831843] [html.light_&]:placeholder-[#f472b6]"
                />
              </div>

              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 text-[11px] text-amber-200/90 leading-relaxed [html.light_&]:bg-[#fffbeb] [html.light_&]:border-[#fde68a] [html.light_&]:text-[#92400e]">
                <span className="font-bold block mb-1">Upewnij się przed zapisem:</span>
                Sprawdź, czy wybrany film to <b>wersja studyjna</b> utworu – bez zbędnych wstępów filmowych, dialogów czy wstawek teledyskowych.
              </div>

              {customYtError && (
                <div className="rounded-xl bg-red-950/40 border border-red-800/50 p-2.5 text-xs text-red-300 [html.light_&]:bg-[#ffe4e6] [html.light_&]:text-[#be123c] [html.light_&]:border-[#fecdd3]">
                  {customYtError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCustomYtModalOpen(false)}
                  disabled={isSavingCustomYt}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomYt || !customYtUrl.trim()}
                  className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-black hover:bg-teal-300 disabled:opacity-50 cursor-pointer shadow-lg shadow-teal-500/20 [html.light_&]:bg-[#db2777] [html.light_&]:text-white [html.light_&]:shadow-[#db2777]/30"
                >
                  {isSavingCustomYt && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSavingCustomYt ? "Zapisywanie..." : "Zapisz i odtwórz"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL DODAWANIA WŁASNEGO TEKSTU */}
      {isCustomLyricsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#831843] [html.light_&]:shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
                <h3 className="text-sm font-bold tracking-tight">Dodaj tekst utworu</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomLyricsModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:bg-[#fff1f2] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomLyrics} className="space-y-4">
              <p className="text-[11px] text-gray-300 [html.light_&]:text-[#9d174d] leading-relaxed">
                Wklej tekst utworu (np. z Genius lub format LRC ze znacznikami czasu). Tekst zostanie powiązany z tą piosenką.
              </p>

              <div>
                <textarea
                  rows={8}
                  required
                  placeholder="Wklej tekst piosenki tutaj..."
                  value={customLyricsText}
                  onChange={(e) => setCustomLyricsText(e.target.value)}
                  className="w-full rounded-2xl border border-teal-900/60 bg-[#162125] p-3.5 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none resize-none leading-relaxed [&::-webkit-scrollbar]:hidden [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#831843] [html.light_&]:placeholder-[#f472b6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCustomLyricsModalOpen(false)}
                  disabled={isSavingCustomLyrics}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomLyrics || !customLyricsText.trim()}
                  className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-black hover:bg-teal-300 disabled:opacity-50 cursor-pointer shadow-lg shadow-teal-500/20 [html.light_&]:bg-[#db2777] [html.light_&]:text-white [html.light_&]:shadow-[#db2777]/30"
                >
                  {isSavingCustomLyrics && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSavingCustomLyrics ? "Zapisywanie..." : "Zapisz tekst"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal wyboru urządzenia */}
      <DevicePickerModal />
    </div>
  );
}

function QueueTrackCover({ track }: { track: any }) {
  const [cover, setCover] = useState<string>(track.albumCover || "");

  useEffect(() => {
    if (cover || !track) return;

    let isMounted = true;
    const cleanTitle = (track.title || "")
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/feat\..*$/gi, "")
      .replace(/ft\..*$/gi, "")
      .trim();
    const cleanArtist = (track.artist || "").split(/[,;&/]/)[0].trim();

    fetch(`/api/deezer/cover?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.cover) {
          setCover(data.cover);
          track.albumCover = data.cover;
          updateSongCover(track.id, data.cover).catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [track?.id, cover, track]);

  return (
    <div className="relative h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-[#162125] border border-teal-950/50">
      {cover ? (
        <img
          src={cover}
          alt={track.title}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <Music2 className="h-4 w-4 text-teal-400/50" />
        </div>
      )}
    </div>
  );
}