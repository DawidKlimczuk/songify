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
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Frazy, które eliminują nagrania koncertowe i bootlegi
const FORBIDDEN_WORDS = [
  "live",
  "koncert",
  "na żywo",
  "concert",
  "tour",
  "fancam",
  "relacja",
  "występ",
  "reakcja",
  "reaction",
];

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
    let videoId: string | undefined;

    // Próba 1: YouTube Music (oficjalne audio)
    try {
      const musicSearch = await youtube.music.search(query, { type: "song" });
      const songs = musicSearch.songs?.contents;
      if (songs && songs.length > 0) {
        // Szukamy pierwszego utworu, który nie ma w tytule "live" itp.
        const cleanSong = songs.find((s: any) => {
          const title = (s.title || "").toLowerCase();
          return !FORBIDDEN_WORDS.some((word) => title.includes(word));
        });
        videoId = cleanSong?.id || songs[0]?.id;
      }
    } catch (e) {
      console.warn("Błąd wyszukiwania YouTube Music, przejście do fallbacku:", e);
    }

    // Próba 2: Główna wyszukiwarka YouTube (inteligentny wybór)
    if (!videoId) {
      const videoSearch = await youtube.search(query, { type: "video" });
      const videos = (videoSearch.videos as any[]) || [];

      if (videos.length > 0) {
        // Filtrujemy filmy bez słów zakazanych
        const cleanVideos = videos.filter((v) => {
          const title = (v.title?.text || v.title || "").toLowerCase();
          return !FORBIDDEN_WORDS.some((word) => title.includes(word));
        });

        const pool = cleanVideos.length > 0 ? cleanVideos : videos;

        // Priorytet 1: Kanał oficjalny (Topic lub pasujący do zapytania artysty)
        const lowerQuery = query.toLowerCase();
        const officialMatch = pool.find((v) => {
          const author = (v.author?.name || "").toLowerCase();
          return author.includes("topic") || lowerQuery.includes(author);
        });

        videoId = officialMatch?.id || pool[0]?.id;
      }
    }

    if (!videoId) {
      return NextResponse.json({ error: "Nie znaleziono utworu" }, { status: 404 });
    }

    // 3. Zapisujemy poprawny wynik do cache w Supabase
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