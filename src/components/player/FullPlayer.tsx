"use client";

import { useState, useEffect } from "react";
import { usePlayerStore } from "@/lib/store/player-store";
import { toggleLikeTrack, isTrackLiked } from "@/app/actions/playlist";
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
} from "lucide-react";

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
    nextTrack,
    previousTrack,
    seekTo,
    setAddToPlaylistOpen,
  } = usePlayerStore();

  const [animatingHeart, setAnimatingHeart] = useState(false);

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
          {/* Przycisk trybu losowego */}
          <button
            onClick={toggleShuffle}
            className={`p-2 transition ${
              isShuffle ? "text-teal-400" : "text-gray-400 hover:text-white"
            }`}
            title={isShuffle ? "Włączone losowe" : "Włączona kolejność"}
          >
            {isShuffle ? <Shuffle className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
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
            onClick={togglePlay}
            disabled={isLoadingAudio}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-400 text-black shadow-lg shadow-teal-500/30 transition hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isPlaying ? (
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

          <button
            onClick={handleShare}
            className="p-2 text-gray-400 hover:text-white transition active:scale-90"
            title="Udostępnij"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        <div className="flex justify-center pt-1">
          <button
            onClick={() => setAddToPlaylistOpen(true)}
            className="flex items-center gap-2 rounded-full border border-teal-900/50 bg-[#0e1619] px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white hover:border-teal-500/50 transition"
          >
            <FolderPlus className="h-4 w-4 text-teal-400" />
            <span>Dodaj do playlisty</span>
          </button>
        </div>
      </div>
    </div>
  );
}