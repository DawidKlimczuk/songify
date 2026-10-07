"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, RefreshCw, Check, Loader2, Music, Sparkles } from "lucide-react";
import { usePlayerStore } from "@/lib/store/player-store";
import {
  getRecommendedSongsForPlaylist,
  addSongToPlaylist,
} from "@/app/actions/playlist";

interface Props {
  playlistId: string;
  songsCount: number;
  onSongAdded: () => void;
}

export function PlaylistRecommendations({
  playlistId,
  songsCount,
  onSongAdded,
}: Props) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);

  // Rejestr wszystkich odrzuconych w danej sesji (ID)
  const seenHistoryRef = useRef<Set<string>>(new Set());

  // Dostęp do globalnego odtwarzacza Songify
  const { setCurrentTrack, currentTrack, isPlaying } = usePlayerStore();

  const loadRecommendations = async (clearCurrent: boolean = false) => {
    if (songsCount === 0) return;
    setIsLoading(true);

    if (clearCurrent) {
      seenHistoryRef.current.clear();
    } else {
      // Zapamiętujemy tylko identyfikatory odrzuconych utworów
      recommendations.forEach((r) => {
        if (r.id) seenHistoryRef.current.add(String(r.id));
      });
    }

    const exclude = Array.from(seenHistoryRef.current);
    const data = await getRecommendedSongsForPlaylist(playlistId, exclude);

    if (Array.isArray(data) && data.length > 0) {
      data.forEach((r: any) => {
        if (r.id) seenHistoryRef.current.add(String(r.id));
      });
      setRecommendations(data);
    } else {
      // Zabezpieczenie: jeśli wyczerpaliśmy unikalną pulę, czyścimy historię i losujemy od nowa
      seenHistoryRef.current.clear();
      const retryData = await getRecommendedSongsForPlaylist(playlistId, []);
      setRecommendations(retryData || []);
    }

    setIsLoading(false);
  };

  const isLoadedForPlaylistRef = useRef<string | null>(null);

  useEffect(() => {
    // Ładujemy propozycje tylko raz przy wejściu do playlisty
    if (songsCount > 0 && isLoadedForPlaylistRef.current !== playlistId) {
      isLoadedForPlaylistRef.current = playlistId;
      loadRecommendations(true);
    }
  }, [playlistId, songsCount]);

  // Kliknięcie w utwór uruchamia go w głównym odtwarzaczu (dokładnie jak w Spotify)
  const handlePlayInApp = (song: any) => {
    setCurrentTrack({
      id: song.id,
      title: song.title,
      artist: song.artist,
      albumCover: song.albumCover,
      duration: song.duration,
      source: "Polecane utwory",
    });
  };

  const handleAddSong = async (song: any) => {
    if (addingId) return;
    setAddingId(song.id);

    try {
      await addSongToPlaylist(playlistId, song);
      setAddedIds((prev) => [...prev, song.id]);

      // Powiadamiamy widok główny o dodaniu utworu
      onSongAdded();

      // Po chwili usuwamy dodaną piosenkę z listy polecanych
      setTimeout(() => {
        setRecommendations((prev) => prev.filter((r) => r.id !== song.id));
        setAddedIds((prev) => prev.filter((id) => id !== song.id));
      }, 600);
    } catch (e) {
      console.error(e);
    } finally {
      setAddingId(null);
    }
  };

  // Scenariusz A: pusta playlista
  if (songsCount === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-teal-950/60 bg-[#0c1417]/60 p-5 text-center [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3]">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 [html.light_&]:bg-[#db2777]/10 [html.light_&]:text-[#db2777] mb-2">
          <Sparkles className="h-5 w-5" />
        </div>
        <h4 className="text-xs font-bold text-white [html.light_&]:text-[#5c0612]">
          Odkryj utwory dopasowane do playlisty
        </h4>
        <p className="mt-1 text-[11px] text-gray-400 [html.light_&]:text-[#9f1239] leading-relaxed max-w-sm mx-auto">
          Dodaj swój pierwszy utwór do tej playlisty, aby automatycznie odblokować propozycje w tym samym klimacie.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 pt-6 border-t border-teal-950/60 [html.light_&]:border-[#fce7f3]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-white [html.light_&]:text-[#5c0612]">
          Polecane utwory
        </h3>
        <button
          onClick={() => loadRecommendations(false)}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-400 hover:text-teal-300 [html.light_&]:text-[#db2777] transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          <span>Odśwież</span>
        </button>
      </div>
      <p className="text-[11px] text-gray-400 [html.light_&]:text-[#9f1239] mb-3">
        Na podstawie utworów na tej playliście
      </p>

      {/* Lista proponowanych kafelków */}
      <div className="space-y-1.5">
        {recommendations.map((song) => {
          const isCurrentActive = String(currentTrack?.id) === String(song.id);
          const isAdded = addedIds.includes(song.id);
          const isAdding = addingId === song.id;

          return (
            <div
              key={song.id}
              onClick={() => handlePlayInApp(song)}
              className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer select-none ${
                isCurrentActive
                  ? "bg-teal-950/40 border-teal-500/60 [html.light_&]:bg-[#fff1f2] [html.light_&]:border-[#db2777]"
                  : "bg-[#0e1619] border-teal-950/60 hover:border-teal-900/60 [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3]"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                {/* Okładka utworu */}
                <div className="relative h-11 w-11 rounded-lg overflow-hidden flex-shrink-0 bg-[#142024] flex items-center justify-center">
                  {song.albumCover ? (
                    <img
                      src={song.albumCover}
                      alt={song.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Music className="h-5 w-5 text-teal-500/40" />
                  )}

                  {/* Fala dźwiękowa jeśli ten utwór aktualnie gra w playerze */}
                  {isCurrentActive && isPlaying && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-0.5">
                      <span className="w-1 bg-teal-400 [html.light_&]:bg-[#db2777] rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-4" />
                      <span className="w-1 bg-teal-400 [html.light_&]:bg-[#db2777] rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-6" />
                      <span className="w-1 bg-teal-400 [html.light_&]:bg-[#db2777] rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-3" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <span
                    className={`truncate text-xs font-bold ${
                      isCurrentActive
                        ? "text-teal-400 [html.light_&]:text-[#db2777]"
                        : "text-white [html.light_&]:text-[#5c0612]"
                    }`}
                  >
                    {song.title}
                  </span>
                  <span className="truncate text-[11px] text-gray-400 [html.light_&]:text-[#9f1239]">
                    {song.artist}
                  </span>
                </div>
              </div>

              {/* Przycisk dodawania (+) po prawej */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddSong(song);
                }}
                disabled={isAdding || isAdded}
                className={`h-8 w-8 rounded-full flex items-center justify-center border transition active:scale-90 flex-shrink-0 cursor-pointer ${
                  isAdded
                    ? "bg-teal-400 text-black border-teal-400 [html.light_&]:bg-[#db2777] [html.light_&]:text-white"
                    : "border-teal-800/60 text-teal-400 hover:border-teal-400 hover:text-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#db2777]"
                }`}
                title="Dodaj do playlisty"
              >
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isAdded ? (
                  <Check className="h-4 w-4 stroke-[3]" />
                ) : (
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}