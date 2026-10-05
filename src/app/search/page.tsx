"use client";

import { useState, useEffect } from "react";
import { Search, X, Music, Play, Loader2, ListPlus, Check } from "lucide-react";
import { usePlayerStore, Track } from "@/lib/store/player-store";
import { useJamStore } from "@/lib/store/jam-store";
import { addTrackToJamSession } from "@/components/player/JamModal";

interface DeezerContributor {
  id: number;
  name: string;
}

interface DeezerTrackItem {
  id: number;
  title: string;
  artist: { name: string };
  contributors?: DeezerContributor[];
  album: { cover_medium: string; cover_big: string };
  duration: number;
}

const STORAGE_KEY = "songify_search_history";

function formatArtists(item: DeezerTrackItem): string {
  if (item.contributors && Array.isArray(item.contributors) && item.contributors.length > 0) {
    const names = item.contributors.map((c) => c.name).filter(Boolean);
    if (names.length > 0) {
      return Array.from(new Set(names)).join(", ");
    }
  }
  return item.artist?.name || "Nieznany wykonawca";
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  // Stan swipe gestu wyłącznie w prawo (dodawanie do kolejki)
  const [swipedItem, setSwipedItem] = useState<{
    id: string;
    startX: number;
    startY: number;
    currentX: number;
    isLockedVertical?: boolean;
    isLockedHorizontal?: boolean;
    isMouseDown?: boolean;
  } | null>(null);

  const [addedQueueNotice, setAddedQueueNotice] = useState<string | null>(null);

  const { setCurrentTrack, addToQueue } = usePlayerStore();

  // Ładowanie historii z localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      // Ignoruj błędy parsowania
    }
  }, []);

  // Wyszukiwanie z de-bounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/deezer/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data && data.data) {
          const mapped: Track[] = data.data.map((item: DeezerTrackItem) => ({
            id: String(item.id),
            title: item.title,
            artist: formatArtists(item),
            albumCover: item.album.cover_big || item.album.cover_medium,
            duration: item.duration,
            source: "Wyszukiwarka",
          }));
          setResults(mapped);
        }
      } catch (err) {
        console.error("Błąd wyszukiwania:", err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const addToHistory = (track: Track) => {
    const updated = [track, ...history.filter((h) => h.id !== track.id)].slice(0, 20);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const removeFromHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter((item) => item.id !== id);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSelectTrack = (track: Track) => {
    addToHistory(track);
    setCurrentTrack(track, []); // Jawne zresetowanie kolejki playlisty
  };

  const handleSwipeEnd = async (track: Track) => {
    if (swipedItem?.id === track.id && swipedItem.isLockedHorizontal) {
      const diffX = swipedItem.currentX - swipedItem.startX;
      if (diffX > 75) {
        const isJamActive = Boolean(useJamStore.getState().jamCode);

        if (isJamActive) {
          await addTrackToJamSession(track);
          setAddedQueueNotice(`Dżem: ${track.title}`);
        } else {
          addToQueue(track);
          setAddedQueueNotice(track.title);
        }

        setTimeout(() => setAddedQueueNotice(null), 1800);
      }
    }
    setSwipedItem(null);
  };

  return (
    <div className="min-h-screen pb-36 pt-6 px-4">
      {/* Toast o dodaniu do kolejki */}
      {addedQueueNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-teal-400 px-4 py-2 text-xs font-bold text-black shadow-xl shadow-teal-950/60 animate-in fade-in slide-in-from-top-3 duration-200">
          <Check className="h-4 w-4 stroke-[3]" />
          <span>Dodano do kolejki: {addedQueueNotice}</span>
        </div>
      )}

      <h1 className="text-xl font-bold tracking-tight text-white mb-4">Wyszukaj</h1>

      {/* Pasek wyszukiwania */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-3 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wykonawca, utwór lub album..."
          className="w-full rounded-2xl border border-teal-900/40 bg-[#0e1619] py-2.5 pl-11 pr-10 text-sm text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3.5 top-3 text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Wyniki lub Historia */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-teal-400">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <span className="text-xs text-gray-400">Przeszukiwanie bazy...</span>
        </div>
      ) : query.trim() !== "" ? (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-400/90 mb-3">
            Wyniki wyszukiwania
          </h2>
          <div className="space-y-2">
            {results.map((track) => {
              const isBeingSwiped = swipedItem?.id === track.id && swipedItem.isLockedHorizontal;
              const rawDiff = isBeingSwiped ? swipedItem.currentX - swipedItem.startX : 0;
              const clampedDiff = Math.max(0, rawDiff);
              const offsetX = clampedDiff > 10 ? clampedDiff : 0;

              return (
                <div
                  key={track.id}
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

                  {/* KARTA WYNIKU */}
                  <div
                    onTouchStart={(e) => {
                      setSwipedItem({
                        id: track.id,
                        startX: e.touches[0].clientX,
                        startY: e.touches[0].clientY,
                        currentX: e.touches[0].clientX,
                        isLockedVertical: false,
                        isLockedHorizontal: false,
                      });
                    }}
                    onTouchMove={(e) => {
                      if (!swipedItem || swipedItem.id !== track.id) return;
                      if (swipedItem.isLockedVertical) return;

                      const touch = e.touches[0];
                      const diffX = touch.clientX - swipedItem.startX;
                      const diffY = touch.clientY - swipedItem.startY;

                      if (diffX < 0) return; // Blokada gestu w lewo

                      if (!swipedItem.isLockedHorizontal) {
                        if (Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
                          setSwipedItem({ ...swipedItem, isLockedVertical: true });
                          return;
                        }
                        if (diffX > 12 && diffX > Math.abs(diffY)) {
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
                    onTouchEnd={() => handleSwipeEnd(track)}
                    onMouseDown={(e) => {
                      if ((e.target as HTMLElement).closest("button")) return;
                      setSwipedItem({
                        id: track.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        currentX: e.clientX,
                        isMouseDown: true,
                        isLockedHorizontal: true,
                      });
                    }}
                    onMouseMove={(e) => {
                      if (swipedItem?.id === track.id && swipedItem.isMouseDown) {
                        const diffX = e.clientX - swipedItem.startX;
                        if (diffX >= 0) {
                          setSwipedItem({
                            ...swipedItem,
                            currentX: e.clientX,
                          });
                        }
                      }
                    }}
                    onMouseUp={() => handleSwipeEnd(track)}
                    onMouseLeave={() => {
                      if (swipedItem?.id === track.id && swipedItem.isMouseDown) {
                        handleSwipeEnd(track);
                      }
                    }}
                    style={{
                      transform: `translateX(${offsetX}px)`,
                      transition: isBeingSwiped ? "none" : "transform 0.2s ease-out",
                    }}
                    onClick={() => {
                      if (offsetX < 6) {
                        handleSelectTrack(track);
                      }
                    }}
                    className="relative z-10 group flex items-center justify-between rounded-xl bg-[#0e1619] border border-teal-950/60 p-2.5 transition active:scale-[0.99] cursor-pointer hover:border-teal-800/60 select-none"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={track.albumCover}
                        alt={track.title}
                        className="h-12 w-12 rounded-lg object-cover border border-teal-900/30 flex-shrink-0"
                      />
                      <div className="flex flex-col truncate">
                        <span className="truncate text-xs font-bold text-white group-hover:text-teal-400 transition">
                          {track.title}
                        </span>
                        <span className="truncate text-[11px] text-gray-400">
                          {track.artist}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 pl-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 group-hover:bg-teal-500 group-hover:text-black transition">
                        <Play className="h-4 w-4 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Ostatnio wyszukiwane
          </h2>
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Music className="h-10 w-10 text-gray-600 mb-2" />
              <p className="text-xs text-gray-500">Brak historii wyszukiwania</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((track) => {
                const isBeingSwiped = swipedItem?.id === track.id && swipedItem.isLockedHorizontal;
                const rawDiff = isBeingSwiped ? swipedItem.currentX - swipedItem.startX : 0;
                const clampedDiff = Math.max(0, rawDiff);
                const offsetX = clampedDiff > 10 ? clampedDiff : 0;

                return (
                  <div
                    key={track.id}
                    className="relative overflow-hidden rounded-xl bg-[#091013]"
                  >
                    {isBeingSwiped && offsetX > 8 && (
                      <div className="absolute inset-0 flex items-center px-4 bg-teal-950 text-teal-400 swipe-action-next z-0">
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <ListPlus className="h-4 w-4 stroke-[2.5]" />
                          <span>Dodaj do kolejki</span>
                        </div>
                      </div>
                    )}

                    <div
                      onTouchStart={(e) => {
                        setSwipedItem({
                          id: track.id,
                          startX: e.touches[0].clientX,
                          startY: e.touches[0].clientY,
                          currentX: e.touches[0].clientX,
                          isLockedVertical: false,
                          isLockedHorizontal: false,
                        });
                      }}
                      onTouchMove={(e) => {
                        if (!swipedItem || swipedItem.id !== track.id) return;
                        if (swipedItem.isLockedVertical) return;

                        const touch = e.touches[0];
                        const diffX = touch.clientX - swipedItem.startX;
                        const diffY = touch.clientY - swipedItem.startY;

                        if (diffX < 0) return;

                        if (!swipedItem.isLockedHorizontal) {
                          if (Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
                            setSwipedItem({ ...swipedItem, isLockedVertical: true });
                            return;
                          }
                          if (diffX > 12 && diffX > Math.abs(diffY)) {
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
                      onTouchEnd={() => handleSwipeEnd(track)}
                      onMouseDown={(e) => {
                        if ((e.target as HTMLElement).closest("button")) return;
                        setSwipedItem({
                          id: track.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          currentX: e.clientX,
                          isMouseDown: true,
                          isLockedHorizontal: true,
                        });
                      }}
                      onMouseMove={(e) => {
                        if (swipedItem?.id === track.id && swipedItem.isMouseDown) {
                          const diffX = e.clientX - swipedItem.startX;
                          if (diffX >= 0) {
                            setSwipedItem({
                              ...swipedItem,
                              currentX: e.clientX,
                            });
                          }
                        }
                      }}
                      onMouseUp={() => handleSwipeEnd(track)}
                      onMouseLeave={() => {
                        if (swipedItem?.id === track.id && swipedItem.isMouseDown) {
                          handleSwipeEnd(track);
                        }
                      }}
                      style={{
                        transform: `translateX(${offsetX}px)`,
                        transition: isBeingSwiped ? "none" : "transform 0.2s ease-out",
                      }}
                      onClick={() => {
                        if (offsetX < 6) {
                          handleSelectTrack(track);
                        }
                      }}
                      className="relative z-10 flex items-center justify-between rounded-xl bg-[#0e1619] border border-teal-950/40 p-2.5 transition active:scale-[0.99] cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <img
                          src={track.albumCover}
                          alt={track.title}
                          className="h-11 w-11 rounded-lg object-cover border border-teal-900/30 flex-shrink-0"
                        />
                        <div className="flex flex-col truncate">
                          <span className="truncate text-xs font-bold text-white">
                            {track.title}
                          </span>
                          <span className="truncate text-[11px] text-gray-400">
                            {track.artist}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => removeFromHistory(e, track.id)}
                        className="p-2 text-gray-500 hover:text-red-400 transition"
                        title="Usuń z historii"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}