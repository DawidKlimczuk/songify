import { NextRequest, NextResponse } from "next/server";
import { Innertube, UniversalCache } from "youtubei.js";

let yt: Innertube | null = null;

async function getInnertube() {
  if (!yt) {
    yt = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
    });
  }
  return yt;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Brak zapytania" }, { status: 400 });
  }

  try {
    const youtube = await getInnertube();
    // Szukamy oficjalnego audio w YouTube Music
    const musicSearch = await youtube.music.search(query, { type: "song" });
    let videoId: string | undefined = musicSearch.songs?.contents?.[0]?.id;

    if (!videoId) {
      // Fallback do standardowego YouTube
      const videoSearch = await youtube.search(`${query} audio`, { type: "video" });
      videoId = (videoSearch.videos?.[0] as any)?.id;
    }

    if (!videoId) {
      return NextResponse.json({ error: "Nie znaleziono utworu" }, { status: 404 });
    }

    return NextResponse.json({
      videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    });
  } catch (error) {
    console.error("Błąd wyszukiwania YouTube:", error);
    return NextResponse.json({ error: "Błąd serwera wyszukiwania" }, { status: 500 });
  }
}