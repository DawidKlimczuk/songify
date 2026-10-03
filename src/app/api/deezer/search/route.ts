import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || !q.trim()) {
    return NextResponse.json({ data: [] });
  }

  // Zamieniamy kropki i przecinki na spacje, żeby np. "Mr.Polska" nie zlewało się w jedno słowo
  const cleanQ = q
    .replace(/\./g, " ")
    .replace(/[,;&/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  try {
    // 1. DEEZER
    const deezerRes = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(cleanQ)}&limit=20`,
      { cache: "no-store" }
    );
    const deezerData = await deezerRes.json();

    if (deezerData && Array.isArray(deezerData.data) && deezerData.data.length > 0) {
      const enrichedTracks = await Promise.all(
        deezerData.data.map(async (track: any) => {
          try {
            const detailRes = await fetch(
              `https://api.deezer.com/track/${track.id}`,
              { next: { revalidate: 3600 } }
            );
            const detailData = await detailRes.json();

            let artistNames: string[] = [];
            if (
              detailData.contributors &&
              Array.isArray(detailData.contributors) &&
              detailData.contributors.length > 0
            ) {
              artistNames = detailData.contributors
                .map((c: any) => c.name?.trim())
                .filter(Boolean);
            }

            let cleanedTitle = track.title;
            const featMatch = track.title.match(
              /\((?:feat\.\vert{}ft\.\vert{}featuring)\s*([^)]+)\)/i
            );
            if (featMatch && featMatch[1]) {
              const extraArtists = featMatch[1]
                .split(/,|&|\+/g)
                .map((s: string) => s.trim())
                .filter(Boolean);
              artistNames.push(...extraArtists);
              cleanedTitle = track.title
                .replace(/\s*\((?:feat\.\vert{}ft\.\vert{}featuring)[^)]*\)/i, "")
                .trim();
            }

            const uniqueArtists = Array.from(
              new Set(
                artistNames.length > 0
                  ? artistNames
                  : [track.artist?.name || "Nieznany wykonawca"]
              )
            );

            return {
              ...track,
              title: cleanedTitle,
              artist: {
                ...track.artist,
                name: uniqueArtists.join(", "),
              },
            };
          } catch {
            return track;
          }
        })
      );

      return NextResponse.json({ data: enrichedTracks });
    }

    // 2. APPLE MUSIC / ITUNES FALLBACK (z country=PL oraz explicit=Yes)
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&country=PL&media=music&entity=song&explicit=Yes&limit=20`;
    const itunesRes = await fetch(itunesUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      cache: "no-store",
    });

    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      if (itunesData.results && itunesData.results.length > 0) {
        const mapped = itunesData.results.map((item: any) => ({
          id: `itunes_${item.trackId}`,
          title: item.trackName,
          duration: Math.round((item.trackTimeMillis || 0) / 1000),
          artist: {
            name: item.artistName,
          },
          album: {
            title: item.collectionName,
            cover: item.artworkUrl100,
            cover_medium: item.artworkUrl100?.replace("100x100bb", "300x300bb"),
            cover_big: item.artworkUrl100?.replace("100x100bb", "600x600bb"),
            cover_xl: item.artworkUrl100?.replace("100x100bb", "1000x1000bb"),
          },
        }));
        return NextResponse.json({ data: mapped });
      }
    }

    return NextResponse.json({ data: [] });
  } catch (err) {
    console.error("Błąd search:", err);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}