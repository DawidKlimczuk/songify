"use client";

import { useEffect, useState } from "react";
import { X, Check, FolderPlus, Music, Loader2 } from "lucide-react";
import { usePlayerStore } from "@/lib/store/player-store";
import { getUserPlaylists, addSongToPlaylist } from "@/app/actions/playlist";

export default function AddToPlaylistModal() {
  const { isAddToPlaylistOpen, setAddToPlaylistOpen, currentTrack } = usePlayerStore();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedSuccessId, setAddedSuccessId] = useState<string | null>(null);

  useEffect(() => {
    if (isAddToPlaylistOpen) {
      setLoading(true);
      getUserPlaylists()
        .then((data) => {
          // Filtrujemy "Polubione utwory", bo od tego jest serduszko
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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 px-4 pb-6 sm:pb-0 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl border border-teal-900/50 bg-[#0e1619] p-5 shadow-2xl">
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

        <div className="py-3">
          <p className="text-[11px] text-gray-400 truncate">
            Utwór: <span className="text-white font-semibold">{currentTrack.title}</span>
          </p>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-teal-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              Brak utworzonych własnych playlist. Utwórz je w zakładce Biblioteka.
            </div>
          ) : (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => handleSelectPlaylist(playlist.id)}
                disabled={addingId !== null}
                className="flex w-full items-center justify-between rounded-xl bg-[#162125] p-3 text-left transition hover:border-teal-500/40 border border-transparent active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-950/50 text-teal-400 flex-shrink-0">
                    <Music className="h-4 w-4" />
                  </div>
                  <span className="truncate text-xs font-semibold text-white">
                    {playlist.name}
                  </span>
                </div>

                <div>
                  {addingId === playlist.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
                  ) : addedSuccessId === playlist.id ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}