"use client";

import { useEffect, useState } from "react";
import { X, Check, FolderPlus, Music, Loader2, BookmarkCheck } from "lucide-react";
import { usePlayerStore } from "@/lib/store/player-store";
import {
  getUserPlaylists,
  addSongToPlaylist,
  removeSongFromPlaylist,
  getPlaylistsContainingSong,
} from "@/app/actions/playlist";

export default function AddToPlaylistModal() {
  const { isAddToPlaylistOpen, setAddToPlaylistOpen, currentTrack } = usePlayerStore();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialSelectedIds, setInitialSelectedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [successNotice, setSuccessNotice] = useState(false);

  // Wczytywanie playlist i wykrywanie stanu bieżącego utworu
  useEffect(() => {
    if (isAddToPlaylistOpen && currentTrack) {
      setLoading(true);

      Promise.all([
        getUserPlaylists(),
        getPlaylistsContainingSong({
          id: currentTrack.id,
          title: currentTrack.title,
          artist: currentTrack.artist || "",
        }),
      ])
        .then(([allPlaylists, alreadyInIds]) => {
          const filtered = (allPlaylists || []).filter(
            (p: any) =>
              p.name !== "Polubione utwory" &&
              p.name !== "Liked Songs" &&
              !p.isLiked
          );
          setPlaylists(filtered);
          setInitialSelectedIds(alreadyInIds);
          setSelectedIds(alreadyInIds);
        })
        .catch((err) => console.error("Błąd wczytywania playlist dla utworu:", err))
        .finally(() => setLoading(false));
    }
  }, [isAddToPlaylistOpen, currentTrack?.id, currentTrack?.title]);

  if (!isAddToPlaylistOpen || !currentTrack) return null;

  // Przełączanie checkboxa playlisty (zaznacz/odznacz)
  const toggleSelect = (playlistId: string) => {
    if (isSubmitting) return;

    setSelectedIds((prev) =>
      prev.includes(playlistId)
        ? prev.filter((id) => id !== playlistId)
        : [...prev, playlistId]
    );
  };

  // Zapis zmian: dodanie do nowo zaznaczonych i usunięcie z odznaczonych
  const handleSaveChanges = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const toAdd = selectedIds.filter((id) => !initialSelectedIds.includes(id));
    const toRemove = initialSelectedIds.filter((id) => !selectedIds.includes(id));

    try {
      // 1. Zapisujemy w bazie
      for (const pId of toAdd) {
        await addSongToPlaylist(pId, {
          id: currentTrack.id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          albumCover: currentTrack.albumCover,
          duration: currentTrack.duration,
        });
      }
      for (const pId of toRemove) {
        await removeSongFromPlaylist(pId, currentTrack.id);
      }

      // 2. Pokazujemy sukces
      setSuccessNotice(true);
      setIsSubmitting(false);

      // 3. Emitujemy event dla otwartej w tle playlisty
      const affectedIds = Array.from(new Set([...toAdd, ...toRemove]));
      affectedIds.forEach((pId) => {
        window.dispatchEvent(
          new CustomEvent("songify_playlist_updated", { detail: { playlistId: pId } })
        );
      });

      // 4. Zamykamy modal
      setTimeout(() => {
        setSuccessNotice(false);
        setAddToPlaylistOpen(false);
      }, 500);
    } catch (err) {
      console.error("Błąd zapisu zmian w playlistach:", err);
      setIsSubmitting(false);
      setSuccessNotice(false);
    }
  };

  const hasChanges =
    selectedIds.some((id) => !initialSelectedIds.includes(id)) ||
    initialSelectedIds.some((id) => !selectedIds.includes(id));

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 px-4 pb-6 sm:pb-0 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl border border-teal-900/60 bg-[#0e1619] p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612] [html.light_&]:shadow-2xl [html.light_&]:shadow-[#f472b6]/20">
        {/* Pasek górny */}
        <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3]">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-teal-400 [html.light_&]:!text-[#db2777]" />
            <span className="text-sm font-bold text-white [html.light_&]:text-[#5c0612]">
              Dodaj do playlisty
            </span>
          </div>
          <button
            onClick={() => setAddToPlaylistOpen(false)}
            className="p-1.5 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:bg-[#fce7f3] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info o utworze */}
        <div className="py-3">
          <p className="text-xs text-gray-400 [html.light_&]:text-[#9f1239] truncate">
            Utwór:{" "}
            <span className="text-white font-semibold [html.light_&]:text-[#5c0612]">
              {currentTrack.title}
            </span>
          </p>
          <p className="text-[11px] text-gray-500 [html.light_&]:text-[#be123c]/80 mt-0.5">
            Zaznacz, aby dodać. Odznacz, aby usunąć z danej playlisty.
          </p>
        </div>

        {/* Lista Playlist */}
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-teal-400 [html.light_&]:text-[#db2777]">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-500 [html.light_&]:text-[#9f1239]">
              Brak utworzonych playlist. Stwórz je w zakładce Biblioteka.
            </div>
          ) : (
            playlists.map((playlist) => {
              const isSelected = selectedIds.includes(playlist.id);
              const wasOriginallyPresent = initialSelectedIds.includes(playlist.id);

              return (
                <div
                  key={playlist.id}
                  onClick={() => toggleSelect(playlist.id)}
                  className={`flex w-full items-center justify-between rounded-2xl p-2.5 text-left border transition select-none cursor-pointer ${
                    isSelected
                      ? "bg-teal-950/40 border-teal-400 [html.light_&]:bg-[#fdf2f8] [html.light_&]:border-[#db2777]"
                      : "bg-[#142024] border-teal-950/40 hover:border-teal-800/60 [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3] [html.light_&]:hover:border-[#fbcfe8]"
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden min-w-0 pr-2">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-teal-950/60 text-teal-400 border border-teal-900/40 flex-shrink-0 overflow-hidden [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#db2777]">
                      {playlist.coverUrl ? (
                        <img
                          src={playlist.coverUrl}
                          alt={playlist.name}
                          className="h-full w-full object-cover"
                        />
                      ) : playlist.songs && playlist.songs.length > 0 ? (
                        <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                          {[0, 1, 2, 3].map((idx) => {
                            const sCover = playlist.songs[idx]?.albumCover;
                            return (
                              <div
                                key={idx}
                                className="relative flex h-full w-full items-center justify-center border border-teal-900/20 bg-teal-950/50 [html.light_&]:border-white/30 [html.light_&]:bg-gradient-to-br [html.light_&]:from-[#ff758c] [html.light_&]:to-[#ff7eb3] overflow-hidden"
                              >
                                {sCover ? (
                                  <img src={sCover} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <Music className="h-2 w-2 text-teal-400/60 [html.light_&]:text-white/95" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <Music className="h-4 w-4 text-teal-400/60 [html.light_&]:text-[#be123c]/60" />
                      )}
                    </div>

                    <div className="flex flex-col truncate">
                      <span className="truncate text-xs font-semibold text-white [html.light_&]:text-[#5c0612]">
                        {playlist.name}
                      </span>
                      {wasOriginallyPresent && (
                        <span className="text-[10px] font-semibold text-emerald-400 [html.light_&]:text-emerald-600">
                          {isSelected ? "Zapisano" : "Utwór zostanie usunięty"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div className="flex-shrink-0 pl-2">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${
                        isSelected
                          ? "border-teal-400 bg-teal-400 text-black [html.light_&]:border-[#db2777] [html.light_&]:bg-[#db2777] [html.light_&]:text-white"
                          : "border-gray-600 bg-black/20 text-transparent [html.light_&]:border-[#fbcfe8] [html.light_&]:bg-white"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Przycisk akceptacji */}
        <div className="pt-3 mt-3 border-t border-teal-950/60 [html.light_&]:border-[#fce7f3]">
          <button
            onClick={handleSaveChanges}
            disabled={!hasChanges || isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-400 py-3 text-xs font-bold text-black shadow-lg shadow-teal-500/20 transition hover:bg-teal-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none [html.light_&]:bg-[#db2777] [html.light_&]:text-white [html.light_&]:shadow-[#db2777]/30 [html.light_&]:hover:bg-[#be123c]"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : successNotice ? (
              <>
                <Check className="h-4 w-4 stroke-[3]" />
                <span>Zapisano zmiany!</span>
              </>
            ) : (
              <>
                <BookmarkCheck className="h-4 w-4" />
                <span>Zapisz zmiany</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}