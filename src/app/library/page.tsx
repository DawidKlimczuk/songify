"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Music, Disc, Download, Folder, Heart } from "lucide-react";
import { createPlaylist, getUserPlaylists } from "@/app/actions/playlist";

export default function LibraryPage() {
  const [tab, setTab] = useState<"PLAYLISTY" | "ALBUMY" | "POBRANE">("PLAYLISTY");
  const [isCreating, setIsCreating] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlaylists = async () => {
    try {
      const data = await getUserPlaylists();
      setPlaylists(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;

    try {
      await createPlaylist(playlistName.trim());
      setPlaylistName("");
      setIsCreating(false);
      await fetchPlaylists();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredPlaylists = playlists.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-36 pt-6 px-4">
      {/* Pasek Górny */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold tracking-tight text-white">Twoja Biblioteka</h1>
        <button
  onClick={() => setIsCreating(true)}
  className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 transition active:scale-95 shadow-sm hover:bg-teal-500 hover:text-black [html.light_&]:bg-[#f472b6] [html.light_&]:text-white [html.light_&]:border-[#f472b6] [html.light_&]:shadow-[#f472b6]/30 [html.light_&]:hover:bg-[#db2777]"
  title="Utwórz playlistę"
>
  <Plus className="h-5 w-5 stroke-[2.5]" />
</button>
      </div>

      {/* Zakładki */}
      <div className="flex gap-2 mb-4 border-b border-teal-950/60 pb-3">
        {(["PLAYLISTY", "ALBUMY", "POBRANE"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider transition ${
              tab === t
                ? "bg-teal-500 text-black shadow-md shadow-teal-500/20"
                : "bg-[#0e1619] text-gray-400 border border-teal-900/30 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Widok: PLAYLISTY */}
      {tab === "PLAYLISTY" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtruj playlisty..."
              className="w-full rounded-xl border border-teal-900/40 bg-[#0e1619] py-2 pl-9 pr-4 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none"
            />
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-xs text-teal-400">Ładowanie playlist...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {filteredPlaylists.map((item) => {
                  const isLiked = item.name === "Polubione utwory";

                  return (
                    <Link
                      key={item.id}
                      href={`/library/playlist/${item.id}`}
                      className="flex flex-col rounded-xl bg-[#0e1619] border border-teal-950/60 p-3 transition active:scale-95 hover:border-teal-800/60"
                    >
                      <div className="aspect-square w-full rounded-lg overflow-hidden bg-teal-950/30 border border-teal-900/30 flex items-center justify-center mb-2">
                        {item.coverUrl ? (
                          <img
                            src={item.coverUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : isLiked ? (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-500/30 to-emerald-950">
                            <Heart className="h-8 w-8 text-teal-400 fill-teal-400/30" />
                          </div>
                        ) : (
                          <Music className="h-8 w-8 text-teal-400/60" />
                        )}
                      </div>
                      <span className="truncate text-xs font-semibold text-white">{item.name}</span>
                      <span className="text-[10px] text-gray-400">Playlista</span>
                    </Link>
                  );
                })}
              </div>

              {filteredPlaylists.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Folder className="h-10 w-10 text-gray-600 mb-2" />
                  <p className="text-xs text-gray-400">Brak playlist</p>
                  <button
                    onClick={() => setIsCreating(true)}
                    className="mt-3 text-xs font-semibold text-teal-400 hover:underline"
                  >
                    Kliknij, aby utworzyć
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Widok: ALBUMY */}
      {tab === "ALBUMY" && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
          <Disc className="h-10 w-10 mb-2 text-gray-600" />
          <p className="text-xs">Brak zapisanych albumów - Zaczekaj na update aplikacji</p>
        </div>
      )}

      {/* Widok: POBRANE */}
      {tab === "POBRANE" && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
          <Download className="h-10 w-10 mb-2 text-gray-600" />
          <p className="text-xs">Brak pobranych utworów offline- Zaczekaj na update aplikacji</p>
        </div>
      )}

      {/* Modal: Tworzenie Playlisty */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-teal-900/50 bg-[#0e1619] p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4">Nazwij swoją playlistę</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="text"
                autoFocus
                required
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="np. Ulubione 2026"
                className="w-full rounded-xl border border-teal-900/50 bg-[#162125] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-gray-400 hover:text-white"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-semibold text-black hover:bg-teal-400"
                >
                  Utwórz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}