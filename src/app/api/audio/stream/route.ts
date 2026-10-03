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

function normalizeQuery(rawQuery: string): string {
  return rawQuery
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  "reaguje",
  "react",
  "shot",
  "vlog",
  "podcast",
  "wywiad",
  "interview",
];

const VARIANT_WORDS = [
  "remix",
  "speed up",
  "sped up",
  "slowed",
  "nightcore",
  "bass boosted",
  "przyśpieszona",
  "przyspieszona",
  "zwolniona",
  "edit",
  "mashup",
  "cover",
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

    // 2. Szukamy na YouTube
    const youtube = await getInnertube();
    let videoId: string | undefined;

    const wantsVariant = VARIANT_WORDS.some((w) => normalizedKey.includes(w));

    // KROK A: Klasyczne wideo YouTube (dokładnie jak w starym, dobrym pliku)
    try {
      const videoSearch = await youtube.search(query, { type: "video" });
      const videos = (videoSearch.videos as any[]) || [];

      // Filtrujemy niechciane materiały oraz remiksy (jeśli użytkownik sam ich nie szukał)
      const cleanVideos = videos.filter((v) => {
        const title = (v.title?.text || v.title || "").toLowerCase();

        if (FORBIDDEN_WORDS.some((word) => title.includes(word))) {
          return false;
        }

        if (!wantsVariant && VARIANT_WORDS.some((vw) => title.includes(vw))) {
          return false;
        }

        return true;
      });

      // Bierzemy pierwszy czysty film bezpośrednio z rankingu YouTube!
      if (cleanVideos.length > 0) {
        videoId = cleanVideos[0].id;
      }
    } catch (e) {
      console.warn("Błąd wyszukiwania YouTube video:", e);
    }

    // KROK B: Fallback YouTube Music
    if (!videoId) {
      try {
        const musicSearch = await youtube.music.search(query, { type: "song" });
        const songs = musicSearch.songs?.contents;
        if (songs && songs.length > 0) {
          videoId = songs[0]?.id;
        }
      } catch (e) {
        console.warn("Błąd YouTube Music:", e);
      }
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