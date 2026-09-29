"use client";

import { useState, useEffect, useRef } from "react";
import { usePlayerStore } from "@/lib/store/player-store";
import { toggleLikeTrack, isTrackLiked, addSongToPlaylist } from "@/app/actions/playlist";
import {
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
} from "lucide-react";
import { useDeviceStore } from "@/lib/store/device-store";
import DevicePickerModal from "./DevicePickerModal";

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

  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [remainingTimerText, setRemainingTimerText] = useState<string | null>(null);
  const [selectedWheelMinutes, setSelectedWheelMinutes] = useState<number>(30);
  const wheelRef = useRef<HTMLDivElement>(null);

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
  const [quickAddedSuccess, setQuickAddedSuccess] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

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
      isTrackLiked(currentTrack.id).then((liked) => {
        setIsLiked(liked);
      });
    }
  }, [currentTrack?.id, setIsLiked]);

  const handleLikeClick = async () => {
    if (!currentTrack) return;

    setAnimatingHeart(true);
    setTimeout(() => setAnimatingHeart(false), 500);

    const nextState = !isLiked;
    setIsLiked(nextState);

    try {
      const res = await toggleLikeTrack({
        id: String(currentTrack.id),
        title: currentTrack.title,
        artist: currentTrack.artist,
        albumCover: currentTrack.albumCover,
        duration: currentTrack.duration,
      });
      setIsLiked(res.liked);
    } catch (err) {
      console.error("Błąd zapisu polubienia:", err);
      setIsLiked(!nextState);
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
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-[#0f1f24] via-[#090e11] to-[#090e11] px-6 py-6 text-white animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPlayerExpanded(false)}
          className="p-2 text-gray-400 hover:text-white transition"
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

        <div className="w-10" />
      </div>

      <div className="my-auto flex flex-col items-center w-full">
        <div className="relative aspect-square w-full max-w-[310px] overflow-hidden rounded-3xl border border-teal-800/40 shadow-2xl shadow-teal-950/80">
          <img
            src={currentTrack.albumCover}
            alt={currentTrack.title}
            className="h-full w-full object-cover"
          />
          {isLoadingAudio && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <Loader2 className="h-10 w-10 animate-spin text-teal-400" />
            </div>
          )}
        </div>

        <div className="mt-7 flex w-full max-w-[310px] items-center justify-between gap-4">
          <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,black_85%,transparent_100%)]">
            <div className="overflow-hidden">
              <h2
                className={`text-xl font-bold tracking-tight text-white ${
                  isLongTitle ? "animate-marquee" : ""
                }`}
              >
                {currentTrack.title}
              </h2>
            </div>
            <p className="truncate text-sm font-medium text-teal-400/90 mt-0.5">
              {currentTrack.artist}
            </p>
          </div>

          <button
            onClick={handleLikeClick}
            className={`p-2 transition active:scale-90 flex-shrink-0 z-10 ${
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
          {/* Kontener paska z idealnie widocznym wypełnieniem */}
          <div className="relative flex items-center h-4 w-full cursor-pointer group">
            {/* Tło paska (szary tor) */}
            <div className="absolute w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
              {/* Turkusowe podświetlenie odtworzonej części */}
              <div
                className="h-full bg-teal-400 rounded-full transition-[width] duration-150"
                style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
              />
            </div>

            {/* Niewidzialny input chwytający dotyk i suwak */}
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step="0.1"
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />

            {/* Kropka (Thumb) podążająca za paskiem */}
            <div
              className="absolute h-3.5 w-3.5 -ml-1.5 rounded-full bg-teal-400 shadow-md shadow-teal-500/50 pointer-events-none transition-[left] duration-150"
              style={{
                left: `${Math.min(Math.max(progressPercent, 0), 100)}%`,
              }}
            />
          </div>

          <div className="mt-1 flex justify-between text-[11px] font-mono text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-2">
          {/* Przełącznik trybu odtwarzania: Strzałka (po kolei) <-> Przeplatane (losowo) */}
          <button
            onClick={toggleShuffle}
            className="p-2 text-gray-400 hover:text-white transition active:scale-90"
            title={isShuffle ? "Odtwarzanie losowe" : "Odtwarzanie po kolei"}
          >
            {isShuffle ? (
              <Shuffle className="h-5 w-5" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}
          </button>

          {/* Przycisk Poprzedni */}
          <button
            onClick={previousTrack}
            className="p-2 text-gray-300 hover:text-white transition active:scale-90"
            title="Poprzedni utwór"
          >
            <SkipBack className="h-7 w-7" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => {
              if (isLoadingAudio) return;
              togglePlay();
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-400 text-black shadow-lg shadow-teal-500/30 transition hover:scale-105 active:scale-95"
          >
            {isPlaying && !isLoadingAudio ? (
              <Pause className="h-7 w-7 fill-black" />
            ) : (
              <Play className="h-7 w-7 fill-black ml-1" />
            )}
          </button>

          {/* Przycisk Następny */}
          <button
            onClick={() => nextTrack()}
            className="p-2 text-gray-300 hover:text-white transition active:scale-90"
            title="Następny utwór"
          >
            <SkipForward className="h-7 w-7" />
          </button>

          {/* Przycisk powtarzania (off -> playlist -> track) */}
          <button
            onClick={toggleRepeat}
            className={`p-2 transition relative active:scale-90 ${
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

        {/* Dolny pasek akcji: 5 czystych, równych ikon ze Spotify Connect */}
        <div className="flex items-center justify-between px-3 pt-2">
          {/* Przycisk Kolejki Odtwarzania */}
          <button
            onClick={() => setIsQueueOpen(true)}
            className={`p-2 transition active:scale-90 ${
              isQueueOpen
                ? "text-teal-400 [html.light_&]:!text-[#db2777]"
                : "text-gray-400 hover:text-white [html.light_&]:!text-[#9f1239] [html.light_&]:hover:opacity-80"
            }`}
            title="Kolejka odtwarzania"
          >
            <ListMusic className="h-5 w-5 stroke-[2.2] [html.light_&]:!stroke-[#9f1239]" />
          </button>

          {/* Przycisk Urządzenia (Songify Connect) */}
          <button
            onClick={() => setDevicePickerOpen(true)}
            className={`p-2 transition active:scale-90 ${
              isPlayingRemotely
                ? "text-teal-400 animate-pulse [html.light_&]:!text-[#db2777]"
                : "text-gray-400 hover:text-white [html.light_&]:!text-[#9f1239] [html.light_&]:hover:opacity-80"
            }`}
            title="Wybierz urządzenie do odtwarzania"
          >
            <Laptop className="h-5 w-5 stroke-[2.2] [html.light_&]:!stroke-[#9f1239]" />
          </button>

          {/* Przycisk Dodaj do playlisty (otwiera modal wyboru playlist) */}
          <button
            onClick={() => setAddToPlaylistOpen(true)}
            className="p-2 text-gray-400 hover:text-white transition active:scale-90 [html.light_&]:!text-[#9f1239] [html.light_&]:hover:opacity-80"
            title="Dodaj do playlisty"
          >
            <FolderPlus className="h-5 w-5 stroke-[2.2] [html.light_&]:!stroke-[#9f1239]" />
          </button>

          {/* Przycisk Udostępnij */}
          <button
            onClick={handleShare}
            className="p-2 text-gray-400 hover:text-white transition active:scale-90 [html.light_&]:!text-[#9f1239] [html.light_&]:hover:opacity-80"
            title="Udostępnij utwór"
          >
            <Share2 className="h-5 w-5 stroke-[2.2] [html.light_&]:!stroke-[#9f1239]" />
          </button>

          {/* Przycisk Sleep Timer */}
          <button
            onClick={() => setIsSleepModalOpen(true)}
            className={`flex items-center gap-1.5 p-2 transition active:scale-90 ${
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

      {/* Dopracowany widok Kolejki - idealny w motywie ciemnym i jasnym */}
      {isQueueOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#070b0d] text-white px-5 pt-4 pb-8 select-none animate-in slide-in-from-bottom-3 duration-200">
          {/* Górna belka */}
          <div className="flex items-center justify-between pb-3 border-b border-teal-950/60">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Kolejka</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Odtwarzanie z: <span className="font-semibold text-teal-400">{currentTrack.source || "Kolejka"}</span>
              </p>
            </div>
            <button
              onClick={() => setIsQueueOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#121c20] border border-teal-900/60 text-gray-300 hover:text-white transition active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Główna lista - BEZ SUWAKA */}
          <div className="flex-1 overflow-y-auto space-y-4 pt-3 pr-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* SEKCJA 1: TERAZ ODTWARZANE */}
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
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-400 text-black shadow-md shadow-teal-500/30 transition hover:scale-105 active:scale-90"
                >
                  {isPlaying && !isLoadingAudio ? (
                    <Pause className="h-5 w-5 fill-black" />
                  ) : (
                    <Play className="h-5 w-5 fill-black ml-0.5" />
                  )}
                </button>
              </div>
            </div>

            {/* SEKCJA 2: NASTĘPNE W KOLEJCE */}
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
                        {/* TŁO GESTÓW SWIPE */}
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

                        {/* KARTA UTWORU */}
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

                            <div className="relative h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-[#162125] border border-teal-950/50">
                              {track.albumCover ? (
                                <img
                                  src={track.albumCover}
                                  alt={track.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <Music2 className="h-4 w-4 text-teal-400/50" />
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col truncate">
                              <span className="truncate text-xs font-semibold text-white">
                                {track.title}
                              </span>
                              <span className="truncate text-[11px] text-gray-400 mt-0.5">
                                {track.artist}
                              </span>
                            </div>
                          </div>

                          {/* Chwytak do przesuwania góra/dół */}
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

      {/* Modal Sleep Timera - z czytelnymi kolorami w Dark i Light */}
      {isSleepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 px-4 pb-6 sm:pb-0 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xs rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612] [html.light_&]:shadow-2xl [html.light_&]:shadow-[#f472b6]/20">
            {/* Nagłówek */}
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-3">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
                <h3 className="text-sm font-bold tracking-tight text-white [html.light_&]:text-[#5c0612]">
                  Wyłącznik czasowy
                </h3>
              </div>
              <button
                onClick={() => setIsSleepModalOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:bg-[#fce7f3] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stan aktualnego timera (jeśli aktywny) */}
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
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 [html.light_&]:bg-[#fee2e2] [html.light_&]:text-[#dc2626] text-[11px] font-bold transition"
                >
                  Wyłącz
                </button>
              </div>
            )}

            {/* BĘBENEK / WAŁEK CZASU (1 - 60 MIN) */}
            <div className="relative my-3 flex flex-col items-center select-none">
              {/* Podświetlony pasek środka wałka */}
              <div className="pointer-events-none absolute top-1/2 left-0 right-0 h-11 -translate-y-1/2 rounded-xl border border-teal-500/40 bg-teal-500/10 [html.light_&]:border-[#f472b6] [html.light_&]:bg-[#fdf2f8]" />

              {/* Kontener scrolla wałka */}
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

            {/* Przycisk: Koniec tego utworu */}
            <button
              onClick={() => {
                setSleepTimer(null, "end_of_track");
                setIsSleepModalOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border mb-3 text-xs font-semibold transition ${
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

            {/* Przycisk aktywacji wybranego czasu z rolki */}
            <button
              onClick={() => {
                setSleepTimer(selectedWheelMinutes, "time");
                setIsSleepModalOpen(false);
              }}
              className="w-full rounded-2xl bg-teal-400 py-3 text-xs font-bold text-black shadow-lg shadow-teal-500/20 hover:scale-[1.02] active:scale-95 transition [html.light_&]:bg-[#db2777] [html.light_&]:text-white [html.light_&]:shadow-[#db2777]/30 [html.light_&]:hover:bg-[#be123c]"
            >
              Ustaw wyłącznik na {selectedWheelMinutes} min
            </button>
          </div>
        </div>
      )}

      {/* Modal wyboru urządzenia (Songify Connect) */}
      <DevicePickerModal />
    </div>
  );
}