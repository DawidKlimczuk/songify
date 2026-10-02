import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "";
  const artist = searchParams.get("artist") || "";

  if (!title) return NextResponse.json({ cover: "" });

  // Czyszczenie zbędnych dopisków bez ucinania właściwych słów
  const cleanedTitle = title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/feat\..*$/gi, "")
    .replace(/ft\..*$/gi, "")
    .replace(/["'„”]/g, "")
    .trim();

  const mainArtist = artist.split(/[,;&/]/)[0].replace(/feat\..*$/gi, "").trim();
  const query = `${cleanedTitle} ${mainArtist}`.trim();

  console.log(`[CoverSearch] Szukam dla: "${query}" (tytuł: "${cleanedTitle}", artysta: "${mainArtist}")`);

  // 1. iTunes z polskim rynkiem (country=PL) - najstabilniejsze i bez blokad
  try {
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=PL&media=music&limit=1`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 604800 },
      }
    );
    if (itunesRes.ok) {
      const data = await itunesRes.json();
      const first = data.results?.[0];
      if (first?.artworkUrl100) {
        const cover = first.artworkUrl100.replace("100x100bb", "600x600bb");
        console.log(`[CoverSearch] Znaleziono w iTunes: ${cover}`);
        return NextResponse.json({ cover });
      }
    }
  } catch (e) {
    console.warn("[CoverSearch] Błąd iTunes:", e);
  }

  // 2. Deezer (dokładne zapytanie)
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
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
        if (cover) {
          console.log(`[CoverSearch] Znaleziono w Deezer: ${cover}`);
          return NextResponse.json({ cover });
        }
      }
    }
  } catch (e) {
    console.warn("[CoverSearch] Błąd Deezer:", e);
  }

  // 3. Fallback: Sam Tytuł w iTunes
  try {
    const itunesTitleRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(cleanedTitle)}&country=PL&media=music&limit=1`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        next: { revalidate: 604800 },
      }
    );
    if (itunesTitleRes.ok) {
      const data = await itunesTitleRes.json();
      const first = data.results?.[0];
      if (first?.artworkUrl100) {
        const cover = first.artworkUrl100.replace("100x100bb", "600x600bb");
        console.log(`[CoverSearch] Znaleziono w iTunes (sam tytuł): ${cover}`);
        return NextResponse.json({ cover });
      }
    }
  } catch (e) {
    console.warn("[CoverSearch] Błąd iTunes fallback:", e);
  }

  console.log(`[CoverSearch] Brak okładki dla "${query}"`);
  return NextResponse.json({ cover: "" });
}