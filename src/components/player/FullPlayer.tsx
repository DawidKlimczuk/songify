"use client";

import { useState, useEffect, useRef } from "react";
import { usePlayerStore } from "@/lib/store/player-store";
import { toggleLikeTrack, isTrackLiked, addSongToPlaylist, updateSongCover, overrideYouTubeTrack } from "@/app/actions/playlist";
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
} from "lucide-react";
import { useDeviceStore } from "@/lib/store/device-store";
import DevicePickerModal from "./DevicePickerModal";
import { useJamStore } from "@/lib/store/jam-store";

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
      {/* Pokrywka słoiczka */}
      <rect x="7" y="2" width="10" height="3" rx="1" />
      {/* Kołnierz pod pokrywką */}
      <path d="M6 5h12" />
      {/* Korpus słoika */}
      <path d="M5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8z" />
      {/* Etykieta dżemu w środku */}
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

  // Po otwarciu modala centrujemy wałek na wybranej wartości
  useEffect(() => {
    if (isSleepModalOpen && wheelRef.current) {
      const itemHeight = 44; // wysokość każdego elementu na bębenku
      wheelRef.current.scrollTop = (selectedWheelMinutes - 1) * itemHeight;
    }
  }, [isSleepModalOpen]);

  // Stan przeciągania myszą / palcem (Drag & Drop Reorder)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  
  // Stan swipe gestu z blokadą przewijania pionowego
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
  const [isFetchingCover, setIsFetchingCover] = useState(false);
  const [quickAddedSuccess, setQuickAddedSuccess] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  // Stany dla menu trzech kropek, przeładowania i ręcznego linku okładki
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isReloadCoverModalOpen, setIsReloadCoverModalOpen] = useState(false);
  const [isReloadingCover, setIsReloadingCover] = useState(false);

  const [isCustomCoverModalOpen, setIsCustomCoverModalOpen] = useState(false);
  const [customCoverUrl, setCustomCoverUrl] = useState("");
  const [isSavingCustomCover, setIsSavingCustomCover] = useState(false);
  const [customCoverError, setCustomCoverError] = useState<string | null>(null);

  // Ręczny zapis wklejonego łącza do okładki w bazie danych
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
      // 1. Zapisujemy na stałe w bazie danych Supabase/Prisma
      await updateSongCover(currentTrack.id, trimmedUrl);

      // 2. Natychmiast aktualizujemy stan odtwarzacza
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

  // Stany dla ręcznego linku YouTube
  const [isCustomYtModalOpen, setIsCustomYtModalOpen] = useState(false);
  const [customYtUrl, setCustomYtUrl] = useState("");
  const [isSavingCustomYt, setIsSavingCustomYt] = useState(false);
  const [customYtError, setCustomYtError] = useState<string | null>(null);

  // Wyciąganie ID filmu z linku
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
      // 1. Zapisujemy w bazie warianty zapytania z nowym videoId
      await overrideYouTubeTrack(currentTrack.title, currentTrack.artist || "", videoId);

      // 2. Wymuszamy natychmiastowe odświeżenie audio w playerze
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

  const handleQuickAddToPlaylist = async () => {
    if (!currentTrack || isQuickAdding) return;

    let targetIds: string[] = [];
    try {
      const saved = localStorage.getItem("songify_target_playlist_ids");
      if (saved) targetIds = JSON.parse(saved);
    } catch {}

    // Jeśli użytkownik jeszcze nic nie zaznaczył, otwieramy modal konfiguracji
    if (!targetIds || targetIds.length === 0) {
      setAddToPlaylistOpen(true);
      return;
    }

    setIsQuickAdding(true);
    try {
      await Promise.all(
        targetIds.map((playlistId) =>
          addSongToPlaylist(playlistId, {
            id: currentTrack.id,
            title: currentTrack.title,
            artist: currentTrack.artist,
            albumCover: currentTrack.albumCover,
            duration: currentTrack.duration,
          })
        )
      );

      setQuickAddedSuccess(true);
      setTimeout(() => setQuickAddedSuccess(false), 1200);
    } catch (err) {
      console.error("Błąd szybkiego dodawania do playlist:", err);
    } finally {
      setIsQuickAdding(false);
    }
  };

  useEffect(() => {
    if (currentTrack?.id) {
      isTrackLiked(currentTrack.id, currentTrack.title, currentTrack.artist).then((liked) => {
        setIsLiked(liked);
      });
    }
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, setIsLiked]);

  const handleLikeClick = async () => {
    if (!currentTrack) return;

    setAnimatingHeart(true);
    setTimeout(() => setAnimatingHeart(false), 500);

    const nextState = !isLiked;
    setIsLiked(nextState);

    // Rozgłaszamy polubienie do drugiego urządzenia w czasie rzeczywistym
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

  // Dociąganie okładki dla aktualnie odtwarzanego utworu
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

  // Wymuszenie przeładowania okładki z API i zaktualizowanie bazy dla wszystkich
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

      // Wyciągamy album jeśli istnieje w obiekcie utworu
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#090e11] px-6 py-6 text-white animate-in slide-in-from-bottom duration-300 overflow-hidden">
      {/* Dynamiczny Ambient Glow: idzie od samej góry i wygasa pod tytułem */}
      {currentTrack.albumCover && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[65vh] overflow-hidden z-0"
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

      <div className="relative z-10 flex items-center justify-between">
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

        {/* Przycisk trzech kropek (Otwiera modal opcji) */}
        <button
          type="button"
          onClick={() => setIsOptionsMenuOpen(true)}
          className="p-2 text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:opacity-75 transition active:scale-90 cursor-pointer"
          title="Więcej opcji"
        >
          <MoreVertical className="h-6 w-6 stroke-[2.2]" />
        </button>
      </div>

      <div className="my-auto flex flex-col items-center w-full relative z-10">
        <div className="relative aspect-square w-full max-w-[310px] overflow-hidden rounded-3xl border border-teal-800/40 [html.light_&]:!border-transparent shadow-2xl shadow-teal-950/80 bg-[#121c20] flex items-center justify-center">
          {currentTrack.albumCover && currentTrack.albumCover.trim() !== "" ? (
            <img
              src={currentTrack.albumCover}
              alt={currentTrack.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-teal-400/60">
              <Music2 className="h-16 w-16" />
            </div>
          )}
          {isLoadingAudio && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <Loader2 className="h-10 w-10 animate-spin text-teal-400" />
            </div>
          )}
        </div>

        <div className="mt-7 flex w-full max-w-[310px] items-center justify-between gap-4">
          <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,black_85%,transparent_100%)]">
            {/* TYTUŁ */}
            <div className="overflow-hidden">
              {isLongTitle ? (
                <div 
                  className="animate-spotify-loop"
                  style={{ animationDuration: `${titleLoopDuration}s` }}
                >
                  <span className="text-xl font-bold tracking-tight text-white pr-12 whitespace-nowrap">
                    {currentTrack.title}
                  </span>
                  <span className="text-xl font-bold tracking-tight text-white pr-12 whitespace-nowrap">
                    {currentTrack.title}
                  </span>
                </div>
              ) : (
                <h2 className="text-xl font-bold tracking-tight text-white truncate">
                  {currentTrack.title}
                </h2>
              )}
            </div>

            {/* AUTORZY */}
            <div className="overflow-hidden mt-0.5">
              {isLongArtist ? (
                <div 
                  className="animate-spotify-loop-artist"
                  style={{ animationDuration: `${artistLoopDuration}s` }}
                >
                  <span className="text-sm font-medium text-teal-400/90 pr-12 whitespace-nowrap">
                    {currentTrack.artist}
                  </span>
                  <span className="text-sm font-medium text-teal-400/90 pr-12 whitespace-nowrap">
                    {currentTrack.artist}
                  </span>
                </div>
              ) : (
                <p className="truncate text-sm font-medium text-teal-400/90">
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
              className={`h-7 w-7 transition-colors ${
                isLiked ? "fill-teal-400 text-teal-400" : "text-gray-400 hover:text-white"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="w-full max-w-[340px] mx-auto space-y-4">
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
            title={isShuffle ? "Odtwarzanie losowe" : "Odtwarzanie po kolei"}
          >
            {isShuffle ? (
              <Shuffle className="h-5 w-5" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}
          </button>

          <button
            onClick={previousTrack}
            className="p-2 text-gray-300 hover:text-white transition active:scale-90 cursor-pointer"
            title="Poprzedni utwór"
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
            {isPlaying ? (
              <Pause className="h-7 w-7 fill-black" />
            ) : (
              <Play className="h-7 w-7 fill-black ml-1" />
            )}
          </button>

          <button
            onClick={() => nextTrack()}
            className="p-2 text-gray-300 hover:text-white transition active:scale-90 cursor-pointer"
            title="Następny utwór"
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
              repeatMode !== "off"
                ? "text-teal-400"
                : "text-gray-400 hover:text-white"
            }`}
            title={
              repeatMode === "track"
                ? "Zapętlenie utworu"
                : repeatMode === "playlist"
                ? "Zapętlenie playlisty"
                : "Zapętlenie wyłączone"
            }
          >
            {repeatMode === "track" ? (
              <Repeat1 className="h-5 w-5" />
            ) : (
              <Repeat className="h-5 w-5" />
            )}
            {repeatMode === "playlist" && (
              <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-teal-400" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between px-3 pt-2">
          {/* 1. KOLEJKA */}
          <button
            onClick={() => setIsQueueOpen(true)}
            className={`p-2 transition active:scale-90 cursor-pointer ${
              isQueueOpen
                ? "text-teal-400 [html.light_&]:!text-[#db2777]"
                : "text-gray-400 hover:text-white [html.light_&]:!text-[#9f1239] [html.light_&]:hover:opacity-80"
            }`}
            title="Kolejka odtwarzania"
          >
            <ListMusic className="h-5 w-5 stroke-[2.2] [html.light_&]:!stroke-[#9f1239]" />
          </button>

          {/* 2. SONGIFY DŻEM */}
          <button
            onClick={() => setJamModalOpen(true)}
            className={`relative p-2 transition active:scale-90 cursor-pointer ${
              jamCode || isJamModalOpen
                ? "text-teal-400 [html.light_&]:!text-[#db2777]"
                : "text-gray-400 hover:text-white [html.light_&]:!text-[#9f1239] [html.light_&]:hover:opacity-80"
            }`}
            title="Songify Dżem (Wspólna sesja)"
          >
            <JamJarIcon className="h-5 w-5" />
            {jamCode && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-teal-400 [html.light_&]:bg-[#db2777] animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setDevicePickerOpen(true)}
            className={`p-2 transition active:scale-90 cursor-pointer ${
              isPlayingRemotely
                ? "text-teal-400 animate-pulse [html.light_&]:!text-[#db2777]"
                : "text-gray-400 hover:text-white [html.light_&]:!text-[#9f1239] [html.light_&]:hover:opacity-80"
            }`}
            title="Wybierz urządzenie do odtwarzania"
          >
            <Laptop className="h-5 w-5 stroke-[2.2] [html.light_&]:!stroke-[#9f1239]" />
          </button>

          <button
            onClick={() => setAddToPlaylistOpen(true)}
            className="p-2 text-gray-400 hover:text-white transition active:scale-90 cursor-pointer [html.light_&]:!text-[#9f1239] [html.light_&]:hover:opacity-80"
            title="Dodaj do playlisty"
          >
            <FolderPlus className="h-5 w-5 stroke-[2.2] [html.light_&]:!stroke-[#9f1239]" />
          </button>

          <button
            onClick={() => setIsSleepModalOpen(true)}
            className={`flex items-center gap-1.5 p-2 transition active:scale-90 cursor-pointer ${
              sleepTimerEndsAt || sleepTimerMode === "end_of_track"
                ? "text-teal-400 font-bold [html.light_&]:!text-[#db2777]"
                : "text-gray-400 hover:text-white [html.light_&]:!text-[#9f1239] [html.light_&]:hover:opacity-80"
            }`}
            title="Wyłącznik czasowy (Sleep Timer)"
          >
            <Moon className="h-5 w-5 stroke-[2.2] flex-shrink-0 [html.light_&]:!stroke-[#9f1239]" />
            {remainingTimerText ? (
              <span className="font-mono text-xs font-bold tracking-tight [html.light_&]:!text-[#9f1239]">
                {remainingTimerText}
              </span>
            ) : sleepTimerMode === "end_of_track" ? (
              <span className="text-[11px] font-semibold tracking-tight [html.light_&]:!text-[#9f1239]">
                Koniec
              </span>
            ) : null}
          </button>
        </div>
      </div>

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
          <div className="w-full max-w-xs rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612] [html.light_&]:shadow-2xl [html.light_&]:shadow-[#f472b6]/20">
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-3">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
                <h3 className="text-sm font-bold tracking-tight text-white [html.light_&]:text-[#5c0612]">
                  Wyłącznik czasowy
                </h3>
              </div>
              <button
                onClick={() => setIsSleepModalOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:bg-[#fce7f3] transition cursor-pointer"
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
                    {sleepTimerMode === "end_of_track"
                      ? "Po bieżącym utworze"
                      : `Za około ${remainingTimerText}`}
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
                  className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 [html.light_&]:bg-[#fee2e2] [html.light_&]:text-[#dc2626] text-[11px] font-bold transition cursor-pointer"
                >
                  Wyłącz
                </button>
              </div>
            )}

            <div className="relative my-3 flex flex-col items-center select-none">
              <div className="pointer-events-none absolute top-1/2 left-0 right-0 h-11 -translate-y-1/2 rounded-xl border border-teal-500/40 bg-teal-500/10 [html.light_&]:border-[#f472b6] [html.light_&]:bg-[#fdf2f8]" />

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
                          ? "text-xl text-teal-400 scale-110 [html.light_&]:text-[#be123c]"
                          : "text-gray-500 opacity-40 hover:opacity-80 text-sm [html.light_&]:text-[#f472b6]"
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
                  ? "border-teal-400 bg-teal-950/40 text-teal-300 [html.light_&]:border-[#db2777] [html.light_&]:bg-[#fdf2f8] [html.light_&]:text-[#be123c]"
                  : "border-teal-950/70 bg-[#121c20] text-gray-300 hover:text-teal-400 [html.light_&]:border-[#fce7f3] [html.light_&]:bg-[#fff5f7] [html.light_&]:text-[#9f1239] [html.light_&]:hover:border-[#fbcfe8]"
              }`}
            >
              <span>Uśpij na koniec tego utworu</span>
              {sleepTimerMode === "end_of_track" && (
                <Check className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
              )}
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
              className="w-full rounded-2xl bg-teal-400 py-3 text-xs font-bold text-black shadow-lg shadow-teal-500/20 hover:scale-[1.02] active:scale-95 transition cursor-pointer [html.light_&]:bg-[#db2777] [html.light_&]:text-white [html.light_&]:shadow-[#db2777]/30 [html.light_&]:hover:bg-[#be123c]"
            >
              Ustaw wyłącznik na {selectedWheelMinutes} min
            </button>
          </div>
        </div>
      )}

      {/* 1. MODAL OPCJI (3 KROPKI) */}
      {isOptionsMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 px-4 pb-6 sm:pb-0 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xs rounded-3xl border border-teal-900/80 bg-[#0c1417] p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612] [html.light_&]:shadow-xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-3">
              <h3 className="text-sm font-bold tracking-tight text-white [html.light_&]:text-[#5c0612]">
                Opcje utworu
              </h3>
              <button
                type="button"
                onClick={() => setIsOptionsMenuOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] transition cursor-pointer"
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
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL POTWIERDZENIA PRZEŁADOWANIA OKŁADKI */}
      {isReloadCoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]">
            <div className="flex items-center gap-2.5 text-teal-400 [html.light_&]:text-[#db2777] mb-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <h3 className="text-sm font-bold tracking-tight text-white [html.light_&]:text-[#5c0612]">
                Przeładowanie okładki
              </h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed [html.light_&]:text-[#881337] mb-5">
              Jeśli masz pewność że okładka nie zgadza się z piosenką kliknij poniższy przycisk <b>Przeładuj okładkę</b>.
              <span className="block mt-2 text-gray-400 [html.light_&]:text-[#9f1239]">
                Nie naduzywaj tej opcji , okładka powinna sie zmienić na poprawną po pierwszym przeładowaniu jeśli tak nie jest wyślij zrzut ekranu do administratora aplikacji.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReloadCoverModalOpen(false)}
                disabled={isReloadingCover}
                className="rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white transition cursor-pointer [html.light_&]:text-[#9f1239] [html.light_&]:hover:text-[#5c0612]"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleForceReloadCover}
                disabled={isReloadingCover}
                className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-teal-500/20 hover:scale-[1.02] active:scale-95 transition disabled:opacity-50 cursor-pointer [html.light_&]:bg-[#db2777] [html.light_&]:text-white"
              >
                {isReloadingCover && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isReloadingCover ? "Przeładowywanie..." : "Przeładuj okładkę"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
{/* 3. MODAL WKLEJANIA BEZPOŚREDNIEGO LINKU DO OKŁADKI */}
      {isCustomCoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]">
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-4">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
                <h3 className="text-sm font-bold tracking-tight">Wklej link do okładki</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomCoverModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomCover} className="space-y-4">
              <p className="text-[11px] text-gray-300 [html.light_&]:text-[#881337] leading-relaxed">
                Skopiuj i wklej bezpośredni adres grafiki (np. z Apple Music, Spotify lub wyszukiwarki). Okładka natychmiast nadpisze się w bazie danych dla tego utworu.
              </p>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 [html.light_&]:text-[#9f1239]">
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
                  className="w-full rounded-xl border border-teal-900/60 bg-[#162125] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]"
                />
              </div>

              {/* Podgląd grafiki w czasie rzeczywistym */}
              {customCoverUrl.trim().startsWith("http") && (
                <div className="flex items-center gap-3 p-2 rounded-2xl bg-[#121c20] border border-teal-950/60 [html.light_&]:bg-[#fff1f2] [html.light_&]:border-[#fecdd3]">
                  <img
                    src={customCoverUrl.trim()}
                    alt="Podgląd"
                    className="h-12 w-12 rounded-xl object-cover bg-black/40 flex-shrink-0"
                    onError={() => setCustomCoverError("Podany link nie jest poprawnym adresem obrazka.")}
                  />
                  <div className="flex flex-col truncate text-[11px]">
                    <span className="font-semibold text-white [html.light_&]:text-[#5c0612]">Podgląd okładki</span>
                    <span className="text-gray-400 truncate [html.light_&]:text-[#9f1239]">{customCoverUrl}</span>
                  </div>
                </div>
              )}

              {customCoverError && (
                <div className="rounded-xl bg-red-950/40 border border-red-800/50 p-2.5 text-xs text-red-300">
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
                  className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-black hover:bg-teal-300 disabled:opacity-50 cursor-pointer [html.light_&]:bg-[#db2777] [html.light_&]:text-white shadow-lg shadow-teal-500/20"
                >
                  {isSavingCustomCover && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSavingCustomCover ? "Zapisywanie..." : "Zapisz okładkę"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL PODMIANY LINKU DO AUDIO Z YOUTUBE */}
      {isCustomYtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]">
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-4">
              <div className="flex items-center gap-2">
                <YoutubeIcon className="h-5 w-5 text-red-500 [html.light_&]:text-[#e11d48]" />
                <h3 className="text-sm font-bold tracking-tight">Własny link YouTube</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomYtModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomYouTube} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 [html.light_&]:text-[#9f1239]">
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
                  className="w-full rounded-xl border border-teal-900/60 bg-[#162125] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]"
                />
              </div>

              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 text-[11px] text-amber-200/90 [html.light_&]:bg-[#fffbeb] [html.light_&]:border-[#fde68a] [html.light_&]:text-[#92400e] leading-relaxed">
                <span className="font-bold block mb-1">Upewnij się przed zapisem:</span>
                Sprawdź, czy wybrany film to <b>wersja studyjna</b> utworu – bez zbędnych wstępów filmowych, dialogów, wstawek teledyskowych czy niechcianych remiksów.
              </div>

              {customYtError && (
                <div className="rounded-xl bg-red-950/40 border border-red-800/50 p-2.5 text-xs text-red-300">
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
                  className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-black hover:bg-teal-300 disabled:opacity-50 cursor-pointer [html.light_&]:bg-[#db2777] [html.light_&]:text-white shadow-lg shadow-teal-500/20"
                >
                  {isSavingCustomYt && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSavingCustomYt ? "Zapisywanie..." : "Zapisz i odtwórz"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal wyboru urządzenia (Songify Connect) */}
      <DevicePickerModal />
    </div>
  );
}

// Podkomponent okładki w kolejce z automatycznym dociąganiem brakujących grafik
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
    <div className="relative h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-[#162125] border border-teal-950/50 [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3]">
      {cover ? (
        <img
          src={cover}
          alt={track.title}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <Music2 className="h-4 w-4 text-teal-400/50 [html.light_&]:text-[#db2777]" />
        </div>
      )}
    </div>
  );
}