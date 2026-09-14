import { NextResponse } from "next/server";

const QUERY_MAP: Record<string, string> = {
  "top-polska": "Top Polska",
  "polski-rap": "Polski Rap",
  "hity-pl": "Polska Hity na Czasie",
  "polski-rock": "Polski Rock",
  "top-worldwide": "Top Worldwide",
  "top-usa": "Top USA Today",
  "viral-global": "Viral Hits",
  "todays-hits": "Today's Top Hits",
  "rap-global": "Rap Bangers",
  "club-dance": "Club Dance EDM",
  "rock-classics": "Rock Classics",
  "rnb-soul": "R&B Urban Soul",
  "nocna-trasa": "Night Drive Synthwave",
  "gym-workout": "Hardcore Workout Gym",
  "chill-focus": "Lofi Chill Beats",
  "party-starter": "Party Hits",
};

// Funkcja pomocnicza wyciągająca pełną listę artystów z utworu Deezer
function extractArtists(track: any): string {
  if (Array.isArray(track.contributors) && track.contributors.length > 0) {
    const names = Array.from(
      new Set(
        track.contributors
          .map((c: any) => c.name?.trim())
          .filter(Boolean)
      )
    );
    if (names.length > 0) {
      return names.join(", ");
    }
  }

  return track.artist?.name || "Nieznany wykonawca";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;

  if (!rawId) {
    return NextResponse.json({ error: "Brak ID lub zapytania" }, { status: 400 });
  }

  try {
    let playlistId = rawId;

    // 1. Jeśli przekazano klucz tekstowy (np. "top-polska"), szukamy najlepszej playlisty
    if (isNaN(Number(rawId))) {
      const searchTerm = QUERY_MAP[rawId] || rawId.replace(/-/g, " ");
      const searchRes = await fetch(
        `https://api.deezer.com/search/playlist?q=${encodeURIComponent(searchTerm)}&limit=5`,
        { next: { revalidate: 3600 } }
      );
      const searchData = await searchRes.json();

      if (searchData.data && searchData.data.length > 0) {
        playlistId = String(searchData.data[0].id);
      } else {
        // Fallback: bezpośrednie wyszukanie utworów
        const trackFallbackRes = await fetch(
          `https://api.deezer.com/search?q=${encodeURIComponent(searchTerm)}&limit=30`
        );
        const trackFallbackData = await trackFallbackRes.json();
        
        if (trackFallbackData.data && trackFallbackData.data.length > 0) {
          const formattedTracks = trackFallbackData.data.map((t: any) => ({
            id: String(t.id),
            title: t.title,
            artist: extractArtists(t),
            albumCover: t.album?.cover_big || t.album?.cover_medium || "",
            duration: t.duration || 0,
            source: searchTerm,
          }));

          return NextResponse.json({
            title: searchTerm,
            cover: formattedTracks[0]?.albumCover || "",
            tracks: formattedTracks,
          });
        }
      }
    }

    // 2. Pobieramy zawartość właściwej playlisty
    const res = await fetch(`https://api.deezer.com/playlist/${playlistId}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error("Błąd pobierania playlisty z Deezer");

    const data = await res.json();

    if (!data.tracks || !data.tracks.data || data.tracks.data.length === 0) {
      return NextResponse.json({ tracks: [] });
    }

    const playlistTitle = data.title || "Deezer Playlist";

    const formattedTracks = data.tracks.data.map((t: any) => ({
      id: String(t.id),
      title: t.title,
      artist: extractArtists(t),
      albumCover:
        t.album?.cover_big ||
        t.album?.cover_medium ||
        data.picture_big ||
        data.picture_medium ||
        "",
      duration: t.duration || 0,
      source: playlistTitle,
    }));

    return NextResponse.json({
      id: String(data.id),
      title: playlistTitle,
      cover: data.picture_big || data.picture_medium || "",
      tracks: formattedTracks,
    });
  } catch (err) {
    console.error("Błąd API Deezer Playlist:", err);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}