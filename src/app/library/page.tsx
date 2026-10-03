"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Music,
  Disc,
  Download,
  Folder,
  Heart,
  X,
  Upload,
  Globe,
  Lock,
  ListPlus,
  Loader2,
  ExternalLink,
  Check,
} from "lucide-react";
import {
  createPlaylist,
  getUserPlaylists,
  importPlaylistFromTracks,
} from "@/app/actions/playlist";

function SpotifyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.516 17.307c-.218.358-.68.472-1.038.254-2.87-1.753-6.482-2.15-10.738-1.177-.41.093-.815-.164-.908-.573-.093-.41.164-.814.573-.907 4.671-1.068 8.665-.615 11.86 1.365.357.218.471.68.253 1.038zm1.48-3.284c-.276.446-.86.588-1.306.313-3.283-2.018-8.288-2.603-12.172-1.423-.5.152-1.028-.135-1.18-.635-.152-.5.135-1.028.636-1.18 4.437-1.347 9.948-.698 13.71 1.618.446.276.587.86.312 1.307zm.128-3.418C15.202 8.293 8.76 8.08 5.097 9.192c-.604.183-1.246-.164-1.429-.767-.183-.604.164-1.246.767-1.429 4.22-1.282 11.332-1.034 15.82 1.63.544.323.722 1.028.4 1.572-.323.544-1.028.723-1.531.408z" />
    </svg>
  );
}

