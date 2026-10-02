import { NextResponse } from "next/server";

// Bezpieczny import runtime CommonJS dla Next.js / TypeScript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const spotifyUrlInfo = require("spotify-url-info");
const { getTracks, getDetails } = spotifyUrlInfo(fetch);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const SPOTIFY_PLAYLIST_REGISTRY: Record<
  string,
  { spotifyId: string; title: string; desc: string; category: string }
> = {
  // === TOPKI / CHARTS ===
  "top-polska": { spotifyId: "37i9dQZEVXbN6itCcaL3Tt", title: "Top 50 Polska", desc: "Najpopularniejsze utwory w Polsce", category: "TOPKI" },
  "top-global": { spotifyId: "37i9dQZEVXbMDoHDwVN2tF", title: "Top 50 Global", desc: "Globalny ranking numer 1 na świecie", category: "TOPKI" },
  "top-usa": { spotifyId: "37i9dQZEVXbLRQDuF5jeBp", title: "Top 50 USA", desc: "Największe hity w Stanach Zjednoczonych", category: "TOPKI" },
  "top-uk": { spotifyId: "37i9dQZEVXbLnolsZ8PSNw", title: "Top 50 UK", desc: "Bestsellery z Wielkiej Brytanii", category: "TOPKI" },
  "top-germany": { spotifyId: "37i9dQZEVXbJiZcmkrIHGU", title: "Top 50 Germany", desc: "Niemiecka lista przebojów", category: "TOPKI" },
  "top-ukraine": { spotifyId: "37i9dQZEVXbKkidEfWYRuD", title: "Top 50 Ukraine", desc: "Ukraińskie hity numer 1", category: "TOPKI" },
  "top-spain": { spotifyId: "37i9dQZEVXbNFJfN1Vw8d9", title: "Top 50 Spain", desc: "Gorące hity z hiszpańskiej listy", category: "TOPKI" },
  "top-norway": { spotifyId: "37i9dQZEVXbJvfa0Yxg7E7", title: "Top 50 Norway", desc: "Norweskie notowanie top utworów", category: "TOPKI" },
  "todays-top-hits": { spotifyId: "37i9dQZF1DXcBWIGoYBM5M", title: "Today's Top Hits", desc: "Światowe gwiazdy i najświeższe premiery", category: "TOPKI" },
  "teledyski-swiat": { spotifyId: "37i9dQZEVXbBp04WrWQudL", title: "Top Teledyski Świat", desc: "Globalne hity wideo", category: "TOPKI" },

  // === POLSKI RAP & BITY ===
  "rap-generacja": { spotifyId: "37i9dQZF1DWXJnyndhASBe", title: "Rap Generacja", desc: "Głos nowej fali polskiego rapu", category: "POLSKI_RAP" },
  "viral-rap": { spotifyId: "37i9dQZF1DX35mEXECRn6o", title: "Viral Rap", desc: "Najpopularniejszy rap z sieci i TikToka", category: "POLSKI_RAP" },
  "rap-sztosy": { spotifyId: "37i9dQZF1DWXo9v62EXLlM", title: "Rap Sztosy", desc: "Czyste bangery i najmocniejsze zwrotki", category: "POLSKI_RAP" },
  "rap-klub": { spotifyId: "37i9dQZF1DX3HUaZJRcDLd", title: "Rap Klub", desc: "Trapowe i klubowe bity na głośniki", category: "POLSKI_RAP" },
  "rap-motywacja": { spotifyId: "37i9dQZF1DXa3d3ljLBxSG", title: "Rap Motywacja", desc: "Teksty pchające do przodu bez wymówek", category: "POLSKI_RAP" },
  "hip-hop-alert": { spotifyId: "37i9dQZF1DX06QJ0dliLsu", title: "Hip Hop Alert", desc: "Najświeższe dropy i premiery", category: "POLSKI_RAP" },
  "rap-caviar": { spotifyId: "37i9dQZF1DX0XUsuxWHRQd", title: "RapCaviar", desc: "Światowa czołówka hip-hopu", category: "POLSKI_RAP" },

  // === POLSKA SCENA & RADIO ===
  "rmf-maxx": { spotifyId: "1leWKIMy3rLDi36t8iIjmK", title: "RMF MAXX", desc: "Gorąca setka i radio hity", category: "POLSKA" },
  "na-topie": { spotifyId: "37i9dQZF1DWYxW9251gTHk", title: "Na Topie", desc: "Wszystko co teraz brzmi w Polsce", category: "POLSKA" },
  "viral-hity": { spotifyId: "37i9dQZF1DWUKw1j740sGk", title: "Viral Hity PL", desc: "Polskie trendy podbijające internet", category: "POLSKA" },
  "disco-polo-super-przeboje": { spotifyId: "37i9dQZF1DXahkpBcruHaS", title: "Disco Polo Hity", desc: "Największe hity parkietowe", category: "POLSKA" },

  // === POP & HITY ===
  "new-music-friday": { spotifyId: "37i9dQZF1DX4JAvHpjipBk", title: "New Music Friday", desc: "Piątkowe premiery muzyczne", category: "POP_HITY" },
  "just-hits": { spotifyId: "37i9dQZF1DXcRXFNfZr7Tp", title: "Just Hits", desc: "Samo gęste bez zbędnych wypełniaczy", category: "POP_HITY" },
  "soft-pop-hits": { spotifyId: "37i9dQZF1DWTwnEm1IYyoj", title: "Soft Pop Hits", desc: "Spokojne, ciepłe melodie radiowe", category: "POP_HITY" },
  "pop-remix": { spotifyId: "37i9dQZF1DXcZDD7cfEKhW", title: "Pop Remix", desc: "Znane przeboje w podkręconych wersjach", category: "POP_HITY" },
  "viva-latino": { spotifyId: "37i9dQZF1DX10zKzsJ2jva", title: "Viva Latino", desc: "Gorący reggaeton i latynoskie rytmy", category: "POP_HITY" },
  "hot-country": { spotifyId: "37i9dQZF1DX1lVhptIYRda", title: "Hot Country", desc: "Współczesne amerykańskie country", category: "POP_HITY" },
  "gold-edition": { spotifyId: "37i9dQZF1DWXnexX7CktaI", title: "Gold Edition", desc: "Klasyczne złote przeboje", category: "POP_HITY" },

  // === IMPREZA & DANCE ===
  "dance-party": { spotifyId: "37i9dQZF1DXaXB8fQg7xif", title: "Dance Party", desc: "Mocny parkietowy beat", category: "DANCE" },
  "dance-hits": { spotifyId: "37i9dQZF1DX0BcQWzuB7ZO", title: "Dance Hits", desc: "Największe hity muzyki klubowej", category: "DANCE" },
  "happy-beats": { spotifyId: "37i9dQZF1DWSf2RDTDayIx", title: "Happy Beats", desc: "Pozytywne wibracje i energetyczny rytm", category: "DANCE" },
  "deep-house-relax": { spotifyId: "37i9dQZF1DX2TRYkJECvfC", title: "Deep House Relax", desc: "Czysty relaks przy głębokim basie", category: "DANCE" },
  "lofi-house": { spotifyId: "37i9dQZF1DXbXD9pMSZomS", title: "Lo-Fi House", desc: "Surowe analogowe bity i winylowy trzask", category: "DANCE" },
  "hype": { spotifyId: "37i9dQZF1DX4eRPd9frC1m", title: "Hype", desc: "Energetyczny zastrzyk na imprezę", category: "DANCE" },

  // === R&B & SOUL ===
  "rnb-x": { spotifyId: "37i9dQZF1DX4SBhb3fqCJd", title: "RNB X", desc: "Współczesny, głęboki klimat R&B", category: "RNB_SOUL" },
  "chilled-rnb": { spotifyId: "37i9dQZF1DX2UgsUIg75Vg", title: "Chilled R&B", desc: "Nocne, spokojne i zmysłowe brzmienia", category: "RNB_SOUL" },
  "00s-rnb": { spotifyId: "37i9dQZF1DWYmmr74INQlb", title: "00s R&B Nostalgia", desc: "Nostalgiczne hymny lat dwutysięcznych", category: "RNB_SOUL" },
  "love-deluxe": { spotifyId: "37i9dQZF1DWVEvzGeX3eRs", title: "Love Deluxe", desc: "Czysty romantyzm i soul", category: "RNB_SOUL" },
  "rnb-weekly": { spotifyId: "37i9dQZF1DWUzFXarNiofw", title: "R&B Weekly", desc: "Świeże premiery gatunku", category: "RNB_SOUL" },
  "hot-rhythmic-today": { spotifyId: "37i9dQZF1DWYs83FtTMQFw", title: "Hot Rhythmic", desc: "Współczesny miejski puls", category: "RNB_SOUL" },

  // === ROCK & GITARY ===
  "rock-classics": { spotifyId: "37i9dQZF1DWXRqgorJj26U", title: "Rock Classics", desc: "Nieśmiertelne hymny rocka", category: "ROCK" },
  "rock-party": { spotifyId: "37i9dQZF1DX8FwnYE6PRvL", title: "Rock Party", desc: "Energetyczne riffy gitarowe", category: "ROCK" },
  "rockin-vibes": { spotifyId: "37i9dQZF1DX2aneNMeYHQ8", title: "Rockin' Vibes", desc: "Lekkie brzmienia indie rocka", category: "ROCK" },

  // === CHILL, LO-FI & FOCUS ===
  "lofi-hip-hop": { spotifyId: "0vvXsWCC9xrXsKd4FyS8kM", title: "Lofi Hip Hop", desc: "Kultowe lo-fi bity do tła", category: "CHILL_LOFI" },
  "lofi-study": { spotifyId: "6zCID88oNjNv9zx6puDHKj", title: "Lofi Study", desc: "Spokój i pełna koncentracja do nauki", category: "CHILL_LOFI" },
  "chill-dribe": { spotifyId: "5SDPei4m0IuABIYRsDJcBC", title: "Chill Drive", desc: "Płynna jazda i relaksujące dźwięki", category: "CHILL_LOFI" },
  "lofi-sleep": { spotifyId: "37i9dQZF1DX2PQDq3PdrHQ", title: "Lofi Sleep", desc: "Dźwięki ułatwiające głęboki sen", category: "CHILL_LOFI" },
  "lofi-japan": { spotifyId: "5YKm5Zt0AUdKrlrvWzUV6l", title: "Lofi Japan", desc: "Orientalne japońskie sample i lo-fi", category: "CHILL_LOFI" },
  "lofi-summer-beats": { spotifyId: "37i9dQZF1DX8NMUtC3b3gL", title: "Lofi Summer Beats", desc: "Ciepłe letnie wibracje", category: "CHILL_LOFI" },
  "license-to-chill": { spotifyId: "37i9dQZF1DXa9xHlDa5fc6", title: "License to Chill", desc: "Czysty relaks i oddech", category: "CHILL_LOFI" },
  "peaceful-piano": { spotifyId: "37i9dQZF1DX4sWSpwq3LiO", title: "Peaceful Piano", desc: "Kojący, łagodny fortepian", category: "CHILL_LOFI" },
  "brain-food": { spotifyId: "37i9dQZF1DWXLeA8Omikj7", title: "Brain Food", desc: "Elektronika wspomagająca pracę mózgu", category: "CHILL_LOFI" },
  "yoga-flow": { spotifyId: "37i9dQZF1DX3AqNtukWhcT", title: "Yoga Flow", desc: "Harmonia dla ciała i umysłu", category: "CHILL_LOFI" },

  // === SOUNDTRACKS & KINO ===
  "hits-from-movies": { spotifyId: "37i9dQZF1DXb69UWhjrXsW", title: "Hits From Movies", desc: "Najgłośniejsze przeboje kinowe", category: "KINO" },
  "iconic-soundtracks": { spotifyId: "37i9dQZF1DX1tz6EDao8it", title: "Iconic Soundtracks", desc: "Kultowe kompozycje filmowe", category: "KINO" },
  "sci-fi-soundtracks": { spotifyId: "37i9dQZF1DXbIeCFU20wRm", title: "Sci-Fi Soundtracks", desc: "Kosmiczny klimat z filmów sci-fi", category: "KINO" },
  "needle-drop": { spotifyId: "37i9dQZF1DXbLzW15wHm9R", title: "Needle Drop", desc: "Piosenki, które zdefiniowały sceny filmowe", category: "KINO" },
  "family-movie-hits": { spotifyId: "37i9dQZF1DXd4bJEFQJTXh", title: "Family Movie Hits", desc: "Animacje i kino familijne", category: "KINO" },

  // === TRENING & MOTYWACJA ===
  "rap-workout": { spotifyId: "37i9dQZF1DX76t638V6CA8", title: "Rap Workout", desc: "Najcięższe bity na siłownię", category: "WORKOUT" },
};

