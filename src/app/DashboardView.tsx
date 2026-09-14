"use client";

import { useState, useEffect } from "react";
import { usePlayerStore, Track } from "@/lib/store/player-store";
import { Heart, Play, Pause, Sparkles, Loader2, Music } from "lucide-react";
import Link from "next/link";
import Header from "@/components/navigation/Header";
import { useRouter } from "next/navigation";

const CATEGORIES = {
  POLSKA: [
    {
      id: "top-polska",
      title: "Top 50 Polska",
      desc: "Aktualne hity numer 1 w Polsce",
    },
    {
      id: "polski-rap",
      title: "Polski Rap",
      desc: "Bedoes, Gibbs, Kukon, Szpaku i inni",
    },
    {
      id: "hity-pl",
      title: "Hity Na Czasie PL",
      desc: "Radiowe przeboje i najświeższy pop",
    },
    {
      id: "polski-rock",
      title: "Polski Rock & Klasyki",
      desc: "Brzmienie gitar, Myslovitz, Kult, Podsiadło",
    },
  ],
  SWIAT: [
    {
      id: "top-worldwide",
      title: "Top 50 Worldwide",
      desc: "Globalne hity numer 1 na świecie",
    },
    {
      id: "top-usa",
      title: "Top USA Hits",
      desc: "Największe przeboje z amerykańskich list",
    },
    {
      id: "viral-global",
      title: "Viral Hits Global",
      desc: "Trendy z sieci i social mediów",
    },
    {
      id: "todays-hits",
      title: "Today's Biggest Hits",
      desc: "Światowe gwiazdy i świeże premiery",
    },
  ],
  GATUNKI: [
    {
      id: "rap-global",
      title: "Rap Bangers Global",
      desc: "Travis Scott, Metro Boomin, Drake i inni",
    },
    {
      id: "club-dance",
      title: "Club & Dance Floor",
      desc: "Mocny bas, tech-house i klubowy vibe",
    },
    {
      id: "rock-classics",
      title: "Rock Classics",
      desc: "Legendarne hymny wszech czasów",
    },
    {
      id: "rnb-soul",
      title: "R&B & Urban Soul",
      desc: "Gładkie brzmienia i głęboki groove",
    },
  ],
  KLIMAT: [
    {
      id: "nocna-trasa",
      title: "Nocna Trasa / Night Drive",
      desc: "Synthwave, chillstep i nocne tempo za kółkiem",
    },
    {
      id: "gym-workout",
      title: "Gym Hardcore Workout",
      desc: "Czysta energia i motywacja na trening",
    },
    {
      id: "chill-focus",
      title: "Chill & Deep Focus",
      desc: "Relaks, lo-fi i ambient do pracy oraz nauki",
    },
    {
      id: "party-starter",
      title: "Party Starter",
      desc: "Najlepsze kawałki na rozkręcenie domówki",
    },
  ],
};

const TABS_CONFIG = [
  { key: "POLSKA", label: "Polska", icon: "🇵🇱" },
  { key: "SWIAT", label: "Świat", icon: "🌍" },
  { key: "GATUNKI", label: "Gatunki", icon: "🎧" },
  { key: "KLIMAT", label: "Vibe", icon: "🌙" },
];

