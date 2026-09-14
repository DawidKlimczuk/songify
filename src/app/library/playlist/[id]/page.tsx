"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  MoreVertical,
  Edit2,
  Trash2,
  Play,
  Pause,
  Shuffle,
  Download,
  X,
  AlertTriangle,
  Music,
  Heart,
  Camera,
  Upload,
  Loader2,
} from "lucide-react";
import { usePlayerStore } from "@/lib/store/player-store";
import {
  getPlaylistDetails,
  removeSongFromPlaylist,
  updatePlaylist,
  deletePlaylist,
  uploadPlaylistCover,
} from "@/app/actions/playlist";

export default function PlaylistView() {
  const router = useRouter();
  const params = useParams();
  const playlistId = params.id as string;

  const {
    currentTrack,
    setCurrentTrack,
    isPlaying,
    togglePlay,
    isLiked,
    isShuffle,
    toggleShuffle,
  } = usePlayerStore();

  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<string | null>(null);

  // Stan formularza edycji
  const [editName, setEditName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    getPlaylistDetails(playlistId)
      .then((data) => {
        setPlaylist(data);
        if (data) {
          setEditName(data.name);
          setPreviewUrl(data.coverUrl || null);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [playlistId, isLiked]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      alert("Wybierz poprawny plik graficzny (JPG, PNG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Zdjęcie jest za duże! Maksymalny rozmiar to 5 MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setIsSaving(true);
    try {
      let finalCoverUrl = playlist.coverUrl;

      // Jeśli wybrano nowe zdjęcie -> upload do Supabase Storage
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const uploaded = await uploadPlaylistCover(playlistId, formData);
        finalCoverUrl = uploaded.coverUrl;
      }

      // Aktualizacja nazwy
      const updated = await updatePlaylist(playlistId, {
        name: editName.trim(),
        coverUrl: finalCoverUrl,
      });

      setPlaylist((prev: any) => ({
        ...prev,
        name: updated.name,
        coverUrl: updated.coverUrl,
      }));

      setIsEditModalOpen(false);
      setSelectedFile(null);
      router.refresh();
    } catch (err) {
      console.error("Błąd zapisu edycji playlisty:", err);
      alert("Nie udało się zapisać zmian. Spróbuj ponownie.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlaylist = async () => {
    try {
      await deletePlaylist(playlistId);
      router.push("/library");
    } catch (err) {
      console.error("Błąd usuwania playlisty:", err);
    }
  };

  const confirmDeleteSong = async () => {
    if (!songToDelete) return;
    await removeSongFromPlaylist(playlistId, songToDelete);
    setPlaylist((prev: any) => ({
      ...prev,
      songs: prev.songs.filter((item: any) => item.song.id !== songToDelete),
    }));
    setSongToDelete(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-teal-400 text-xs">
        Ładowanie playlisty...
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen p-6 text-center text-gray-400 text-xs">
        Nie znaleziono playlisty.
      </div>
    );
  }

  const isLikedPlaylist = playlist.name === "Polubione utwory";
  const songsList = playlist.songs ? playlist.songs.map((item: any) => item.song) : [];

  // Sprawdzamy czy odtwarzacz gra I czy źródłem jest dokładnie ta otwarta playlista
  const isPlayingThisPlaylist = isPlaying && currentTrack?.source === playlist.name;

  const handlePlayAll = (startRandom: boolean = false) => {
    if (songsList.length === 0) return;

    // Jeśli kliknięto zwykły play (nie losowy) i już odtwarzamy z tej playlisty -> pauza/wznowienie
    if (!startRandom && currentTrack?.source === playlist.name) {
      togglePlay();
      return;
    }

    const formattedQueue = songsList.map((s: any) => ({
      ...s,
      id: String(s.id),
      source: playlist.name,
    }));

    if (startRandom) {
      if (!isShuffle) toggleShuffle();
      const randomIndex = Math.floor(Math.random() * formattedQueue.length);
      setCurrentTrack(formattedQueue[randomIndex], formattedQueue);
    } else {
      setCurrentTrack(formattedQueue[0], formattedQueue);
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

        {!isLikedPlaylist ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-[#162125] transition border border-teal-900/30"
              title="Opcje playlisty"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-44 rounded-2xl border border-teal-900/80 bg-[#0e1619] p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setPreviewUrl(playlist.coverUrl || null);
                    setSelectedFile(null);
                    setIsEditModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-gray-200 hover:bg-[#162125] hover:text-teal-400 transition"
                >
                  <Edit2 className="h-4 w-4 text-teal-400" />
                  <span>Edytuj playlistę</span>
                </button>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsDeleteModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Usuń playlistę</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="h-9 w-9" />
        )}
      </div>

      {/* Nagłówek Playlisty */}
      <div className="flex flex-col items-center text-center mb-6">
        <div
          className={`relative aspect-square w-44 rounded-2xl overflow-hidden border shadow-xl mb-4 flex items-center justify-center ${
            isLikedPlaylist
              ? "bg-gradient-to-br from-teal-500/40 via-emerald-600/30 to-teal-950 border-teal-500/50"
              : "bg-[#0e1619] border-teal-800/40"
          }`}
        >
          {playlist.coverUrl ? (
            <img
              src={playlist.coverUrl}
              alt={playlist.name}
              className="h-full w-full object-cover"
            />
          ) : isLikedPlaylist ? (
            <Heart className="h-20 w-20 text-teal-400 fill-teal-400/30" />
          ) : (
            <Music className="h-16 w-16 text-teal-500/40" />
          )}
        </div>
        <h1 className="text-xl font-bold tracking-tight">{playlist.name}</h1>
        <p className="text-xs text-gray-400 mt-1">{songsList.length} utworów</p>
      </div>

      {/* Kontrolki Playlisty */}
      <div className="flex items-center justify-between mb-6 px-4">
        <button
          onClick={() => alert("Pobieranie do trybu offline skonfigurujemy w punkcie PWA.")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0e1619] border border-teal-900/40 text-teal-400 hover:text-white transition"
          title="Pobierz playlistę"
        >
          <Download className="h-5 w-5" />
        </button>

        <button
          onClick={() => handlePlayAll(false)}
          disabled={songsList.length === 0}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-400 text-black shadow-lg shadow-teal-500/20 hover:scale-105 active:scale-95 transition disabled:opacity-50"
        >
          {isPlayingThisPlaylist ? (
            <Pause className="h-6 w-6 fill-black" />
          ) : (
            <Play className="h-6 w-6 fill-black ml-0.5" />
          )}
        </button>

        <button
          onClick={() => handlePlayAll(true)}
          disabled={songsList.length === 0}
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#0e1619] border border-teal-900/40 transition disabled:opacity-50 ${
            isShuffle ? "text-teal-400 border-teal-500/40" : "text-gray-400 hover:text-white"
          }`}
          title="Odtwarzaj losowo"
        >
          <Shuffle className="h-5 w-5" />
        </button>
      </div>

      {/* Lista utworów */}
      <div className="space-y-2">
        {songsList.map((song: any) => (
          <div
            key={song.id}
            onClick={() => {
              const formattedQueue = songsList.map((s: any) => ({
                ...s,
                id: String(s.id),
                source: playlist.name,
              }));
              setCurrentTrack(
                { ...song, id: String(song.id), source: playlist.name },
                formattedQueue
              );
            }}
            className="flex items-center justify-between rounded-xl bg-[#0e1619] border border-teal-950/60 p-2.5 active:scale-[0.98] transition cursor-pointer hover:border-teal-800/60"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <img
                src={song.albumCover}
                alt={song.title}
                className="h-11 w-11 rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex flex-col truncate">
                <span className="truncate text-xs font-bold">{song.title}</span>
                <span className="truncate text-[11px] text-gray-400">{song.artist}</span>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setSongToDelete(song.id);
              }}
              className="p-2 text-gray-500 hover:text-red-400 transition"
              title="Usuń z playlisty"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        {songsList.length === 0 && (
          <div className="py-12 text-center text-xs text-gray-500">
            {isLikedPlaylist
              ? "Brak polubionych utworów. Kliknij serduszko w odtwarzaczu, aby dodać ulubione utwory!"
              : "Ta playlista jest jeszcze pusta. Dodaj do niej utwory z poziomu odtwarzacza!"}
          </div>
        )}
      </div>

      {/* Modal: Edycja z wyborem z galerii */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-teal-900/60 bg-[#0e1619] p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-5 text-center">Edytuj playlistę</h3>
            <form onSubmit={handleSaveEdit} className="space-y-5">
              <div className="flex flex-col items-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative aspect-square w-32 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-teal-800/60 bg-[#162125] transition hover:border-teal-400 flex items-center justify-center"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Podgląd okładki"
                      className="h-full w-full object-cover transition group-hover:opacity-75"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400 group-hover:text-teal-400 transition">
                      <Upload className="h-8 w-8 mb-1.5 opacity-70" />
                      <span className="text-[10px] font-medium">Dodaj zdjęcie</span>
                    </div>
                  )}

                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition">
                    <Camera className="h-6 w-6 text-teal-400 mb-1" />
                    <span className="text-[10px] font-semibold text-white">Zmień okładkę</span>
                  </div>
                </div>

                <span className="text-[11px] text-gray-500 mt-2">
                  Dotknij, aby wybrać z galerii (maks. 5 MB)
                </span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-400 mb-1 block">
                  Nazwa playlisty
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-teal-900/50 bg-[#162125] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-medium text-gray-400 hover:text-white"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-semibold text-black hover:bg-teal-400 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSaving ? "Zapisywanie..." : "Zapisz zmiany"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Usuwanie Playlisty */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl border border-teal-900/60 bg-[#0e1619] p-6 shadow-2xl text-center">
            <AlertTriangle className="h-9 w-9 text-red-400 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-white mb-1">Usuń playlistę</h4>
            <p className="text-xs text-gray-300 mb-5 leading-relaxed">
              Czy na pewno chcesz usunąć playlistę <span className="font-semibold text-white">"{playlist.name}"</span>? Tej operacji nie można cofnąć.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 rounded-xl border border-teal-900/40 bg-[#162125] py-2.5 text-xs font-semibold text-gray-300 hover:text-white"
              >
                Anuluj
              </button>
              <button
                onClick={handleDeletePlaylist}
                className="flex-1 rounded-xl bg-red-500/20 border border-red-500/40 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/30"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Usuwanie Utworu */}
      {songToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-teal-900/50 bg-[#0e1619] p-5 shadow-2xl text-center">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <p className="text-xs text-gray-200 mb-5 leading-relaxed">
              Czy na pewno chcesz usunąć tę piosenkę z playlisty?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSongToDelete(null)}
                className="flex-1 rounded-xl border border-teal-900/40 bg-[#162125] py-2 text-xs font-semibold text-gray-300 hover:text-white"
              >
                Nie
              </button>
              <button
                onClick={confirmDeleteSong}
                className="flex-1 rounded-xl bg-red-500/20 border border-red-500/30 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/30"
              >
                Tak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}