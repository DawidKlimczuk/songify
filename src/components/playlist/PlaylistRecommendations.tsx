"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, RefreshCw, Check, Loader2, Music, Sparkles } from "lucide-react";
import { usePlayerStore } from "@/lib/store/player-store";
import { useDeviceStore } from "@/lib/store/device-store";
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
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);

  // Dostęp do globalnego playera, żeby go zatrzymać na czas preview
  const { isPlaying, togglePlay } = usePlayerStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPreview = () => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingPreviewId(null);
  };

  const loadRecommendations = async (clearCurrent: boolean = false) => {
    if (songsCount === 0) return;
    setIsLoading(true);

    const exclude = clearCurrent ? [] : recommendations.map((r) => r.id);
    const data = await getRecommendedSongsForPlaylist(playlistId, exclude);
    setRecommendations(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (songsCount > 0) {
      loadRecommendations(true);
    }
    return () => {
      stopPreview();
    };
  }, [playlistId, songsCount]);

  // Obsługa odsłuchu 10 sekund z fade-outem i respektowaniem głośności z odtwarzacza
  const handlePlayPreview = async (song: any) => {
    if (playingPreviewId === song.id) {
      stopPreview();
      return;
    }

    stopPreview();

    // 1. Zatrzymujemy główny player, jeśli gra
    if (isPlaying) {
      togglePlay();
    }

    if (!song.previewUrl) {
      console.warn("Brak podglądu audio dla:", song.title);
      return;
    }

    try {
      const audio = new Audio(song.previewUrl);
      audioRef.current = audio;
      setPlayingPreviewId(song.id);

      // Pobieramy dokładną głośność ze store'a urządzeń (wartość 0 - 100 lub 0 - 1)
      const rawVolume = useDeviceStore.getState().volume;
      const initialVolume = typeof rawVolume === "number"
        ? Math.min(Math.max(rawVolume > 1 ? rawVolume / 100 : rawVolume, 0), 1)
        : 0.5;

      audio.volume = initialVolume;
      await audio.play();

      // Po 8 sekundach płynny fade-out przez 2 sekundy od aktualnego poziomu
      setTimeout(() => {
        if (audioRef.current !== audio) return;

        let currentVol = initialVolume;
        const step = initialVolume / 10; // 10 kroków proporcjonalnie do poziomu głośności

        fadeIntervalRef.current = setInterval(() => {
          currentVol -= step;
          if (currentVol <= 0.02) {
            stopPreview();
          } else if (audioRef.current) {
            audioRef.current.volume = Math.max(0, currentVol);
          }
        }, 200);
      }, 8000);

      audio.onended = () => stopPreview();
      audio.onerror = (e) => {
        console.error("Błąd odtwarzania preview:", e);
        stopPreview();
      };
    } catch (err) {
      console.error("Błąd startu preview audio:", err);
      stopPreview();
    }
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
          const isPlayingThis = playingPreviewId === song.id;
          const isAdded = addedIds.includes(song.id);
          const isAdding = addingId === song.id;

          return (
            <div
              key={song.id}
              onClick={() => handlePlayPreview(song)}
              className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer select-none ${
                isPlayingThis
                  ? "bg-teal-950/40 border-teal-500/60 [html.light_&]:bg-[#fff1f2] [html.light_&]:border-[#db2777]"
                  : "bg-[#0e1619] border-teal-950/60 hover:border-teal-900/60 [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3]"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                {/* Okładka z animowaną falą dźwiękową */}
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

                  {/* Animowana fala dźwiękowa podczas odsłuchu */}
                  {isPlayingThis && (
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
                      isPlayingThis
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