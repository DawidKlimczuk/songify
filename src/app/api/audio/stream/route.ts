import { NextRequest, NextResponse } from "next/server";
import { Innertube, UniversalCache } from "youtubei.js";
import { createClient } from "@/lib/supabase/server";

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

// Funkcja czyszcząca query, aby zapytania o ten sam utwór miały identyczny klucz
function normalizeQuery(rawQuery: string): string {
  return rawQuery
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // usuwa myślniki, cudzysłowy itp.
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Brak zapytania" }, { status: 400 });
  }

  const normalizedKey = normalizeQuery(query);

  try {
    const supabase = await createClient();

    // 1. Sprawdzamy cache w bazie Supabase
    const { data: cached } = await supabase
      .from("youtube_cache")
      .select("video_id")
      .eq("query", normalizedKey)
      .maybeSingle();

    if (cached?.video_id) {
      return NextResponse.json({
        videoId: cached.video_id,
        youtubeUrl: `https://www.youtube.com/watch?v=${cached.video_id}`,
        fromCache: true,
      });
    }

    // 2. Jeśli nie ma w bazie -> pytamy YouTube
    const youtube = await getInnertube();
    const musicSearch = await youtube.music.search(query, { type: "song" });
    let videoId: string | undefined = musicSearch.songs?.contents?.[0]?.id;

    if (!videoId) {
      const videoSearch = await youtube.search(`${query} audio`, { type: "video" });
      videoId = (videoSearch.videos?.[0] as any)?.id;
    }

    if (!videoId) {
      return NextResponse.json({ error: "Nie znaleziono utworu" }, { status: 404 });
    }

    // 3. Zapisujemy wynik do cache w Supabase
    try {
      await supabase
        .from("youtube_cache")
        .upsert({ query: normalizedKey, video_id: videoId }, { onConflict: "query" });
    } catch (err: unknown) {
      console.warn("Błąd zapisu cache w Supabase:", err);
    }

    return NextResponse.json({
      videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      fromCache: false,
    });
  } catch (error) {
    console.error("Błąd wyszukiwania YouTube:", error);
    return NextResponse.json({ error: "Błąd serwera wyszukiwania" }, { status: 500 });
  }
}