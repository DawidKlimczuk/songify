"use client";

import { useEffect, useState } from "react";
import { Play, Pause, Heart, SkipBack, SkipForward } from "lucide-react";
import { usePlayerStore } from "@/lib/store/player-store";
import { toggleLikeTrack, isTrackLiked } from "@/app/actions/playlist";

export default function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    isLiked,
    currentTime,
    duration,
    togglePlay,
    setIsLiked,
    setPlayerExpanded,
    nextTrack,
    previousTrack,
  } = usePlayerStore();

  const [animatingHeart, setAnimatingHeart] = useState(false);

  // Pobranie stanu polubienia z bazy danych
  useEffect(() => {
    if (currentTrack?.id) {
      isTrackLiked(currentTrack.id).then((liked) => {
        setIsLiked(liked);
      });
    }
  }, [currentTrack?.id, setIsLiked]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    previousTrack();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    nextTrack();
  };

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      onClick={() => setPlayerExpanded(true)}
      className="fixed bottom-20 left-3 right-3 z-40 mx-auto max-w-lg cursor-pointer rounded-2xl border border-teal-900/50 bg-[#0e1619]/95 p-2 backdrop-blur-md shadow-2xl transition hover:border-teal-700/60"
    >
      <div className="flex items-center justify-between gap-2">
        {/* Okładka + Tytuł i Wykonawca */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
          <img
            src={currentTrack.albumCover}
            alt={currentTrack.title}
            className="h-10 w-10 flex-shrink-0 rounded-xl object-cover border border-teal-900/40"
          />
          <div className="flex min-w-0 flex-col truncate">
            <span className="truncate text-xs font-bold text-white">
              {currentTrack.title}
            </span>
            <span className="truncate text-[11px] text-gray-400">
              {currentTrack.artist}
            </span>
          </div>
        </div>

        {/* Przyciski sterowania */}
        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
          {/* Serduszko */}
          <button
            onClick={handleLike}
            className={`p-1.5 text-gray-400 hover:text-white transition active:scale-75 ${
              animatingHeart ? "animate-heart-shake" : ""
            }`}
            title="Polub utwór"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                isLiked ? "fill-teal-400 text-teal-400" : "text-gray-400"
              }`}
            />
          </button>

          {/* Wstecz */}
          <button
            onClick={handlePrevious}
            className="p-1.5 text-gray-400 hover:text-white active:scale-75 transition"
            title="Poprzedni utwór"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-400 text-black shadow-md shadow-teal-400/20 hover:scale-105 active:scale-95 transition"
            title={isPlaying ? "Pauza" : "Odtwórz"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-black" />
            ) : (
              <Play className="h-4 w-4 fill-black ml-0.5" />
            )}
          </button>

          {/* Dalej */}
          <button
            onClick={handleNext}
            className="p-1.5 text-gray-400 hover:text-white active:scale-75 transition"
            title="Następny utwór"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Cienki pasek postępu */}
      <div className="absolute bottom-0 left-2.5 right-2.5 h-[2px] overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full bg-teal-400 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}