// Pamięć podręczna w procesie Node dla okładek (błyskawiczne serwowanie w RAM)
const memoryCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 godziny

// Globalna mapa cache dla okładek pojedynczych piosenek, żeby nie pytać o to samo
const songCoverCache = new Map<string, string>();

// Dociągacz okładek wykorzystujący sprawdzony silnik wyszukiwania aplikacji
async function fetchTrackCoverFallback(title: string, artist: string): Promise<string | null> {
  const cleanedTitle = title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/-.*$/g, "")
    .replace(/feat\..*$/gi, "")
    .replace(/["'„”]/g, "")
    .trim();

  const mainArtist = artist.split(/[,&/]/)[0].trim();
  const cacheKey = `${cleanedTitle.toLowerCase()}__${mainArtist.toLowerCase()}`;

  if (songCoverCache.has(cacheKey)) {
    return songCoverCache.get(cacheKey)!;
  }

  // 1. Sprawdzona wyszukiwarka Deezer (dokładnie tak jak w searchu aplikacji)
  try {
    const query = `${cleanedTitle} ${mainArtist}`.trim();
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        next: { revalidate: 604800 },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data[0]) {
        const cover =
          data.data[0].album?.cover_big ||
          data.data[0].album?.cover_medium ||
          data.data[0].album?.cover ||
          null;
        if (cover) {
          songCoverCache.set(cacheKey, cover);
          return cover;
        }
      }
    }
  } catch {}

  // 2. Fallback: iTunes API z wymaganym nagłówkiem User-Agent
  try {
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(cleanedTitle + " " + mainArtist)}&media=music&limit=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        next: { revalidate: 604800 },
      }
    );
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      const first = itunesData.results?.[0];
      if (first?.artworkUrl100) {
        const cover = first.artworkUrl100.replace("100x100bb", "600x600bb");
        songCoverCache.set(cacheKey, cover);
        return cover;
      }
    }
  } catch {}

  return null;
}

