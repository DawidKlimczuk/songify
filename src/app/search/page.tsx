"use client";

import { useState, useEffect } from "react";
import { Search, X, Music, Play, Loader2 } from "lucide-react";
import { usePlayerStore, Track } from "@/lib/store/player-store";

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

  const { setCurrentTrack } = usePlayerStore();

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

  return (
    <div className="min-h-screen pb-36 pt-6 px-4">
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
            {results.map((track) => (
              <div
                key={track.id}
                onClick={() => handleSelectTrack(track)}
                className="group flex items-center justify-between rounded-xl bg-[#0e1619] border border-teal-950/60 p-2.5 transition active:scale-[0.98] cursor-pointer hover:border-teal-800/60"
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
            ))}
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
              {history.map((track) => (
                <div
                  key={track.id}
                  onClick={() => handleSelectTrack(track)}
                  className="flex items-center justify-between rounded-xl bg-[#0e1619] border border-teal-950/40 p-2.5 transition active:scale-[0.98] cursor-pointer"
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}