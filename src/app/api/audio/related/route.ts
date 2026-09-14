import { NextResponse } from "next/server";

// Rozbija po przecinku, feat, ft, &, x, ale NIE po zwykłych spacjach w nazwie artysty
function getPrimaryArtist(artistStr: string): string {
  if (!artistStr) return "";
  const parts = artistStr.split(/,|\s+feat\.?|\s+ft\.?|\s+&\s+|\s+x\s+/i);
  return parts[0]?.trim() || artistStr.trim();
}

function formatArtists(track: any, fallbackArtist: string): string {
  let names: string[] = [];

  if (track.contributors && Array.isArray(track.contributors) && track.contributors.length > 0) {
    names = track.contributors.map((c: any) => c.name?.trim()).filter(Boolean);
  }

  // Jeśli brak contributors, sprawdzamy czy feat nie jest w tytule
  const featMatch = track.title?.match(/\((?:feat\.|ft\.|featuring)\s*([^)]+)\)/i);
  if (featMatch && featMatch[1]) {
    const extra = featMatch[1]
      .split(/,|&|\+/g)
      .map((s: string) => s.trim())
      .filter(Boolean);
    names.push(...extra);
  }

  if (names.length > 0) {
    return Array.from(new Set(names)).join(", ");
  }

  return track.artist?.name || fallbackArtist;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawArtist = searchParams.get("artist")?.trim() || "";
  const currentTitle = searchParams.get("currentTitle")?.toLowerCase().trim() || "";

  if (!rawArtist) {
    return NextResponse.json({ error: "Brak wykonawcy" }, { status: 400 });
  }

  const primaryArtist = getPrimaryArtist(rawArtist);

  try {
    // 1. Szukamy właściwego wykonawcy w bazie Deezer
    const searchArtistRes = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(primaryArtist)}&limit=5`
    );
    const artistData = await searchArtistRes.json();

    let targetArtist = null;
    if (artistData.data && artistData.data.length > 0) {
      targetArtist =
        artistData.data.find(
          (a: any) => a.name.toLowerCase().trim() === primaryArtist.toLowerCase()
        ) || artistData.data[0];
    }

    let trackPool: any[] = [];

    // 2. Pobieramy top tracks konkretnego twórcy
    if (targetArtist?.id) {
      const topTracksRes = await fetch(
        `https://api.deezer.com/artist/${targetArtist.id}/top?limit=40`
      );
      const topTracksData = await topTracksRes.json();
      if (topTracksData.data && Array.isArray(topTracksData.data)) {
        trackPool = topTracksData.data;
      }
    }

    // 3. Fallback: precyzyjne wyszukiwanie artist:"..."
    if (trackPool.length === 0) {
      const fallbackRes = await fetch(
        `https://api.deezer.com/search?q=artist:"${encodeURIComponent(primaryArtist)}"&limit=30`
      );
      const fallbackData = await fallbackRes.json();
      if (fallbackData.data && Array.isArray(fallbackData.data)) {
        trackPool = fallbackData.data;
      }
    }

    if (trackPool.length === 0) {
      return NextResponse.json({ track: null });
    }

    // 4. Filtrujemy: odrzucamy obecny utwór ORAZ upewniamy się, że nasz twórca bierze udział w kawałku
    const validTracks = trackPool.filter((t: any) => {
      const title = (t.title || "").toLowerCase().trim();
      const isDifferentTitle = title !== currentTitle && !title.includes(currentTitle);

      const artistName = (t.artist?.name || "").toLowerCase();
      const hasArtistInContributors = t.contributors?.some((c: any) =>
        c.name?.toLowerCase().includes(primaryArtist.toLowerCase())
      );

      const isArtistPresent =
        artistName.includes(primaryArtist.toLowerCase()) || hasArtistInContributors;

      return isDifferentTitle && isArtistPresent;
    });

    const candidates = validTracks.length > 0 ? validTracks : trackPool;
    const selected = candidates[Math.floor(Math.random() * candidates.length)];

    return NextResponse.json({
      track: {
        id: String(selected.id),
        title: selected.title,
        artist: formatArtists(selected, primaryArtist),
        albumCover:
          selected.album?.cover_big ||
          selected.album?.cover_medium ||
          selected.album?.cover ||
          "",
        duration: selected.duration || 0,
        source: `Radio: ${primaryArtist}`,
      },
    });
  } catch (err) {
    console.error("Błąd pobierania pokrewnego utworu:", err);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}