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
  ArrowRight,
  Download,
  X,
  AlertTriangle,
  Music,
  Heart,
  Camera,
  Upload,
  Loader2,
  ListPlus,
  Check,
  ExternalLink,
} from "lucide-react";
import { usePlayerStore } from "@/lib/store/player-store";
import {
  getPlaylistDetails,
  removeSongFromPlaylist,
  updatePlaylist,
  deletePlaylist,
  uploadPlaylistCover,
  bulkLikeTracks,
  clearLikedTracks,
  updateSongCover,
} from "@/app/actions/playlist";

// Ikona Spotify SVG
function SpotifyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.516 17.307c-.218.358-.68.472-1.038.254-2.87-1.753-6.482-2.15-10.738-1.177-.41.093-.815-.164-.908-.573-.093-.41.164-.814.573-.907 4.671-1.068 8.665-.615 11.86 1.365.357.218.471.68.253 1.038zm1.48-3.284c-.276.446-.86.588-1.306.313-3.283-2.018-8.288-2.603-12.172-1.423-.5.152-1.028-.135-1.18-.635-.152-.5.135-1.028.636-1.18 4.437-1.347 9.948-.698 13.71 1.618.446.276.587.86.312 1.307zm.128-3.418C15.202 8.293 8.76 8.08 5.097 9.192c-.604.183-1.246-.164-1.429-.767-.183-.604.164-1.246.767-1.429 4.22-1.282 11.332-1.034 15.82 1.63.544.323.722 1.028.4 1.572-.323.544-1.028.723-1.531.408z" />
    </svg>
  );
}

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
    addToQueue,
  } = usePlayerStore();

  const [swipedIdx, setSwipedIdx] = useState<{
    id: string;
    startX: number;
    startY: number;
    currentX: number;
    isLockedVertical?: boolean;
    isLockedHorizontal?: boolean;
    isMouseDown?: boolean;
  } | null>(null);

  const [addedQueueNotice, setAddedQueueNotice] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<string | null>(null);

  // Stany importu Spotify
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<"link" | "text">("link");
  const [importUrl, setImportUrl] = useState("");
  const [importRawText, setImportRawText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

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

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const uploaded = await uploadPlaylistCover(playlistId, formData);
        finalCoverUrl = uploaded.coverUrl;
      }

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

  // Obsługa pobrania utworów (Link lub Tekst/CSV) i dodania do polubionych
  const handleImportSpotify = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportSuccess(null);
    setIsImporting(true);

    try {
      let tracksToImport: any[] = [];

      if (importTab === "text") {
        if (!importRawText.trim()) {
          throw new Error("Wklej listę utworów lub zawartość pliku CSV.");
        }

        // Prawidłowy parser linii CSV respektujący przecinki w cudzysłowach
        const parseCsvLine = (text: string) => {
          const res: string[] = [];
          let cur = "";
          let inQuotes = false;
          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '"') {
              inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
              res.push(cur.trim());
              cur = "";
            } else {
              cur += ch;
            }
          }
          res.push(cur.trim());
          return res;
        };

        const lines = importRawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const parsedList: any[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Pomiń nagłówek pliku CSV
          if (i === 0 && line.toLowerCase().includes("track uri")) {
            continue;
          }

          let spotifyId = "";
          let title = "";
          let artist = "Nieznany wykonawca";
          let duration = 0;

          if (line.includes(",")) {
            const cols = parseCsvLine(line);
            // Struktura Exportify CSV:
            // Index 0: Track URI (np. spotify:track:4GVRGoJZTvJ9iuavv9fwjb)
            // Index 1: ISRC (PLI362958040)
            // Index 2: Track Name ("ODDO")
            // Index 3: Album Name ("ODDO")
            // Index 4: Artist Name(s) ("Louis Villain;Pezet;JNKSH")
            // Index 6: Duration (ms) (180000)
            if (cols.length >= 5) {
              spotifyId = cols[0].replace("spotify:track:", "").trim();
              title = cols[2].replace(/^"|"$/g, "").trim();
              artist = cols[4].replace(/^"|"$/g, "").replace(/;/g, ", ").trim();
              if (cols[6]) {
                const ms = parseInt(cols[6], 10);
                if (!isNaN(ms)) duration = Math.round(ms / 1000);
              }
            } else {
              title = cols[1] || cols[0];
              artist = cols[2] || artist;
            }
          } else if (line.includes(" - ")) {
            const parts = line.split(" - ");
            artist = parts[0].trim();
            title = parts.slice(1).join(" - ").trim();
          } else {
            title = line;
          }

          if (title) {
            parsedList.push({
              id: spotifyId || `imported_${Date.now()}_${i}`,
              title,
              artist,
              albumCover: "",
              duration,
            });
          }
        }

        if (parsedList.length === 0) {
          throw new Error("Nie udało się rozpoznać żadnych utworów z wklejonego tekstu.");
        }

        tracksToImport = parsedList;
      } else {
        if (!importUrl.trim()) {
          throw new Error("Wklej link do playlisty Spotify.");
        }

        let spotifyId = importUrl.trim();
        if (spotifyId.includes("spotify.com")) {
          const parts = spotifyId.split("playlist/")[1];
          if (parts) {
            spotifyId = parts.split("?")[0].split("/")[0].trim();
          }
        }

        if (!spotifyId) {
          throw new Error("Wklej poprawny link do playlisty Spotify.");
        }

        const res = await fetch(`/api/deezer/playlist/${spotifyId}?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || "Nie udało się odczytać playlisty.");
        }

        const data = await res.json();
        if (!data.tracks || data.tracks.length === 0) {
          throw new Error("Playlista jest pusta lub wystąpił błąd odczytu.");
        }

        tracksToImport = data.tracks.map((t: any) => ({
          id: String(t.id),
          title: t.title,
          artist: t.artist,
          albumCover: t.albumCover,
          duration: t.duration || 0,
        }));
      }

      await bulkLikeTracks(tracksToImport);

      setImportSuccess(`Pomyślnie zaimportowano ${tracksToImport.length} utworów!`);
      setImportUrl("");
      setImportRawText("");
      loadData();
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSuccess(null);
      }, 1500);
    } catch (err: any) {
      setImportError(err.message || "Wystąpił błąd podczas importowania.");
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
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
  const isPlayingThisPlaylist = isPlaying && currentTrack?.source === playlist.name;

  const handlePlayAll = (startRandom: boolean = false) => {
    if (songsList.length === 0) return;

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

        {isLikedPlaylist ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setImportError(null);
                setImportSuccess(null);
                setIsImportModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-full border border-teal-500/40 bg-[#0e1619] px-3 py-1.5 text-xs font-semibold text-teal-300 hover:border-teal-400 hover:bg-[#162125] transition active:scale-95 shadow-sm"
            >
              <SpotifyIcon className="h-4 w-4 text-[#1DB954]" />
              <span>Importuj utwory</span>
            </button>
          </div>
        ) : (
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
          onClick={() => toggleShuffle()}
          disabled={songsList.length === 0}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-teal-900/40 bg-[#0e1619] text-teal-400 hover:text-white hover:border-teal-500/50 transition active:scale-95 shadow-sm disabled:opacity-50"
          title={isShuffle ? "Tryb: Odtwarzanie losowe" : "Tryb: Odtwarzanie po kolei"}
        >
          {isShuffle ? (
            <Shuffle className="h-5 w-5 stroke-[2.2]" />
          ) : (
            <ArrowRight className="h-5 w-5 stroke-[2.2]" />
          )}
        </button>
      </div>

      {/* Pływające powiadomienie o dodaniu do kolejki */}
      {addedQueueNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-teal-400 px-4 py-2 text-xs font-bold text-black shadow-xl shadow-teal-950/60 animate-in fade-in slide-in-from-top-3 duration-200">
          <Check className="h-4 w-4 stroke-[3]" />
          <span>Dodano do kolejki: {addedQueueNotice}</span>
        </div>
      )}

      {/* Lista utworów z blokadą osi pionowej i gestem Swipe w prawo */}
      <div className="space-y-2">
        {songsList.map((song: any) => {
          const isThisTrackPlaying =
            isPlaying && String(currentTrack?.id) === String(song.id);

          return (
            <PlaylistItemRow
              key={song.id}
              song={song}
              playlistName={playlist.name}
              isThisTrackPlaying={isThisTrackPlaying}
              songsList={songsList}
              swipedIdx={swipedIdx}
              setSwipedIdx={setSwipedIdx}
              setAddedQueueNotice={setAddedQueueNotice}
              setSongToDelete={setSongToDelete}
              addToQueue={addToQueue}
              setCurrentTrack={setCurrentTrack}
            />
          );
        })}

        {songsList.length === 0 && (
          <div className="py-12 text-center text-xs text-gray-500">
            {isLikedPlaylist
              ? "Brak polubionych utworów. Użyj przycisku Import w rogu lub kliknij serduszko w odtwarzaczu!"
              : "Ta playlista jest jeszcze pusta. Dodaj do niej utwory z poziomu odtwarzacza!"}
          </div>
        )}
      </div>

      {/* MODAL: Import utworów do Polubionych */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-teal-900/70 bg-[#0e1619] p-6 shadow-2xl animate-in zoom-in-95 duration-150 [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:shadow-[#f472b6]/20">
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-4">
              <div className="flex items-center gap-2">
                <SpotifyIcon className="h-5 w-5 text-[#1DB954]" />
                <h3 className="text-sm font-bold text-white [html.light_&]:text-[#5c0612]">Importuj utwory</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:text-[#5c0612] transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Przełącznik zakładek */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#142025] rounded-xl mb-4 border border-teal-950/60 [html.light_&]:bg-[#fff1f2] [html.light_&]:border-[#fecdd3]">
              <button
                type="button"
                onClick={() => setImportTab("link")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                  importTab === "link"
                    ? "bg-teal-400 text-black shadow [html.light_&]:bg-[#db2777] [html.light_&]:text-white"
                    : "text-gray-400 hover:text-white [html.light_&]:text-[#9f1239]"
                }`}
              >
                Link do playlisty (100 utworów)
              </button>
              <button
                type="button"
                onClick={() => setImportTab("text")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                  importTab === "text"
                    ? "bg-teal-400 text-black shadow [html.light_&]:bg-[#db2777] [html.light_&]:text-white"
                    : "text-gray-400 hover:text-white [html.light_&]:text-[#9f1239]"
                }`}
              >
                Exportify (600+ utworów)
              </button>
            </div>

            {importTab === "link" ? (
              <form onSubmit={handleImportSpotify} className="space-y-4">
                <div className="rounded-2xl bg-[#142025]/80 border border-teal-950/70 p-3 text-[11px] text-gray-300 [html.light_&]:!bg-[#fff1f2] [html.light_&]:!border-[#fecdd3] [html.light_&]:!text-[#881337]">
                  Wklej publiczny link do playlisty Spotify. Spotify w tym trybie zwraca 100 najnowszych pozycji.
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 [html.light_&]:text-[#9f1239] mb-1.5 block">
                    Link Spotify
                  </label>
                  <input
                    type="text"
                    placeholder="https://open.spotify.com/playlist/..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="w-full rounded-xl border border-teal-900/60 bg-[#162125] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]"
                  />
                </div>

                {importError && (
                  <div className="rounded-xl bg-red-950/40 border border-red-800/50 p-2.5 text-xs text-red-300">
                    {importError}
                  </div>
                )}
                {importSuccess && (
                  <div className="rounded-xl bg-teal-950/40 border border-teal-600/50 p-2.5 text-xs text-teal-300 flex items-center gap-2">
                    <Check className="h-4 w-4 text-teal-400" />
                    <span>{importSuccess}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="rounded-xl px-4 py-2.5 text-xs font-medium text-gray-400 hover:text-white"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isImporting || !importUrl.trim()}
                    className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-black hover:bg-teal-300 disabled:opacity-50"
                  >
                    {isImporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isImporting ? "Importowanie..." : "Importuj utwory"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleImportSpotify} className="space-y-4">
                <div className="rounded-2xl bg-[#142025]/80 border border-teal-950/70 p-3.5 text-xs text-gray-300 [html.light_&]:!bg-[#fff1f2] [html.light_&]:!border-[#fecdd3] [html.light_&]:!text-[#881337] space-y-2">
                  <div className="flex items-center justify-between font-semibold text-white [html.light_&]:text-[#5c0612]">
                    <span>Jak pobrać plik ze Spotify?</span>
                    <a
                      href="https://exportify.net"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 underline underline-offset-2 [html.light_&]:text-[#db2777]"
                    >
                      <span>Otwórz exportify.net</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-300 [html.light_&]:text-[#9f1239] leading-relaxed">
                    <li>Zaloguj się swoim kontem Spotify.</li>
                    <li>Odszukaj na liście playlistę <b>Liked Songs</b>.</li>
                    <li>Kliknij zielony przycisk <b>Export</b>.</li>
                    <li>Wgraj pobrany plik <b>.csv</b> poniżej.</li>
                  </ol>
                </div>

                {/* Wybór pliku CSV z urządzenia (działa na iOS Files, Android i PC) */}
                <div>
                  <label className="text-[11px] font-medium text-gray-400 [html.light_&]:text-[#9f1239] mb-1.5 block">
                    Wgraj plik z urządzenia (.csv - ten pobrany przed chwilą)
                  </label>
                  <input
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        if (content) {
                          setImportRawText(content);
                        }
                      };
                      reader.readAsText(file);
                    }}
                    className="w-full text-xs text-gray-300 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-400 file:text-black hover:file:bg-teal-300 file:cursor-pointer cursor-pointer border border-teal-900/60 rounded-xl p-1 bg-[#162125] [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fbcfe8] [html.light_&]:file:bg-[#db2777] [html.light_&]:file:text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-medium text-gray-400 [html.light_&]:text-[#9f1239]">
                      Zawartość do zaimportowania
                    </label>
                    {importRawText && (
                      <span className="text-[10px] text-teal-400 font-semibold [html.light_&]:text-[#db2777]">
                        Wczytano {importRawText.split(/\r?\n/).filter(Boolean).length} linii
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Plik wczyta się tutaj automatycznie po wybraniu z urządzenia..."
                    value={importRawText}
                    onChange={(e) => setImportRawText(e.target.value)}
                    className="w-full rounded-xl border border-teal-900/60 bg-[#162125] p-3 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none font-mono resize-none [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]"
                  />
                </div>

                {importError && (
                  <div className="rounded-xl bg-red-950/40 border border-red-800/50 p-2.5 text-xs text-red-300">
                    {importError}
                  </div>
                )}
                {importSuccess && (
                  <div className="rounded-xl bg-teal-950/40 border border-teal-600/50 p-2.5 text-xs text-teal-300 flex items-center gap-2">
                    <Check className="h-4 w-4 text-teal-400" />
                    <span>{importSuccess}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsImportModalOpen(false);
                      setImportRawText("");
                    }}
                    className="rounded-xl px-4 py-2.5 text-xs font-medium text-gray-400 hover:text-white"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isImporting || !importRawText.trim()}
                    className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-black hover:bg-teal-300 disabled:opacity-50 [html.light_&]:bg-[#db2777] [html.light_&]:text-white"
                  >
                    {isImporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isImporting ? "Importowanie..." : "Importuj utwory"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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

// Podkomponent pojedynczego utworu z prawdziwym Lazy Loadingiem (IntersectionObserver)
function PlaylistItemRow({
  song,
  playlistName,
  isThisTrackPlaying,
  songsList,
  swipedIdx,
  setSwipedIdx,
  setAddedQueueNotice,
  setSongToDelete,
  addToQueue,
  setCurrentTrack,
}: any) {
  const { currentTrack } = usePlayerStore();
  const [coverUrl, setCoverUrl] = useState<string>(song.albumCover || "");
  const [isVisible, setIsVisible] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  // Jeśli odtwarzacz właśnie pobrał okładkę dla tego utworu, natychmiast aktualizujemy kafelek na liście
  useEffect(() => {
    if (String(currentTrack?.id) === String(song.id) && currentTrack?.albumCover) {
      setCoverUrl(currentTrack.albumCover);
      song.albumCover = currentTrack.albumCover;
    }
  }, [currentTrack?.id, currentTrack?.albumCover, song.id]);

  // 1. Obserwator widoczności na ekranie - odpala się tylko gdy kafelek wchodzi w pole widzenia
  useEffect(() => {
    if (coverUrl || song.albumCover) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "150px" } // zaczyna dociągać na chwilę przed doscrollowaniem do kafelka
    );

    if (rowRef.current) {
      observer.observe(rowRef.current);
    }

    return () => observer.disconnect();
  }, [coverUrl, song.albumCover]);

  // 2. Pobranie okładki tylko po wejściu kafelka w pole widzenia
  useEffect(() => {
    if (!isVisible || coverUrl || song.albumCover) return;

    let isMounted = true;
    const cleanTitle = song.title.replace(/\(.*?\)/g, "").trim();
    const cleanArtist = song.artist.split(/[,;&/]/)[0].trim();

    fetch(`/api/deezer/cover?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.cover) {
          setCoverUrl(data.cover);
          song.albumCover = data.cover;
          updateSongCover(song.id, data.cover).catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isVisible, song.id, song.title, song.artist, coverUrl, song.albumCover]);

  const isBeingSwiped = swipedIdx?.id === String(song.id) && swipedIdx.isLockedHorizontal;
  const rawDiff = isBeingSwiped ? swipedIdx.currentX - swipedIdx.startX : 0;
  const clampedDiff = Math.max(0, rawDiff);
  const offsetX = clampedDiff > 10 ? clampedDiff : 0;

  const handleSwipeEnd = () => {
    if (swipedIdx?.id === String(song.id) && swipedIdx.isLockedHorizontal) {
      const diffX = swipedIdx.currentX - swipedIdx.startX;
      if (diffX > 75) {
        addToQueue({
          ...song,
          albumCover: coverUrl || song.albumCover || null,
          id: String(song.id),
          source: playlistName,
        });
        setAddedQueueNotice(song.title);
        setTimeout(() => setAddedQueueNotice(null), 1800);
      }
    }
    setSwipedIdx(null);
  };

  const handleTrackClick = () => {
    if (offsetX < 6) {
      const effectiveCover = coverUrl || song.albumCover || null;
      const formattedQueue = songsList.map((s: any) => ({
        ...s,
        albumCover: s.id === song.id ? effectiveCover : (s.albumCover || null),
        id: String(s.id),
        source: playlistName,
      }));
      setCurrentTrack(
        { ...song, albumCover: effectiveCover, id: String(song.id), source: playlistName },
        formattedQueue
      );
    }
  };

  return (
    <div ref={rowRef} className="relative overflow-hidden rounded-xl bg-[#091013]">
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
          setSwipedIdx({
            id: String(song.id),
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            currentX: e.touches[0].clientX,
            isLockedVertical: false,
            isLockedHorizontal: false,
          });
        }}
        onTouchMove={(e) => {
          if (!swipedIdx || swipedIdx.id !== String(song.id)) return;
          if (swipedIdx.isLockedVertical) return;

          const touch = e.touches[0];
          const diffX = touch.clientX - swipedIdx.startX;
          const diffY = touch.clientY - swipedIdx.startY;

          if (diffX < 0) return;

          if (!swipedIdx.isLockedHorizontal) {
            if (Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
              setSwipedIdx({ ...swipedIdx, isLockedVertical: true });
              return;
            }
            if (diffX > 12 && diffX > Math.abs(diffY)) {
              setSwipedIdx({
                ...swipedIdx,
                isLockedHorizontal: true,
                currentX: touch.clientX,
              });
              return;
            }
            return;
          }

          setSwipedIdx({
            ...swipedIdx,
            currentX: touch.clientX,
          });
        }}
        onTouchEnd={handleSwipeEnd}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          setSwipedIdx({
            id: String(song.id),
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            isMouseDown: true,
            isLockedHorizontal: true,
          });
        }}
        onMouseMove={(e) => {
          if (swipedIdx?.id === String(song.id) && swipedIdx.isMouseDown) {
            const diffX = e.clientX - swipedIdx.startX;
            if (diffX >= 0) {
              setSwipedIdx({
                ...swipedIdx,
                currentX: e.clientX,
              });
            }
          }
        }}
        onMouseUp={handleSwipeEnd}
        onMouseLeave={() => {
          if (swipedIdx?.id === String(song.id) && swipedIdx.isMouseDown) {
            handleSwipeEnd();
          }
        }}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isBeingSwiped ? "none" : "transform 0.2s ease-out",
        }}
        onClick={handleTrackClick}
        className={`relative z-10 flex items-center justify-between rounded-xl bg-[#0e1619] border p-2.5 transition cursor-pointer select-none active:scale-[0.99] ${
          isThisTrackPlaying
            ? "border-teal-400/80 bg-teal-950/20"
            : "border-teal-950/60 hover:border-teal-800/60"
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={song.title}
              className="h-11 w-11 rounded-lg object-cover flex-shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="h-11 w-11 rounded-lg bg-[#162125] flex items-center justify-center flex-shrink-0 border border-teal-950/60">
              <Music className="h-5 w-5 text-teal-400/50" />
            </div>
          )}
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

        <button
          onClick={(e) => {
            e.stopPropagation();
            setSongToDelete(song.id);
          }}
          className="p-2 text-gray-500 hover:text-red-400 transition active:scale-125 flex-shrink-0"
          title="Usuń z playlisty"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}