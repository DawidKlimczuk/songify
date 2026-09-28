import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "";
  const artist = searchParams.get("artist") || "";

  if (!title) return NextResponse.json({ cover: "" });

  const cleanedTitle = title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/-.*$/g, "")
    .replace(/feat\..*$/gi, "")
    .replace(/["'„”]/g, "")
    .trim();

  const mainArtist = artist.split(/[,&/]/)[0].trim();
  const query = `${cleanedTitle} ${mainArtist}`.trim();

  // 1. Sprawdzona wyszukiwarka Deezer
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
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
          "";
        if (cover) return NextResponse.json({ cover });
      }
    }
  } catch {}

  // 2. Fallback Apple / iTunes
  try {
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 604800 },
      }
    );
    if (itunesRes.ok) {
      const data = await itunesRes.json();
      const first = data.results?.[0];
      if (first?.artworkUrl100) {
        return NextResponse.json({
          cover: first.artworkUrl100.replace("100x100bb", "600x600bb"),
        });
      }
    }
  } catch {}

  return NextResponse.json({ cover: "" });
}