function extractSpotifyEntity(jsonData: any) {
  if (!jsonData) return null;
  const pageProps = jsonData?.props?.pageProps;
  if (!pageProps) return null;

  if (pageProps.state?.data?.entity) return pageProps.state.data.entity;
  if (pageProps.state?.data?.playlistV2) return pageProps.state.data.playlistV2;

  const apolloState = pageProps.initialState || pageProps.state;
  if (apolloState) {
    for (const key of Object.keys(apolloState)) {
      if (key.startsWith("Playlist:") || key.startsWith("PlaylistResponse:")) {
        return apolloState[key];
      }
    }
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const url = new URL(request.url);
  const coversOnly = url.searchParams.get("coversOnly") === "true";

  console.log("===> [SONGIFY] Rozpoczęto pobieranie playlisty:", rawId);

  if (!rawId) {
    return NextResponse.json({ error: "Brak ID" }, { status: 400 });
  }

  memoryCache.delete(rawId);
  const now = Date.now();

  const config = SPOTIFY_PLAYLIST_REGISTRY[rawId];
  const spotifyPlaylistId = config ? config.spotifyId : rawId;
  const displayTitle = config ? config.title : "Songify Playlist";

  try {
    let allTracks: any[] = [];
    let coverUrl = "";
    let playlistTitle = displayTitle;

    // KROK 1: Pobieranie pełnej playlisty za pomocą dedykowanego scrapera spotify-url-info
    try {
      const fullUrl = `https://open.spotify.com/playlist/${spotifyPlaylistId}`;
      console.log("===> [SONGIFY] Pobieranie metadanych przez spotify-url-info...");
      
      const [details, rawTracksList] = await Promise.all([
        getDetails(fullUrl).catch(() => null),
        getTracks(fullUrl).catch(() => []),
      ]);

      if (details?.preview) {
        playlistTitle = details.preview.title || displayTitle;
        coverUrl = details.preview.image || "";
      }

      if (Array.isArray(rawTracksList) && rawTracksList.length > 0) {
        console.log(`===> [SONGIFY] spotify-url-info pomyślnie wyciągnęło: ${rawTracksList.length} utworów!`);

        allTracks = rawTracksList.map((t: any, idx: number) => {
          const artistName = t.artist || (Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(", ") : "Nieznany wykonawca");
          const trackTitle = t.name || t.title || "Nieznany utwór";
          const trackCover = t.coverArt?.sources?.[0]?.url || t.image || coverUrl || "";
          const durationSec = t.duration ? Math.round(t.duration / 1000) : 0;

          return {
            id: t.id || `sp_${idx}_${rawId}`,
            title: trackTitle,
            artist: artistName,
            albumCover: trackCover,
            duration: durationSec,
            source: playlistTitle,
          };
        });
      }
    } catch (infoErr) {
      console.warn("===> [SONGIFY] Błąd spotify-url-info:", infoErr);
    }

    // KROK 2: Jeśli guest token nie przeszedł lub zwrócił 0 utworów -> Fallback do Embed (100 utworów)
    if (allTracks.length === 0) {
      console.log("===> [SONGIFY] Użycie fallbacku Embed...");
      const spotifyRes = await fetch(
        `https://open.spotify.com/embed/playlist/${spotifyPlaylistId}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
          cache: "no-store",
        }
      );

      if (!spotifyRes.ok) {
        throw new Error(`Spotify embed status: ${spotifyRes.status}`);
      }

      const html = await spotifyRes.text();
      const match = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
      );

      let rawTracks: any[] = [];

      if (match && match[1]) {
        try {
          const jsonData = JSON.parse(match[1]);
          const entity = extractSpotifyEntity(jsonData);

          if (entity) {
            playlistTitle = displayTitle || entity.title || entity.name || "Songify Playlist";
            coverUrl =
              entity.coverArt?.sources?.[0]?.url ||
              entity.visualIdentity?.image?.[0]?.url ||
              entity.images?.[0]?.url ||
              "";

            if (Array.isArray(entity.trackList)) {
              rawTracks = entity.trackList;
            } else if (Array.isArray(entity.tracks?.items)) {
              rawTracks = entity.tracks.items.map((item: any) => item.track || item);
            }
          }
        } catch (err) {
          console.warn("Błąd parsowania embed JSON:", err);
        }
      }

      const CHUNK_SIZE = 15;
      for (let i = 0; i < rawTracks.length; i += CHUNK_SIZE) {
        const chunk = rawTracks.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(
          chunk.map(async (t: any, idx: number) => {
            const globalIdx = i + idx;
            let artistName = "Nieznany wykonawca";
            if (t.subtitle) {
              artistName = t.subtitle;
            } else if (Array.isArray(t.artists)) {
              artistName = t.artists.map((a: any) => a.name).join(", ");
            }

            const songTitle = t.title || t.name || "Nieznany utwór";

            let trackCover =
              t.album?.coverArt?.sources?.[0]?.url ||
              t.coverArt?.sources?.[0]?.url ||
              t.album?.images?.[0]?.url ||
              t.images?.[0]?.url ||
              t.visualIdentity?.image?.[0]?.url ||
              t.albumCover ||
              null;

            if (!trackCover) {
              trackCover = await fetchTrackCoverFallback(songTitle, artistName);
            }

            return {
              id: t.id || `sp_${globalIdx}_${rawId}`,
              title: songTitle,
              artist: artistName,
              albumCover: trackCover || "",
              duration: t.duration ? Math.round(t.duration / 1000) : 0,
              source: playlistTitle,
            };
          })
        );
        allTracks.push(...chunkResults);
      }
    }

    if (!coverUrl && allTracks[0]?.albumCover) {
      coverUrl = allTracks[0].albumCover;
    }

    if (coversOnly) {
      return NextResponse.json({ id: rawId, cover: coverUrl, title: playlistTitle });
    }

    console.log(`===> [SONGIFY] Finalna liczba utworów gotowa do importu: ${allTracks.length}`);

    const fullResponse = {
      id: rawId,
      title: playlistTitle,
      cover: coverUrl,
      tracks: allTracks,
    };

    memoryCache.set(rawId, {
      data: fullResponse,
      expiresAt: now + CACHE_TTL_MS,
    });

    return NextResponse.json(fullResponse);
  } catch (err) {
    console.error("Błąd pobierania playlisty:", err);
    return NextResponse.json(
      { error: "Nie udało się załadować playlisty" },
      { status: 500 }
    );
  }
}