"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  Shuffle,
  Music,
  Heart,
  Plus,
  ArrowDownToLine,
  ArrowRight,
  Loader2,
  ListPlus,
  Check,
} from "lucide-react";
import { usePlayerStore, Track } from "@/lib/store/player-store";
import { useJamStore } from "@/lib/store/jam-store";
import { addTrackToJamSession } from "@/components/player/JamModal";
import {
  getOrCreateLikedPlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
} from "@/app/actions/playlist";

export default function PublicPlaylistPage() {
  const router = useRouter();
  const params = useParams();
  const playlistId = params.id as string;

  const {
    currentTrack,
    setCurrentTrack,
    isPlaying,
    togglePlay,
    isShuffle,
    toggleShuffle,
    setIsLiked,
    setAddToPlaylistOpen,
    addToQueue,
  } = usePlayerStore();

  // Stan swipe gestu wyłącznie w prawo (dodawanie do kolejki)
  const [swipedIdx, setSwipedIdx] = useState<{
    idx: number;
    startX: number;
    startY: number;
    currentX: number;
    isLockedVertical?: boolean;
    isLockedHorizontal?: boolean;
    isMouseDown?: boolean;
  } | null>(null);

  const [addedQueueNotice, setAddedQueueNotice] = useState<string | null>(null);

  const [playlist, setPlaylist] = useState<{
    id: string;
    title: string;
    cover: string;
    tracks: Track[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [likedPlaylistId, setLikedPlaylistId] = useState<string | null>(null);
  const [likedSongKeys, setLikedSongKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!playlistId) return;

    const loadAll = async () => {
      try {
        const [playlistRes, likedData] = await Promise.all([
          fetch(`/api/deezer/playlist/${playlistId}`).then((res) => res.json()),
          getOrCreateLikedPlaylist(),
        ]);

        if (playlistRes.tracks) {
          setPlaylist(playlistRes);
        }

        if (likedData) {
          setLikedPlaylistId(likedData.id);
          const keys = new Set<string>();
          (likedData as any).songs?.forEach((item: any) => {
            const key = `${item.song.title.toLowerCase().trim()}_${item.song.artist.toLowerCase().trim()}`;
            keys.add(key);
            keys.add(String(item.song.id));
          });
          setLikedSongKeys(keys);
        }
      } catch (err) {
        console.error("Błąd ładowania danych playlisty:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [playlistId]);

  const isSongLiked = (song: Track) => {
    const key = `${song.title.toLowerCase().trim()}_${song.artist.toLowerCase().trim()}`;
    return likedSongKeys.has(key) || likedSongKeys.has(String(song.id));
  };

  const handleToggleLike = async (e: React.MouseEvent, song: Track) => {
    e.stopPropagation();
    if (!likedPlaylistId) return;

    const key = `${song.title.toLowerCase().trim()}_${song.artist.toLowerCase().trim()}`;
    const currentlyLiked = isSongLiked(song);

    const updated = new Set(likedSongKeys);
    if (currentlyLiked) {
      updated.delete(key);
      updated.delete(String(song.id));
    } else {
      updated.add(key);
      updated.add(String(song.id));
    }
    setLikedSongKeys(updated);

    if (String(currentTrack?.id) === String(song.id)) {
      setIsLiked(!currentlyLiked);
    }

    try {
      if (currentlyLiked) {
        await removeSongFromPlaylist(likedPlaylistId, String(song.id));
      } else {
        await addSongToPlaylist(likedPlaylistId, {
          id: song.id,
          title: song.title,
          artist: song.artist,
          albumCover: song.albumCover,
          duration: song.duration,
        });
      }
    } catch (err) {
      console.error("Błąd aktualizacji polubienia:", err);
      setLikedSongKeys(likedSongKeys);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-teal-400 text-xs">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Ładowanie playlisty...
      </div>
    );
  }

  if (!playlist || playlist.tracks.length === 0) {
    return (
      <div className="min-h-screen p-6 text-center text-gray-400 text-xs pt-24">
        <p>Nie udało się załadować playlisty.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-xl bg-[#0e1619] border border-teal-900/40 px-4 py-2 text-white"
        >
          Wróć
        </button>
      </div>
    );
  }

  const isPlayingThisPlaylist =
    isPlaying && currentTrack?.source === playlist.title;

  const handlePlayAll = () => {
    if (playlist.tracks.length === 0) return;

    if (currentTrack?.source === playlist.title) {
      togglePlay();
      return;
    }

    const queue: Track[] = playlist.tracks.map((t) => ({
      ...t,
      source: playlist.title,
    }));

    setCurrentTrack(queue[0], queue);
  };

  const handleTogglePlaylistShuffle = () => {
    toggleShuffle();
  };

  return (
    <div className="min-h-screen pb-36 pt-4 px-4 text-white">
      {/* Pasek Górny */}
      <div className="flex items-center justify-between mb-4 w-full">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Wróć</span>
        </button>
        <span className="text-xs font-semibold text-teal-400 uppercase tracking-widest">
          Songify Playlist
        </span>
        <div className="w-10" />
      </div>

      {/* Nagłówek Playlisty */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="relative aspect-square w-44 rounded-2xl overflow-hidden border border-teal-800/40 shadow-xl mb-4 flex items-center justify-center bg-[#0e1619]">
          {playlist.cover ? (
            <img
              src={playlist.cover}
              alt={playlist.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <Music className="h-16 w-16 text-teal-500/40" />
          )}
        </div>
        <h1 className="text-xl font-bold tracking-tight">{playlist.title}</h1>
        <p className="text-xs text-gray-400 mt-1">
          {playlist.tracks.length} utworów
        </p>
      </div>

      {/* Kontrolki Odtwarzania: Pobierz | Play/Pause | Shuffle */}
      <div className="flex items-center justify-center gap-6 mb-6 px-4">
        <button
          onClick={() => {}}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0e1619] border border-teal-900/40 text-gray-400 hover:text-white transition active:scale-95"
          title="Pobierz playlistę"
        >
          <ArrowDownToLine className="h-5 w-5" />
        </button>

        <button
          onClick={handlePlayAll}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-400 text-black shadow-lg shadow-teal-500/20 hover:scale-105 active:scale-95 transition"
        >
          {isPlayingThisPlaylist ? (
            <Pause className="h-6 w-6 fill-black" />
          ) : (
            <Play className="h-6 w-6 fill-black ml-0.5" />
          )}
        </button>

        <button
          onClick={handleTogglePlaylistShuffle}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-teal-900/40 bg-[#0e1619] text-teal-400 hover:text-white hover:border-teal-500/50 transition active:scale-95 shadow-sm"
          title={isShuffle ? "Tryb: Odtwarzanie losowe" : "Tryb: Odtwarzanie po kolei"}
        >
          {isShuffle ? (
            <Shuffle className="h-5 w-5 stroke-[2.2]" />
          ) : (
            <ArrowRight className="h-5 w-5 stroke-[2.2]" />
          )}
        </button>
      </div>

      {/* Pływające powiadomienie o dodaniu do kolejki */}
      {addedQueueNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-teal-400 px-4 py-2 text-xs font-bold text-black shadow-xl shadow-teal-950/60 animate-in fade-in slide-in-from-top-3 duration-200">
          <Check className="h-4 w-4 stroke-[3]" />
          <span>Dodano do kolejki: {addedQueueNotice}</span>
        </div>
      )}

      {/* Lista utworów z blokadą osi pionowej i gestem Swipe w prawo */}
      <div className="space-y-2">
        {playlist.tracks.map((song, index) => {
          const isThisTrackPlaying =
            isPlaying && String(currentTrack?.id) === String(song.id);
          const liked = isSongLiked(song);

          const isBeingSwiped = swipedIdx?.idx === index && swipedIdx.isLockedHorizontal;
          const rawDiff = isBeingSwiped ? swipedIdx.currentX - swipedIdx.startX : 0;
          // BLOKADA W LEWO: Przesunięcie może być wyłącznie w prawo (> 0)
          const clampedDiff = Math.max(0, rawDiff);
          const offsetX = clampedDiff > 10 ? clampedDiff : 0;

          const handleSwipeEnd = async () => {
            if (swipedIdx?.idx === index && swipedIdx.isLockedHorizontal) {
              const diffX = swipedIdx.currentX - swipedIdx.startX;
              if (diffX > 75) {
                const trackData = { ...song, source: playlist.title };
                const isJamActive = Boolean(useJamStore.getState().jamCode);

                if (isJamActive) {
                  await addTrackToJamSession(trackData);
                  setAddedQueueNotice(`Dżem: ${song.title}`);
                } else {
                  addToQueue(trackData);
                  setAddedQueueNotice(song.title);
                }

                setTimeout(() => setAddedQueueNotice(null), 1800);
              }
            }
            setSwipedIdx(null);
          };

          return (
            <div
              key={`${song.id}-${index}`}
              className="relative overflow-hidden rounded-xl bg-[#091013]"
            >
              {/* TŁO GESTU: Odsłaniane TYLKO przy przesuwaniu w prawo */}
              {isBeingSwiped && offsetX > 8 && (
                <div className="absolute inset-0 flex items-center px-4 bg-teal-950 text-teal-400 swipe-action-next z-0">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <ListPlus className="h-4 w-4 stroke-[2.5]" />
                    <span>Dodaj do kolejki</span>
                  </div>
                </div>
              )}

              {/* KARTA UTWORU */}
              <div
                onTouchStart={(e) => {
                  setSwipedIdx({
                    idx: index,
                    startX: e.touches[0].clientX,
                    startY: e.touches[0].clientY,
                    currentX: e.touches[0].clientX,
                    isLockedVertical: false,
                    isLockedHorizontal: false,
                  });
                }}
                onTouchMove={(e) => {
                  if (!swipedIdx || swipedIdx.idx !== index) return;
                  if (swipedIdx.isLockedVertical) return;

                  const touch = e.touches[0];
                  const diffX = touch.clientX - swipedIdx.startX;
                  const diffY = touch.clientY - swipedIdx.startY;

                  // Blokada w lewo: jeśli palec idzie w lewo, nie traktujemy tego jako swipe
                  if (diffX < 0) return;

                  if (!swipedIdx.isLockedHorizontal) {
                    if (Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
                      setSwipedIdx({ ...swipedIdx, isLockedVertical: true });
                      return;
                    }
                    if (diffX > 12 && diffX > Math.abs(diffY)) {
                      setSwipedIdx({
                        ...swipedIdx,
                        isLockedHorizontal: true,
                        currentX: touch.clientX,
                      });
                      return;
                    }
                    return;
                  }

                  setSwipedIdx({
                    ...swipedIdx,
                    currentX: touch.clientX,
                  });
                }}
                onTouchEnd={handleSwipeEnd}
                onMouseDown={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  setSwipedIdx({
                    idx: index,
                    startX: e.clientX,
                    startY: e.clientY,
                    currentX: e.clientX,
                    isMouseDown: true,
                    isLockedHorizontal: true,
                  });
                }}
                onMouseMove={(e) => {
                  if (swipedIdx?.idx === index && swipedIdx.isMouseDown) {
                    const diffX = e.clientX - swipedIdx.startX;
                    if (diffX >= 0) {
                      setSwipedIdx({
                        ...swipedIdx,
                        currentX: e.clientX,
                      });
                    }
                  }
                }}
                onMouseUp={handleSwipeEnd}
                onMouseLeave={() => {
                  if (swipedIdx?.idx === index && swipedIdx.isMouseDown) {
                    handleSwipeEnd();
                  }
                }}
                style={{
                  transform: `translateX(${offsetX}px)`,
                  transition: isBeingSwiped ? "none" : "transform 0.2s ease-out",
                }}
                onClick={() => {
                  if (offsetX < 6) {
                    const queue = playlist.tracks.map((t) => ({
                      ...t,
                      source: playlist.title,
                    }));
                    setCurrentTrack({ ...song, source: playlist.title }, queue);
                  }
                }}
                className={`relative z-10 flex items-center justify-between rounded-xl bg-[#0e1619] border p-2.5 transition cursor-pointer select-none active:scale-[0.99] ${
                  isThisTrackPlaying
                    ? "border-teal-400/80 bg-teal-950/20"
                    : "border-teal-950/60 hover:border-teal-800/60"
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
                  <span className="w-5 text-center text-xs text-gray-500 font-mono flex-shrink-0">
                    {index + 1}
                  </span>
                  {song.albumCover ? (
                    <img
                      src={song.albumCover}
                      alt={song.title}
                      className="h-11 w-11 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded-lg bg-[#162125] flex items-center justify-center flex-shrink-0 border border-teal-950/60">
                      <Music className="h-5 w-5 text-teal-400/50" />
                    </div>
                  )}
                  <div className="flex flex-col truncate">
                    <span
                      className={`truncate text-xs font-bold ${
                        isThisTrackPlaying ? "text-teal-400" : "text-white"
                      }`}
                    >
                      {song.title}
                    </span>
                    <span className="truncate text-[11px] text-gray-400">
                      {song.artist}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => handleToggleLike(e, song)}
                    className={`p-2 transition active:scale-125 ${
                      liked ? "text-teal-400" : "text-gray-500 hover:text-white"
                    }`}
                    title={liked ? "Usuń z polubionych" : "Dodaj do polubionych"}
                  >
                    <Heart className={`h-4 w-4 ${liked ? "fill-teal-400" : ""}`} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentTrack({ ...song, source: playlist.title });
                      setAddToPlaylistOpen(true);
                    }}
                    className="p-2 text-gray-500 hover:text-teal-400 transition active:scale-125"
                    title="Dodaj do playlisty"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}