export default function DashboardView({
  username,
  avatarUrl,
  likedPlaylistId,
}: {
  username?: string;
  avatarUrl?: string | null;
  likedPlaylistId: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<keyof typeof CATEGORIES>("POLSKA");
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});

  const {
    currentTrack,
    isPlaying,
    setCurrentTrack,
    togglePlay,
  } = usePlayerStore();

  // Dynamiczne pobieranie i cache'owanie okładek z dokładnie tego samego endpointu, z którego korzysta widok playlisty
  useEffect(() => {
    // Sprawdzamy czy mamy już zapisane okładki w sesji
    const cached = sessionStorage.getItem("songify_playlist_covers");
    if (cached) {
      try {
        setCovers(JSON.parse(cached));
      } catch (e) {}
    }

    const currentList = CATEGORIES[activeTab];
    currentList.forEach(async (item) => {
      // Jeśli już mamy okładkę dla tej playlisty, nie pytamy ponownie
      if (covers[item.id]) return;

      try {
        const res = await fetch(`/api/deezer/playlist/${item.id}`);
        const data = await res.json();
        if (data.cover) {
          setCovers((prev) => {
            const updated = { ...prev, [item.id]: data.cover };
            sessionStorage.setItem("songify_playlist_covers", JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err) {
        console.error("Błąd pobierania okładki:", item.id, err);
      }
    });
  }, [activeTab]);

  const handlePlayDeezerPlaylist = async (playlist: {
    id: string;
    title: string;
    desc: string;
  }) => {
    if (currentTrack?.source === playlist.title) {
      togglePlay();
      return;
    }

    setLoadingPlaylistId(playlist.id);
    try {
      const res = await fetch(`/api/deezer/playlist/${playlist.id}`);
      const data = await res.json();

      if (data.tracks && data.tracks.length > 0) {
        const queue: Track[] = data.tracks.map((t: any) => ({
          ...t,
          source: playlist.title,
        }));

        setCurrentTrack(queue[0], queue);
      } else {
        alert("Nie udało się pobrać utworów z tej playlisty.");
      }
    } catch (err) {
      console.error(err);
      alert("Wystąpił błąd podczas ładowania playlisty.");
    } finally {
      setLoadingPlaylistId(null);
    }
  };

  return (
    <div className="min-h-screen pb-36 pt-20 px-4">
      <Header username={username} avatarUrl={avatarUrl} />

      {/* Skrót: Polubione Utwory */}
      <Link
        href={`/library/playlist/${likedPlaylistId}`}
        className="group relative mb-6 flex items-center gap-4 overflow-hidden rounded-2xl border border-teal-900/40 bg-gradient-to-r from-teal-950/60 to-[#0e1619] p-4 transition active:scale-[0.98] hover:border-teal-700/60"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500 text-black shadow-lg shadow-teal-500/20 flex-shrink-0">
          <Heart className="h-6 w-6 fill-black" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-white group-hover:text-teal-400 transition truncate">
            Polubione utwory
          </h2>
          <p className="text-xs text-gray-400">Twoja prywatna playlista</p>
        </div>
        <div className="text-teal-400 opacity-80 group-hover:opacity-100 transition pr-1">
          <Play className="h-5 w-5 fill-teal-400" />
        </div>
      </Link>

      {/* Zakładki Kategorii (Polska, Świat, Gatunki, Vibe) */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none border-b border-teal-950/60">
        {TABS_CONFIG.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as keyof typeof CATEGORIES)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition flex-shrink-0 ${
              activeTab === t.key
                ? "bg-teal-500 text-black shadow-md shadow-teal-500/25 scale-[1.02]"
                : "bg-[#0e1619] text-gray-400 border border-teal-900/30 hover:text-white"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Siatka Playlist danej kategorii */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-400" />
          <h3 className="text-sm font-bold tracking-wide text-white">
            {TABS_CONFIG.find((t) => t.key === activeTab)?.label} – Oficjalne Playlisty
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          {CATEGORIES[activeTab].map((item) => {
            const isCurrentPlaying =
              isPlaying && currentTrack?.source === item.title;
            const isLoadingThis = loadingPlaylistId === item.id;
            const coverUrl = covers[item.id];

            return (
              <div
                key={item.id}
                onClick={() => router.push(`/playlist/${item.id}`)}
                className="group relative flex flex-col rounded-2xl bg-[#0e1619] border border-teal-950/70 p-3 transition active:scale-[0.98] hover:border-teal-800/80 cursor-pointer shadow-lg"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-xl mb-2.5 bg-[#162125] flex items-center justify-center">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <Music className="h-10 w-10 text-teal-500/30 animate-pulse" />
                  )}

                  {/* Szybki Play/Pause na kafelku */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayDeezerPlaylist(item);
                    }}
                    className="absolute right-2.5 bottom-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-teal-400 text-black shadow-xl shadow-teal-950/80 transition transform active:scale-90 hover:scale-110"
                  >
                    {isLoadingThis ? (
                      <Loader2 className="h-5 w-5 animate-spin text-black" />
                    ) : isCurrentPlaying ? (
                      <Pause className="h-5 w-5 fill-black" />
                    ) : (
                      <Play className="h-5 w-5 fill-black ml-0.5" />
                    )}
                  </div>
                </div>

                <span className="truncate text-xs font-bold text-white group-hover:text-teal-400 transition">
                  {item.title}
                </span>
                <span className="line-clamp-1 text-[11px] text-gray-400 mt-0.5">
                  {item.desc}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}