export default function LibraryPage() {
  const [tab, setTab] = useState<"PLAYLISTY" | "ALBUMY" | "POBRANE">("PLAYLISTY");
  const [searchQuery, setSearchQuery] = useState("");
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stany dla modali
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);

  // Formularz nowej playlisty
  const [playlistName, setPlaylistName] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Stany dla Kreatora Importu ze Spotify
  const [isImportStep1Open, setIsImportStep1Open] = useState(false);
  const [isImportStep2Open, setIsImportStep2Open] = useState(false);
  const [importTab, setImportTab] = useState<"link" | "text">("link");
  const [importUrl, setImportUrl] = useState("");
  const [importRawText, setImportRawText] = useState("");
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [pendingImportTracks, setPendingImportTracks] = useState<any[]>([]);

  // Dane tworzonej playlisty z importu
  const [importPlaylistName, setImportPlaylistName] = useState("");
  const [importPlaylistDescription, setImportPlaylistDescription] = useState("");
  const [importIsPublic, setImportIsPublic] = useState(true);
  const [importCoverPreview, setImportCoverPreview] = useState<string | null>(null);
  const [importCoverError, setImportCoverError] = useState<string | null>(null);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Krok 1 Importu: Parsowanie (Link lub Exportify CSV)
  const handleParseTracks = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportParseError(null);
    setIsParsingImport(true);

    try {
      let parsedTracks: any[] = [];
      let defaultTitle = "";

      if (importTab === "text") {
        if (!importRawText.trim()) {
          throw new Error("Wgraj plik CSV lub wklej listę utworów.");
        }

        const parseCsvLine = (text: string) => {
          const res: string[] = [];
          let cur = "";
          let inQuotes = false;
          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '"') {
              inQuotes = !inQuotes;
            } else if (ch === "," && !inQuotes) {
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

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (i === 0 && line.toLowerCase().includes("track uri")) continue;

          let spotifyId = "";
          let title = "";
          let artist = "Nieznany wykonawca";
          let duration = 0;

          if (line.includes(",")) {
            const cols = parseCsvLine(line);
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
            parsedTracks.push({
              id: spotifyId || `imported_${Date.now()}_${i}`,
              title,
              artist,
              albumCover: "",
              duration,
            });
          }
        }

        if (parsedTracks.length === 0) {
          throw new Error("Nie udało się rozpoznać utworów z pliku.");
        }
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
          throw new Error(errJson?.error || "Nie udało się pobrać utworów ze Spotify.");
        }

        const data = await res.json();
        if (!data.tracks || data.tracks.length === 0) {
          throw new Error("Playlista jest pusta lub wystąpił błąd.");
        }

        defaultTitle = data.name || "";
        parsedTracks = data.tracks.map((t: any) => ({
          id: String(t.id),
          title: t.title,
          artist: t.artist,
          albumCover: "",
          duration: t.duration || 0,
        }));
      }

      setPendingImportTracks(parsedTracks);
      setImportPlaylistName(defaultTitle.slice(0, 80));
      setImportPlaylistDescription("");
      setImportCoverPreview(null);
      setImportIsPublic(true);

      // Przechodzimy do Kroku 2
      setIsImportStep1Open(false);
      setIsImportStep2Open(true);
    } catch (err: any) {
      setImportParseError(err.message || "Błąd parsowania utworów.");
    } finally {
      setIsParsingImport(false);
    }
  };

  // Krok 2 Importu: Zapis playlisty w bazie danych
  const handleFinalizeImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingImport(true);

    try {
      await importPlaylistFromTracks({
        name: importPlaylistName.trim() || undefined,
        description: importPlaylistDescription.trim(),
        coverUrl: importCoverPreview,
        isPublic: importIsPublic,
        tracks: pendingImportTracks,
      });

      setIsImportStep2Open(false);
      setPendingImportTracks([]);
      setImportUrl("");
      setImportRawText("");
      await fetchPlaylists();
    } catch (err) {
      console.error("Błąd tworzenia zaimportowanej playlisty:", err);
      alert("Nie udało się zapisać playlisty. Spróbuj ponownie.");
    } finally {
      setIsSubmittingImport(false);
    }
  };

  const handleImportImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImportCoverError(null);
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setImportCoverError("Maksymalny rozmiar pliku to 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImportCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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

  // Upload grafiki (max 5 MB)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCoverError(null);

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setCoverError("Maksymalny rozmiar pliku to 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const finalName = playlistName.trim() ? playlistName.trim() : undefined;

      await createPlaylist({
        name: finalName,
        description: playlistDescription.trim(),
        coverUrl: coverPreview,
        isPublic,
      });

      setPlaylistName("");
      setPlaylistDescription("");
      setCoverPreview(null);
      setIsPublic(true);
      setIsCreatingModalOpen(false);
      await fetchPlaylists();
    } catch (err) {
      console.error("Błąd tworzenia playlisty:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPlaylists = playlists.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const customPlaylistsCount = playlists.filter((p) => p.name !== "Polubione utwory").length;

  return (
    <div className="min-h-screen pb-36 pt-6 px-4">
      {/* Pasek Górny */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold tracking-tight text-white">Twoja Biblioteka</h1>
        <button
          onClick={() => setIsPlusMenuOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 transition active:scale-95 shadow-sm hover:bg-teal-500 hover:text-black [html.light_&]:bg-[#f472b6] [html.light_&]:text-white [html.light_&]:border-[#f472b6] [html.light_&]:shadow-[#f472b6]/30 [html.light_&]:hover:bg-[#db2777] cursor-pointer"
          title="Dodaj"
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
                  const songs = item.songs || [];

                  return (
                    <Link
                      key={item.id}
                      href={`/library/playlist/${item.id}`}
                      className="flex flex-col rounded-xl bg-[#0e1619] border border-teal-950/60 p-3 transition active:scale-95 hover:border-teal-800/60 [html.light_&]:bg-white [html.light_&]:border-[#fce7f3]"
                    >
                      <div className="aspect-square w-full rounded-lg overflow-hidden bg-teal-950/30 border border-teal-900/30 flex items-center justify-center mb-2 [html.light_&]:border-[#fecdd3] relative">
                        {item.coverUrl ? (
                          <img
                            src={item.coverUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : isLiked ? (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-500/30 to-emerald-950 [html.light_&]:from-[#f43f5e]/20 [html.light_&]:to-[#ffe4e6]">
                            <Heart className="h-8 w-8 text-teal-400 fill-teal-400/30 [html.light_&]:text-[#be123c] [html.light_&]:fill-[#be123c]/30" />
                          </div>
                        ) : songs.length > 0 ? (
                          <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                            {[0, 1, 2, 3].map((idx) => {
                              const sCover = songs[idx]?.albumCover;
                              return (
                                <div
                                  key={idx}
                                  className="relative flex h-full w-full items-center justify-center border border-teal-900/20 bg-teal-950/50 [html.light_&]:border-white/30 [html.light_&]:bg-gradient-to-br [html.light_&]:from-[#ff758c] [html.light_&]:to-[#ff7eb3] overflow-hidden"
                                >
                                  {sCover ? (
                                    <img
                                      src={sCover}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Music className="h-5 w-5 text-teal-400/60 drop-shadow-sm [html.light_&]:text-white/95" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <Music className="h-8 w-8 text-teal-400/60 [html.light_&]:text-[#be123c]/60" />
                        )}
                      </div>
                      <span className="truncate text-xs font-semibold text-white [html.light_&]:text-[#5c0612]">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-gray-400 [html.light_&]:text-[#9f1239]">
                        {item.is_public === false || item.isPublic === false
                          ? "Prywatna playlista"
                          : "Playlista"}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {filteredPlaylists.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Folder className="h-10 w-10 text-gray-600 mb-2" />
                  <p className="text-xs text-gray-400">Brak playlist</p>
                  <button
                    onClick={() => setIsCreatingModalOpen(true)}
                    className="mt-3 text-xs font-semibold text-teal-400 hover:underline [html.light_&]:text-[#db2777] cursor-pointer"
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

      {/* MODAL 1: MENU OPCJI PLUSA (+) */}
      {isPlusMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 px-4 pb-6 sm:pb-0 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xs rounded-3xl border border-teal-900/80 bg-[#0c1417] p-4 shadow-2xl text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]">
            <div className="flex items-center justify-between pb-2.5 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-3">
              <h3 className="text-sm font-bold tracking-tight">Dodaj do biblioteki</h3>
              <button
                onClick={() => setIsPlusMenuOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  setIsCreatingModalOpen(true);
                }}
                className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-xs font-semibold text-gray-200 bg-[#121c20] border border-teal-900/40 hover:bg-teal-950/60 hover:text-teal-400 transition active:scale-95 cursor-pointer [html.light_&]:!bg-[#fff5f7] [html.light_&]:!border-[#fce7f3] [html.light_&]:!text-[#5c0612] [html.light_&]:hover:!bg-[#fae8ed]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 [html.light_&]:!bg-[#db2777] [html.light_&]:!text-white shadow-sm flex-shrink-0">
                  <ListPlus className="h-4 w-4 stroke-[2.4]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-white [html.light_&]:text-[#5c0612]">Utwórz playlistę</span>
                  <span className="text-[10px] text-gray-400 [html.light_&]:text-[#9f1239] font-normal">
                    Pusta playlista z własnym opisem
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  setImportParseError(null);
                  setIsImportStep1Open(true);
                }}
                className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-xs font-semibold text-gray-200 bg-[#121c20] border border-teal-900/40 hover:bg-teal-950/60 hover:text-teal-400 transition active:scale-95 cursor-pointer [html.light_&]:!bg-[#fff5f7] [html.light_&]:!border-[#fce7f3] [html.light_&]:!text-[#5c0612] [html.light_&]:hover:!bg-[#fae8ed]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1DB954]/20 text-[#1DB954] [html.light_&]:!bg-[#1DB954] [html.light_&]:!text-white shadow-sm flex-shrink-0">
                  <SpotifyIcon className="h-4 w-4 fill-current" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-white [html.light_&]:text-[#5c0612]">Importuj ze Spotify</span>
                  <span className="text-[10px] text-gray-400 [html.light_&]:text-[#9f1239] font-normal">
                    Z linku lub pliku Exportify CSV
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT KROK 1: POBIERANIE UTWORÓW */}
      {isImportStep1Open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-teal-900/70 bg-[#0e1619] p-6 shadow-2xl animate-in zoom-in-95 duration-150 [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:shadow-[#f472b6]/20">
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-4">
              <div className="flex items-center gap-2">
                <SpotifyIcon className="h-5 w-5 text-[#1DB954]" />
                <h3 className="text-sm font-bold text-white [html.light_&]:text-[#5c0612]">Importuj playlistę Spotify</h3>
              </div>
              <button
                onClick={() => setIsImportStep1Open(false)}
                className="text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:text-[#5c0612] transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#142025] rounded-xl mb-4 border border-teal-950/60 [html.light_&]:bg-[#fff1f2] [html.light_&]:border-[#fecdd3]">
              <button
                type="button"
                onClick={() => setImportTab("link")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
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
                className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  importTab === "text"
                    ? "bg-teal-400 text-black shadow [html.light_&]:bg-[#db2777] [html.light_&]:text-white"
                    : "text-gray-400 hover:text-white [html.light_&]:text-[#9f1239]"
                }`}
              >
                Exportify (600+ utworów)
              </button>
            </div>

            {importTab === "link" ? (
              <form onSubmit={handleParseTracks} className="space-y-4">
                <div className="rounded-2xl bg-[#142025]/80 border border-teal-950/70 p-3 text-[11px] text-gray-300 [html.light_&]:!bg-[#fff1f2] [html.light_&]:!border-[#fecdd3] [html.light_&]:!text-[#881337]">
                  Wklej publiczny link do playlisty Spotify. W kolejnym kroku dostosujesz nazwę, okładkę oraz opis!
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 [html.light_&]:text-[#9f1239] mb-1.5 block">
                    Link Spotify
                  </label>
                  <input
                    key="spotify-url-input"
                    type="text"
                    placeholder="https://open.spotify.com/playlist/..."
                    value={importUrl || ""}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="w-full rounded-xl border border-teal-900/60 bg-[#162125] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]"
                  />
                </div>

                {importParseError && (
                  <div className="rounded-xl bg-red-950/40 border border-red-800/50 p-2.5 text-xs text-red-300">
                    {importParseError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsImportStep1Open(false)}
                    className="rounded-xl px-4 py-2.5 text-xs font-medium text-gray-400 hover:text-white cursor-pointer"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isParsingImport || !importUrl.trim()}
                    className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-black hover:bg-teal-300 disabled:opacity-50 cursor-pointer [html.light_&]:bg-[#db2777] [html.light_&]:text-white"
                  >
                    {isParsingImport && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isParsingImport ? "Odczytywanie..." : "Dalej"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleParseTracks} className="space-y-4">
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
                    <li>Odszukaj playlistę na liście i kliknij zielony przycisk <b>Export</b>.</li>
                    <li>Wgraj pobrany plik <b>.csv</b> poniżej.</li>
                  </ol>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-gray-400 [html.light_&]:text-[#9f1239] mb-1.5 block">
                    Wgraj plik z urządzenia (.csv)
                  </label>
                  <input
                    key="spotify-csv-file-input"
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        if (content) setImportRawText(content);
                      };
                      reader.readAsText(file);
                    }}
                    className="w-full text-xs text-gray-300 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-400 file:text-black hover:file:bg-teal-300 file:cursor-pointer cursor-pointer border border-teal-900/60 rounded-xl p-1 bg-[#162125] [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fbcfe8] [html.light_&]:file:bg-[#db2777] [html.light_&]:file:text-white"
                  />
                </div>

                {importParseError && (
                  <div className="rounded-xl bg-red-950/40 border border-red-800/50 p-2.5 text-xs text-red-300">
                    {importParseError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsImportStep1Open(false);
                      setImportRawText("");
                    }}
                    className="rounded-xl px-4 py-2.5 text-xs font-medium text-gray-400 hover:text-white cursor-pointer"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isParsingImport || !importRawText.trim()}
                    className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-black hover:bg-teal-300 disabled:opacity-50 cursor-pointer [html.light_&]:bg-[#db2777] [html.light_&]:text-white"
                  >
                    {isParsingImport && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isParsingImport ? "Odczytywanie..." : "Dalej"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* IMPORT KROK 2: USTAWIENIA PLAYLISTY (OKŁADKA, NAZWA, OPIS, PUBLICZNA/PRYWATNA) */}
      {isImportStep2Open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]">
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">Dostosuj zaimportowaną playlistę</h3>
                <span className="text-[10px] font-semibold bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full [html.light_&]:bg-[#db2777]/20 [html.light_&]:text-[#db2777]">
                  {pendingImportTracks.length} utworów
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsImportStep2Open(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFinalizeImport} className="space-y-4">
              {/* Sekcja grafiki (max 5MB) */}
              <div className="flex items-center gap-3.5">
                <div
                  onClick={() => importFileInputRef.current?.click()}
                  className="relative aspect-square h-20 w-20 flex-shrink-0 rounded-2xl border-2 border-dashed border-teal-800/60 bg-[#121c20] hover:border-teal-400 transition cursor-pointer flex flex-col items-center justify-center overflow-hidden [html.light_&]:border-white/50 [html.light_&]:bg-gradient-to-br [html.light_&]:from-[#ff758c] [html.light_&]:to-[#ff7eb3] [html.light_&]:hover:opacity-95 shadow-sm"
                >
                  {importCoverPreview ? (
                    <img
                      src={importCoverPreview}
                      alt="Podgląd"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 [html.light_&]:text-white p-1 text-center drop-shadow-sm">
                      <Upload className="h-5 w-5 mb-1 [html.light_&]:text-white stroke-[2.4]" />
                      <span className="text-[9px] font-bold leading-tight [html.light_&]:text-white">
                        Grafika (max 5MB)
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-200 [html.light_&]:text-[#5c0612]">
                      Okładka (opcjonalna)
                    </span>
                    {importCoverPreview && (
                      <button
                        type="button"
                        onClick={() => setImportCoverPreview(null)}
                        className="text-[10px] text-red-400 hover:underline cursor-pointer"
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 [html.light_&]:text-[#9f1239] mt-0.5 leading-relaxed">
                    Brak grafiki? Automatycznie stworzymy mozaikę z pobranych utworów.
                  </p>
                  {importCoverError && <p className="text-[10px] text-red-400 mt-1">{importCoverError}</p>}
                </div>

                <input
                  ref={importFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImportImageChange}
                  className="hidden"
                />
              </div>

              {/* Nazwa Playlisty (Max 80 znaków) */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 [html.light_&]:text-[#5c0612] mb-1">
                  Nazwa playlisty
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={importPlaylistName}
                  onChange={(e) => setImportPlaylistName(e.target.value)}
                  placeholder={`np. Moja playlista #${customPlaylistsCount + 1}`}
                  className="w-full rounded-xl border border-teal-900/50 bg-[#162125] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3] [html.light_&]:text-[#5c0612] [html.light_&]:placeholder-[#9f1239]/50"
                />
              </div>

              {/* Opis (Max 300 znaków) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold text-gray-300 [html.light_&]:text-[#5c0612]">
                    Opis (opcjonalny)
                  </label>
                  <span className="text-[10px] text-gray-500 [html.light_&]:text-[#9f1239]">
                    {importPlaylistDescription.length}/300
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={importPlaylistDescription}
                  onChange={(e) => setImportPlaylistDescription(e.target.value)}
                  placeholder="Krótki opis lub skąd pochodzi ta playlista..."
                  className="w-full rounded-xl border border-teal-900/50 bg-[#162125] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none resize-none [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3] [html.light_&]:text-[#5c0612] [html.light_&]:placeholder-[#9f1239]/50"
                />
              </div>

              {/* Toggle: Publiczna / Prywatna */}
              <div className="flex flex-col gap-2 rounded-xl bg-[#121c20] p-3 border border-teal-950/60 [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {importIsPublic ? (
                      <Globe className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-400 [html.light_&]:text-[#9f1239]" />
                    )}
                    <div>
                      <span className="block text-xs font-semibold text-gray-200 [html.light_&]:text-[#5c0612]">
                        {importIsPublic ? "Playlista publiczna" : "Playlista prywatna"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setImportIsPublic(!importIsPublic)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                      importIsPublic
                        ? "bg-teal-400 [html.light_&]:bg-[#db2777]"
                        : "bg-gray-700 [html.light_&]:bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black [html.light_&]:bg-white transition-transform ${
                        importIsPublic ? "translate-x-4.5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <p className="text-[10px] text-teal-300/80 [html.light_&]:text-[#9f1239] leading-relaxed border-t border-teal-900/30 [html.light_&]:border-[#fce7f3] pt-2">
                  Importujesz playlistę ze Spotify – rekomendujemy zostawić ją jako <b>publiczną</b>, aby inni użytkownicy mogli jej słuchać i odkrywać nową muzykę bez konieczności ponownego importowania.
                </p>
              </div>

              {/* Przyciski Akcji */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportStep2Open(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingImport}
                  className="flex items-center gap-1.5 rounded-xl bg-teal-400 px-5 py-2.5 text-xs font-bold text-black shadow-lg shadow-teal-500/20 hover:scale-[1.02] active:scale-95 transition cursor-pointer [html.light_&]:bg-[#db2777] [html.light_&]:text-white disabled:opacity-50"
                >
                  {isSubmittingImport && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSubmittingImport ? "Zapisywanie utworów..." : "Zapisz playlistę"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TWORZENIE PLAYLISTY (FORMULARZ) */}
      {isCreatingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-teal-900/80 bg-[#0c1417] p-5 shadow-2xl text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]">
            <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] mb-4">
              <h3 className="text-sm font-bold tracking-tight">Nowa playlista</h3>
              <button
                type="button"
                onClick={() => setIsCreatingModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Sekcja grafiki (max 5MB) */}
              <div className="flex items-center gap-3.5">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative aspect-square h-20 w-20 flex-shrink-0 rounded-2xl border-2 border-dashed border-teal-800/60 bg-[#121c20] hover:border-teal-400 transition cursor-pointer flex flex-col items-center justify-center overflow-hidden [html.light_&]:border-white/50 [html.light_&]:bg-gradient-to-br [html.light_&]:from-[#ff758c] [html.light_&]:to-[#ff7eb3] [html.light_&]:hover:opacity-95 shadow-sm"
                >
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Podgląd"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 [html.light_&]:text-white p-1 text-center drop-shadow-sm">
                      <Upload className="h-5 w-5 mb-1 [html.light_&]:text-white stroke-[2.4]" />
                      <span className="text-[9px] font-bold leading-tight [html.light_&]:text-white">
                        Grafika (max 5MB)
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-200 [html.light_&]:text-[#5c0612]">
                      Okładka (opcjonalna)
                    </span>
                    {coverPreview && (
                      <button
                        type="button"
                        onClick={() => setCoverPreview(null)}
                        className="text-[10px] text-red-400 hover:underline cursor-pointer"
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 [html.light_&]:text-[#9f1239] mt-0.5 leading-relaxed">
                    Jeśli nie dodasz grafiki, okładką stanie się mozaika 4 dodanych utworów.
                  </p>
                  {coverError && <p className="text-[10px] text-red-400 mt-1">{coverError}</p>}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* Nazwa Playlisty (Opcjonalna) */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 [html.light_&]:text-[#5c0612] mb-1">
                  Nazwa playlisty
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={playlistName || ""}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder={`np. Moja playlista #${customPlaylistsCount + 1}`}
                  className="w-full rounded-xl border border-teal-900/50 bg-[#162125] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3] [html.light_&]:text-[#5c0612] [html.light_&]:placeholder-[#9f1239]/50"
                />
              </div>

              {/* Opis (Max 300 znaków) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold text-gray-300 [html.light_&]:text-[#5c0612]">
                    Opis (opcjonalny)
                  </label>
                  <span className="text-[10px] text-gray-500 [html.light_&]:text-[#9f1239]">
                    {(playlistDescription || "").length}/300
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={playlistDescription || ""}
                  onChange={(e) => setPlaylistDescription(e.target.value)}
                  placeholder="Krótki opis, emoji lub notatka..."
                  className="w-full rounded-xl border border-teal-900/50 bg-[#162125] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none resize-none [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3] [html.light_&]:text-[#5c0612] [html.light_&]:placeholder-[#9f1239]/50"
                />
              </div>

              {/* Toggle: Publiczna / Prywatna */}
              <div className="flex items-center justify-between rounded-xl bg-[#121c20] p-3 border border-teal-950/60 [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3]">
                <div className="flex items-center gap-2.5">
                  {isPublic ? (
                    <Globe className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
                  ) : (
                    <Lock className="h-4 w-4 text-gray-400 [html.light_&]:text-[#9f1239]" />
                  )}
                  <div>
                    <span className="block text-xs font-semibold text-gray-200 [html.light_&]:text-[#5c0612]">
                      {isPublic ? "Playlista publiczna" : "Playlista prywatna"}
                    </span>
                    <span className="block text-[10px] text-gray-400 [html.light_&]:text-[#9f1239]">
                      {isPublic
                        ? "Będzie widoczna w wyszukiwarce dla innych"
                        : "Dostępna tylko dla Ciebie"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    isPublic
                      ? "bg-teal-400 [html.light_&]:bg-[#db2777]"
                      : "bg-gray-700 [html.light_&]:bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black [html.light_&]:bg-white transition-transform ${
                      isPublic ? "translate-x-4.5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Przyciski Akcji */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-teal-400 px-5 py-2.5 text-xs font-bold text-black shadow-lg shadow-teal-500/20 hover:scale-[1.02] active:scale-95 transition cursor-pointer [html.light_&]:bg-[#db2777] [html.light_&]:text-white disabled:opacity-50"
                >
                  {isSubmitting ? "Tworzenie..." : "Utwórz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}