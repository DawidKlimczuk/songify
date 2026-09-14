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
  Loader2,
} from "lucide-react";
import { usePlayerStore, Track } from "@/lib/store/player-store";
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
  } = usePlayerStore();

  const [playlist, setPlaylist] = useState<{
    id: string;
    title: string;
    cover: string;
    tracks: Track[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // ID playlisty "Polubione utwory" oraz zbiór polubionych tytułów/ID dla szybkiego lookupu
  const [likedPlaylistId, setLikedPlaylistId] = useState<string | null>(null);
  const [likedSongKeys, setLikedSongKeys] = useState<Set<string>>(new Set());

  // Pobieranie playlisty oraz aktualnych polubionych utworów użytkownika
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
          likedData.songs?.forEach((item: any) => {
            // Indeksujemy po unikalnym kluczu "tytuł_artysta" dla pewności między Deezerem a bazą
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

    // Optymistyczna zmiana w UI
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
      // Rollback przy błędzie
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

  const handlePlayAll = (startRandom: boolean = false) => {
    if (playlist.tracks.length === 0) return;

    if (!startRandom && currentTrack?.source === playlist.title) {
      togglePlay();
      return;
    }

    const queue: Track[] = playlist.tracks.map((t) => ({
      ...t,
      source: playlist.title,
    }));

    if (startRandom) {
      if (!isShuffle) toggleShuffle();
      const randomIndex = Math.floor(Math.random() * queue.length);
      setCurrentTrack(queue[randomIndex], queue);
    } else {
      setCurrentTrack(queue[0], queue);
    }
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
          Deezer Playlist
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

      {/* Kontrolki Odtwarzania */}
      <div className="flex items-center justify-center gap-6 mb-6 px-4">
        <button
          onClick={() => handlePlayAll(false)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-400 text-black shadow-lg shadow-teal-500/20 hover:scale-105 active:scale-95 transition"
        >
          {isPlayingThisPlaylist ? (
            <Pause className="h-6 w-6 fill-black" />
          ) : (
            <Play className="h-6 w-6 fill-black ml-0.5" />
          )}
        </button>

        <button
          onClick={() => handlePlayAll(true)}
          className={`flex h-11 w-11 items-center justify-center rounded-full bg-[#0e1619] border border-teal-900/40 transition active:scale-95 ${
            isShuffle
              ? "text-teal-400 border-teal-500/40"
              : "text-gray-400 hover:text-white"
          }`}
          title="Odtwarzaj losowo"
        >
          <Shuffle className="h-5 w-5" />
        </button>
      </div>

      {/* Lista utworów */}
      <div className="space-y-2">
        {playlist.tracks.map((song, index) => {
          const isThisTrackPlaying =
            isPlaying && String(currentTrack?.id) === String(song.id);
          const liked = isSongLiked(song);

          return (
            <div
              key={`${song.id}-${index}`}
              onClick={() => {
                const queue = playlist.tracks.map((t) => ({
                  ...t,
                  source: playlist.title,
                }));
                setCurrentTrack(
                  { ...song, source: playlist.title },
                  queue
                );
              }}
              className={`flex items-center justify-between rounded-xl bg-[#0e1619] border p-2.5 active:scale-[0.98] transition cursor-pointer ${
                isThisTrackPlaying
                  ? "border-teal-400/80 bg-teal-950/20"
                  : "border-teal-950/60 hover:border-teal-800/60"
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
                <span className="w-5 text-center text-xs text-gray-500 font-mono flex-shrink-0">
                  {index + 1}
                </span>
                <img
                  src={song.albumCover}
                  alt={song.title}
                  className="h-11 w-11 rounded-lg object-cover flex-shrink-0"
                />
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

              {/* Przyciski Akcji: Serduszko (Polubione) oraz Plus (Dodaj do playlisty) */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => handleToggleLike(e, song)}
                  className={`p-2 transition active:scale-125 ${
                    liked
                      ? "text-teal-400"
                      : "text-gray-500 hover:text-white"
                  }`}
                  title={liked ? "Usuń z polubionych" : "Dodaj do polubionych"}
                >
                  <Heart
                    className={`h-4 w-4 ${
                      liked ? "fill-teal-400" : ""
                    }`}
                  />
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
          );
        })}
      </div>
    </div>
  );
}