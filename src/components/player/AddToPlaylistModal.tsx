"use client";

import { useEffect, useState } from "react";
import { X, Check, FolderPlus, Music, Loader2, BookmarkCheck } from "lucide-react";
import { usePlayerStore } from "@/lib/store/player-store";
import { getUserPlaylists, addSongToPlaylist } from "@/app/actions/playlist";

export default function AddToPlaylistModal() {
  const { isAddToPlaylistOpen, setAddToPlaylistOpen, currentTrack } = usePlayerStore();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedSuccessId, setAddedSuccessId] = useState<string | null>(null);
  const [selectedDefaults, setSelectedDefaults] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Wczytywanie playlist oraz zapisanych w localStorage domyślnych ID
  useEffect(() => {
    if (isAddToPlaylistOpen) {
      setLoading(true);

      try {
        const saved = localStorage.getItem("songify_target_playlist_ids");
        if (saved) {
          setSelectedDefaults(JSON.parse(saved));
        }
      } catch {}

      getUserPlaylists()
        .then((data) => {
          const filtered = (data || []).filter(
            (p: any) =>
              p.name !== "Polubione utwory" &&
              p.name !== "Liked Songs" &&
              !p.isLiked
          );
          setPlaylists(filtered);
        })
        .finally(() => setLoading(false));
    }
  }, [isAddToPlaylistOpen]);

  if (!isAddToPlaylistOpen || !currentTrack) return null;

  // Przełączanie checkboxa danej playlisty
  const toggleDefault = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDefaults((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      localStorage.setItem("songify_target_playlist_ids", JSON.stringify(next));
      return next;
    });
  };

  // Dodanie utworu do konkretnej klikniętej playlisty
  const handleSelectPlaylist = async (playlistId: string) => {
    setAddingId(playlistId);
    try {
      await addSongToPlaylist(playlistId, {
        id: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        albumCover: currentTrack.albumCover,
        duration: currentTrack.duration,
      });
      setAddedSuccessId(playlistId);
      setTimeout(() => {
        setAddedSuccessId(null);
        setAddToPlaylistOpen(false);
      }, 700);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingId(null);
    }
  };

  // Dodanie utworu do wszystkich zaznaczonych playlist naraz
  const handleAddSongToSelected = async () => {
    if (selectedDefaults.length === 0) return;
    setLoading(true);
    try {
      await Promise.all(
        selectedDefaults.map((playlistId) =>
          addSongToPlaylist(playlistId, {
            id: currentTrack.id,
            title: currentTrack.title,
            artist: currentTrack.artist,
            albumCover: currentTrack.albumCover,
            duration: currentTrack.duration,
          })
        )
      );
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setAddToPlaylistOpen(false);
      }, 700);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 px-4 pb-6 sm:pb-0 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl border border-teal-900/50 bg-[#0e1619] p-5 shadow-2xl">
        {/* Pasek górny */}
        <div className="flex items-center justify-between pb-3 border-b border-teal-950/60">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-teal-400" />
            <span className="text-sm font-bold text-white">Dodaj do playlisty</span>
          </div>
          <button
            onClick={() => setAddToPlaylistOpen(false)}
            className="p-1 text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info o utworze */}
        <div className="py-2.5">
          <p className="text-[11px] text-gray-400 truncate">
            Utwór: <span className="text-white font-semibold">{currentTrack.title}</span>
          </p>
          <p className="text-[10px] text-teal-400/80 mt-0.5">
            Zaznacz pola po prawej, aby szybki przycisk dodawał zawsze do wybranych list.
          </p>
        </div>

        {/* Lista Playlist */}
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-teal-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              Brak utworzonych playlist. Utwórz je w zakładce Biblioteka.
            </div>
          ) : (
            playlists.map((playlist) => {
              const isChecked = selectedDefaults.includes(playlist.id);

              return (
                <div
                  key={playlist.id}
                  onClick={() => handleSelectPlaylist(playlist.id)}
                  className="flex w-full items-center justify-between rounded-xl bg-[#162125] p-2.5 text-left transition hover:border-teal-500/40 border border-teal-950/40 active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3 overflow-hidden min-w-0 pr-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-950/50 text-teal-400 flex-shrink-0">
                      <Music className="h-4 w-4" />
                    </div>
                    <span className="truncate text-xs font-semibold text-white">
                      {playlist.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {addingId === playlist.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
                    ) : addedSuccessId === playlist.id ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : null}

                    {/* Checkbox pamiętający wybór do szybkiego dodawania */}
                    <button
                      type="button"
                      onClick={(e) => toggleDefault(playlist.id, e)}
                      title={isChecked ? "Odznacz szybkie dodawanie" : "Zaznacz do szybkiego dodawania"}
                      className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${
                        isChecked
                          ? "border-teal-400 bg-teal-500 text-black"
                          : "border-gray-600 bg-black/30 text-transparent hover:border-gray-400"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Przycisk akceptacji dla zaznaczonych list */}
        {selectedDefaults.length > 0 && (
          <div className="pt-3 mt-3 border-t border-teal-950/60">
            <button
              onClick={handleAddSongToSelected}
              disabled={loading || saveSuccess}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-400 py-2.5 text-xs font-bold text-black shadow-lg shadow-teal-500/20 hover:bg-teal-300 transition active:scale-95 disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>Dodano do zaznaczonych playlist!</span>
                </>
              ) : (
                <>
                  <BookmarkCheck className="h-4 w-4" />
                  <span>Dodaj do zaznaczonych ({selectedDefaults.length})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}