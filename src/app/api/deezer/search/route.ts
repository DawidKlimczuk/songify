import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || !q.trim()) {
    return NextResponse.json({ data: [] });
  }

  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(q.trim())}&limit=20`
    );
    const data = await res.json();

    if (!data || !Array.isArray(data.data)) {
      return NextResponse.json({ data: [] });
    }

    // Równoległe dociągnięcie szczegółów utworów (dla tablicy contributors)
    const enrichedTracks = await Promise.all(
      data.data.map(async (track: any) => {
        try {
          const detailRes = await fetch(
            `https://api.deezer.com/track/${track.id}`,
            { next: { revalidate: 3600 } } // cache na 1h
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

          // Jeśli w contributors nie było więcej osób, sprawdzamy czy feat nie ukrył się w tytule
          let cleanedTitle = track.title;
          const featMatch = track.title.match(
            /\((?:feat\.|ft\.|featuring)\s*([^)]+)\)/i
          );
          if (featMatch && featMatch[1]) {
            const extraArtists = featMatch[1]
              .split(/,|&|\+/g)
              .map((s: string) => s.trim())
              .filter(Boolean);
            artistNames.push(...extraArtists);
            // Opcjonalnie usuwamy dopisek (feat. ...) z samego tytułu dla czystszego widoku
            cleanedTitle = track.title
              .replace(/\s*\((?:feat\.|ft\.|featuring)[^)]*\)/i, "")
              .trim();
          }

          // Usuwamy duplikaty i łączymy po przecinku
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
          // Fallback, jeśli dociągnięcie detali nie przeszło
          return track;
        }
      })
    );

    return NextResponse.json({ data: enrichedTracks });
  } catch (err) {
    console.error("Błąd API wyszukiwarki Deezer:", err);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}