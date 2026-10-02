import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function resolveSingleCover(spotifyId: string, title: string, artist: string): Promise<string> {
  // 1. Pierwszy wybór: Oficjalny oEmbed Spotify (oryginalna okładka w jakości HD)
  if (spotifyId && !spotifyId.startsWith("imported_")) {
    try {
      const spRes = await fetch(
        `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${spotifyId}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          next: { revalidate: 604800 },
        }
      );
      if (spRes.ok) {
        const spData = await spRes.json();
        if (spData.thumbnail_url) {
          return spData.thumbnail_url;
        }
      }
    } catch {}
  }

  // 2. Fallback: Deezer / iTunes
  const cleanedTitle = title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/-.*$/g, "")
    .replace(/feat\..*$/gi, "")
    .replace(/["'„”]/g, "")
    .trim();
  const mainArtist = artist.split(/[,;&/]/)[0].trim();
  const query = `${cleanedTitle} ${mainArtist}`.trim();

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
        return first.artworkUrl100.replace("100x100bb", "600x600bb");
      }
    }
  } catch {}

  try {
    const dzRes = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 604800 },
      }
    );
    if (dzRes.ok) {
      const data = await dzRes.json();
      if (data.data?.[0]?.album) {
        return (
          data.data[0].album.cover_big ||
          data.data[0].album.cover_medium ||
          data.data[0].album.cover ||
          ""
        );
      }
    }
  } catch {}

  return "";
}

export async function POST(request: Request) {
  try {
    const { items } = await request.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Ograniczenie wielkości pojedynczego rzutu do 15 utworów
    const limited = items.slice(0, 15);
    const results = await Promise.all(
      limited.map(async (item: any) => {
        const cover = await resolveSingleCover(item.id, item.title, item.artist);
        return {
          id: item.id,
          albumCover: cover,
        };
      })
    );

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}