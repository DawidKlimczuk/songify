"use client";

import { useState, useEffect } from "react";
import { usePlayerStore, Track } from "@/lib/store/player-store";
import { Heart, Play, Pause, Loader2, Music } from "lucide-react";
import Link from "next/link";
import Header from "@/components/navigation/Header";
import { useRouter } from "next/navigation";

export const CATEGORIES_DATA = [
  {
    key: "TOPKI",
    label: "Oficjalne Listy Przebojów",
    icon: "🔥",
    playlists: [
      { id: "top-polska", title: "Top 50 Polska", desc: "Najpopularniejsze utwory w Polsce" },
      { id: "top-global", title: "Top 50 Global", desc: "Globalny ranking numer 1 na świecie" },
      { id: "todays-top-hits", title: "Today's Top Hits", desc: "Światowe gwiazdy i najświeższe premiery" },
      { id: "top-usa", title: "Top 50 USA", desc: "Największe hity w Stanach Zjednoczonych" },
      { id: "top-uk", title: "Top 50 UK", desc: "Bestsellery z Wielkiej Brytanii" },
      { id: "top-germany", title: "Top 50 Germany", desc: "Niemiecka lista przebojów" },
      { id: "top-ukraine", title: "Top 50 Ukraine", desc: "Ukraińskie hity numer 1" },
      { id: "top-spain", title: "Top 50 Spain", desc: "Gorące hity z hiszpańskiej listy" },
      { id: "top-norway", title: "Top 50 Norway", desc: "Norweskie notowanie top utworów" },
      { id: "teledyski-swiat", title: "Top Teledyski Świat", desc: "Globalne hity wideo" },
    ],
  },
  {
    key: "POLSKI_RAP",
    label: "Polski Rap & Hip-Hop",
    icon: "🎤",
    playlists: [
      { id: "rap-generacja", title: "Rap Generacja", desc: "Głos nowej fali polskiego rapu" },
      { id: "viral-rap", title: "Viral Rap", desc: "Najpopularniejszy rap z sieci i TikToka" },
      { id: "rap-sztosy", title: "Rap Sztosy", desc: "Czyste bangery i najmocniejsze zwrotki" },
      { id: "rap-klub", title: "Rap Klub", desc: "Trapowe i klubowe bity na głośniki" },
      { id: "rap-motywacja", title: "Rap Motywacja", desc: "Teksty pchające do przodu bez wymówek" },
      { id: "hip-hop-alert", title: "Hip Hop Alert", desc: "Najświeższe dropy i premiery" },
      { id: "rap-caviar", title: "RapCaviar", desc: "Światowa czołówka hip-hopu" },
    ],
  },
  {
    key: "POLSKA",
    label: "Polska Scena & Radio",
    icon: "🇵🇱",
    playlists: [
      { id: "rmf-maxx", title: "RMF MAXX", desc: "Gorąca setka i radio hity" },
      { id: "na-topie", title: "Na Topie", desc: "Wszystko co teraz brzmi w Polsce" },
      { id: "viral-hity", title: "Viral Hity PL", desc: "Polskie trendy podbijające internet" },
      { id: "disco-polo-super-przeboje", title: "Disco Polo Hity", desc: "Największe hity parkietowe" },
    ],
  },
  {
    key: "POP_HITY",
    label: "Pop & Nowości",
    icon: "✨",
    playlists: [
      { id: "new-music-friday", title: "New Music Friday", desc: "Piątkowe premiery muzyczne" },
      { id: "just-hits", title: "Just Hits", desc: "Samo gęste bez zbędnych wypełniaczy" },
      { id: "soft-pop-hits", title: "Soft Pop Hits", desc: "Spokojne, ciepłe melodie radiowe" },
      { id: "pop-remix", title: "Pop Remix", desc: "Znane przeboje w podkręconych wersjach" },
      { id: "viva-latino", title: "Viva Latino", desc: "Gorący reggaeton i latynoskie rytmy" },
      { id: "hot-country", title: "Hot Country", desc: "Współczesne amerykańskie country" },
      { id: "gold-edition", title: "Gold Edition", desc: "Klasyczne złote przeboje" },
    ],
  },
  {
    key: "DANCE",
    label: "Impreza & Dance Floor",
    icon: "🪩",
    playlists: [
      { id: "dance-party", title: "Dance Party", desc: "Mocny parkietowy beat" },
      { id: "dance-hits", title: "Dance Hits", desc: "Największe hity muzyki klubowej" },
      { id: "happy-beats", title: "Happy Beats", desc: "Pozytywne wibracje i energetyczny rytm" },
      { id: "deep-house-relax", title: "Deep House Relax", desc: "Czysty relaks przy głębokim basie" },
      { id: "lofi-house", title: "Lo-Fi House", desc: "Surowe analogowe bity i winylowy trzask" },
      { id: "hype", title: "Hype", desc: "Energetyczny zastrzyk na imprezę" },
    ],
  },
  {
    key: "RNB_SOUL",
    label: "R&B & Urban Soul",
    icon: "🕯️",
    playlists: [
      { id: "rnb-x", title: "RNB X", desc: "Współczesny, głęboki klimat R&B" },
      { id: "chilled-rnb", title: "Chilled R&B", desc: "Nocne, spokojne i zmysłowe brzmienia" },
      { id: "00s-rnb", title: "00s R&B Nostalgia", desc: "Nostalgiczne hymny lat dwutysięcznych" },
      { id: "love-deluxe", title: "Love Deluxe", desc: "Czysty romantyzm i soul" },
      { id: "rnb-weekly", title: "R&B Weekly", desc: "Świeże premiery gatunku" },
      { id: "hot-rhythmic-today", title: "Hot Rhythmic", desc: "Współczesny miejski puls" },
    ],
  },
  {
    key: "ROCK",
    label: "Rock & Gitary",
    icon: "🎸",
    playlists: [
      { id: "rock-classics", title: "Rock Classics", desc: "Nieśmiertelne hymny rocka" },
      { id: "rock-party", title: "Rock Party", desc: "Energetyczne riffy gitarowe" },
      { id: "rockin-vibes", title: "Rockin' Vibes", desc: "Lekkie brzmienia indie rocka" },
    ],
  },
  {
    key: "CHILL_LOFI",
    label: "Chill, Lo-Fi & Focus",
    icon: "☕",
    playlists: [
      { id: "lofi-hip-hop", title: "Lofi Hip Hop", desc: "Kultowe lo-fi bity do tła" },
      { id: "lofi-study", title: "Lofi Study", desc: "Spokój i pełna koncentracja do nauki" },
      { id: "chill-dribe", title: "Chill Drive", desc: "Płynna jazda i relaksujące dźwięki" },
      { id: "lofi-sleep", title: "Lofi Sleep", desc: "Dźwięki ułatwiające głęboki sen" },
      { id: "lofi-japan", title: "Lofi Japan", desc: "Orientalne japońskie sample i lo-fi" },
      { id: "lofi-summer-beats", title: "Lofi Summer Beats", desc: "Ciepłe letnie wibracje" },
      { id: "license-to-chill", title: "License to Chill", desc: "Czysty relaks i oddech" },
      { id: "peaceful-piano", title: "Peaceful Piano", desc: "Kojący, łagodny fortepian" },
      { id: "brain-food", title: "Brain Food", desc: "Elektronika wspomagająca pracę mózgu" },
      { id: "yoga-flow", title: "Yoga Flow", desc: "Harmonia dla ciała i umysłu" },
    ],
  },
  {
    key: "KINO",
    label: "Soundtracks & Kino",
    icon: "🎬",
    playlists: [
      { id: "hits-from-movies", title: "Hits From Movies", desc: "Najgłośniejsze przeboje kinowe" },
      { id: "iconic-soundtracks", title: "Iconic Soundtracks", desc: "Kultowe kompozycje filmowe" },
      { id: "sci-fi-soundtracks", title: "Sci-Fi Soundtracks", desc: "Kosmiczny klimat rodem z Interstellar" },
      { id: "needle-drop", title: "Needle Drop", desc: "Piosenki, które zdefiniowały sceny filmowe" },
      { id: "family-movie-hits", title: "Family Movie Hits", desc: "Animacje i kino familijne" },
    ],
  },
  {
    key: "WORKOUT",
    label: "Trening & Motywacja",
    icon: "⚡",
    playlists: [
      { id: "rap-workout", title: "Rap Workout", desc: "Najcięższe bity na siłownię" },
      { id: "rap-motywacja", title: "Rap Motywacja", desc: "Bez wymówek do ostatniej serii" },
    ],
  },
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
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});

  const {
    currentTrack,
    isPlaying,
    setCurrentTrack,
    togglePlay,
  } = usePlayerStore();

  // Inteligentne cache'owanie okładek: localStorage + pojedyncze pobieranie bez przeciążania serwera
  useEffect(() => {
    let savedCovers: Record<string, string> = {};
    try {
      const stored = localStorage.getItem("songify_covers_cache_v2");
      if (stored) {
        savedCovers = JSON.parse(stored);
        setCovers(savedCovers);
      }
    } catch {}

    const allPlaylists = CATEGORIES_DATA.flatMap((cat) => cat.playlists);
    const missing = allPlaylists.filter((item) => !savedCovers[item.id]);

    if (missing.length === 0) return; // Jeśli okładki są w cache, ZERO zapytań!

    const fetchMissingCovers = async () => {
      const updated = { ...savedCovers };
      const batchSize = 5;

      for (let i = 0; i < missing.length; i += batchSize) {
        const batch = missing.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (item) => {
            try {
              const res = await fetch(`/api/deezer/playlist/${item.id}?coversOnly=true`);
              const data = await res.json();
              if (data.cover) {
                updated[item.id] = data.cover;
              }
            } catch (e) {
              console.warn("Błąd pobierania okładki:", item.id);
            }
          })
        );
        setCovers({ ...updated });
        localStorage.setItem("songify_covers_cache_v2", JSON.stringify(updated));
      }
    };

    fetchMissingCovers();
  }, []);

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
        className="group relative mb-8 flex items-center gap-4 overflow-hidden rounded-2xl border border-teal-900/40 bg-gradient-to-r from-teal-950/60 to-[#0e1619] p-4 transition active:scale-[0.98] hover:border-teal-700/60"
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

      {/* Kategorie ze Spotify w poziomych karuzelach */}
      <div className="space-y-8">
        {CATEGORIES_DATA.map((category) => (
          <section key={category.key}>
            <div className="mb-3.5 flex items-center gap-2">
              <span className="text-base">{category.icon}</span>
              <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                {category.label}
              </h3>
            </div>

            <div
              ref={(el) => {
                if (!el || (el as any)._hasWheel) return;
                (el as any)._hasWheel = true;
                el.addEventListener(
                  "wheel",
                  (e: WheelEvent) => {
                    if (e.deltaY !== 0) {
                      e.preventDefault();
                      el.scrollLeft += e.deltaY;
                    }
                  },
                  { passive: false }
                );
              }}
              className="flex gap-4 overflow-x-auto pb-4 pt-1 -mx-4 px-4 scrollbar-none snap-x snap-mandatory"
            >
              {category.playlists.map((item) => {
                const isCurrentPlaying =
                  isPlaying && currentTrack?.source === item.title;
                const isLoadingThis = loadingPlaylistId === item.id;
                const coverUrl = covers[item.id];

                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/playlist/${item.id}`)}
                    className="group relative flex flex-col w-36 sm:w-40 flex-shrink-0 snap-start rounded-2xl bg-[#0e1619] border border-teal-950/70 p-2.5 transition active:scale-[0.98] hover:border-teal-800/80 cursor-pointer shadow-lg"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl mb-2.5 bg-[#162125] flex items-center justify-center">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <Music className="h-8 w-8 text-teal-500/30 animate-pulse" />
                      )}

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayDeezerPlaylist(item);
                        }}
                        className="absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-full bg-teal-400 text-black shadow-xl shadow-teal-950/80 transition transform active:scale-90 hover:scale-110"
                      >
                        {isLoadingThis ? (
                          <Loader2 className="h-4 w-4 animate-spin text-black" />
                        ) : isCurrentPlaying ? (
                          <Pause className="h-4 w-4 fill-black" />
                        ) : (
                          <Play className="h-4 w-4 fill-black ml-0.5" />
                        )}
                      </div>
                    </div>

                    <span className="truncate text-xs font-bold text-white group-hover:text-teal-400 transition">
                      {item.title}
                    </span>
                    <span className="line-clamp-2 text-[10px] text-gray-400 mt-0.5 leading-snug">
                      {item.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}