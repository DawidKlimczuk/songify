import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "";
  const artist = searchParams.get("artist") || "";
  const album = searchParams.get("album") || "";

  if (!title) return NextResponse.json({ cover: "" });

  const cleanTitle = title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/feat\..*$/gi, "")
    .replace(/ft\..*$/gi, "")
    .replace(/["'„”]/g, "")
    .trim();

  // Tokeny artystów bez kropek
  const artistTokens = `${artist}`
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/[,;&/]/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter((w) => w.length > 2);

  const cleanArtist = artistTokens.join(" ");

  const verifyArtist = (apiArtist: string) => {
    if (!apiArtist || artistTokens.length === 0) return true;
    const lower = apiArtist.toLowerCase().replace(/\./g, " ");
    return artistTokens.some((tok) => lower.includes(tok));
  };

  const matchesTitle = (apiTitle: string) => {
    if (!apiTitle) return false;
    const a = apiTitle.toLowerCase().trim();
    const b = cleanTitle.toLowerCase().trim();
    return a === b || a.includes(b) || b.includes(a);
  };

  // ==========================================
  // KROK 1: DEEZER (Piosenka)
  // ==========================================
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`)}&limit=10`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      const match = data.data?.find(
        (t: any) =>
          (matchesTitle(t.title) || matchesTitle(t.title_short)) &&
          verifyArtist(t.artist?.name)
      );
      if (match?.album?.cover_big || match?.album?.cover_medium) {
        return NextResponse.json({
          cover: match.album.cover_big || match.album.cover_medium,
        });
      }
    }
  } catch {}

  // ==========================================
  // KROK 2: APPLE MUSIC / ITUNES (Piosenka z explicit=Yes)
  // ==========================================
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`)}&country=PL&media=music&entity=song&explicit=Yes&limit=15`;
    const itunesRes = await fetch(itunesUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      cache: "no-store",
    });
    if (itunesRes.ok) {
      const data = await itunesRes.json();
      const match = data.results?.find(
        (r: any) => matchesTitle(r.trackName) && verifyArtist(r.artistName)
      );
      if (match?.artworkUrl100) {
        return NextResponse.json({
          cover: match.artworkUrl100.replace("100x100bb", "600x600bb"),
        });
      }
    }
  } catch {}

  // ==========================================
  // KROK 3: DEEZER (Szukanie całego ALBUMU)
  // ==========================================
  try {
    if (album) {
      const albumRes = await fetch(
        `https://api.deezer.com/search/album?q=${encodeURIComponent(`${album}${cleanArtist}`)}&limit=5`,
        { cache: "no-store" }
      );
      if (albumRes.ok) {
        const aData = await albumRes.json();
        const albMatch = aData.data?.find((a: any) => verifyArtist(a.artist?.name));
        if (albMatch?.cover_big || albMatch?.cover_medium) {
          return NextResponse.json({ cover: albMatch.cover_big || albMatch.cover_medium });
        }
      }
    }
  } catch {}

  // ==========================================
  // KROK 4: APPLE MUSIC / ITUNES (Szukanie ALBUMU)
  // ==========================================
  try {
    const albumQuery = album ? `${album} ${cleanArtist}` : `${cleanTitle} ${cleanArtist}`;
    const itunesAlbumUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(albumQuery)}&country=PL&media=music&entity=album&explicit=Yes&limit=5`;
    const itunesAlbRes = await fetch(itunesAlbumUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      cache: "no-store",
    });

    if (itunesAlbRes.ok) {
      const albData = await itunesAlbRes.json();
      const match = albData.results?.find((a: any) => verifyArtist(a.artistName));
      if (match?.artworkUrl100) {
        return NextResponse.json({
          cover: match.artworkUrl100.replace("100x100bb", "600x600bb"),
        });
      }
    }
  } catch {}

  // ==========================================
  // KROK 5: OSTATNIA DESKA RATUNKU — YOUTUBE (Kwadrat 1:1)
  // ==========================================
  try {
    const ytQuery = `${cleanTitle} ${cleanArtist} official audio topic`.trim();
    const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`;
    
    const ytRes = await fetch(ytSearchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      cache: "no-store",
    });

    if (ytRes.ok) {
      const html = await ytRes.text();

      // 1. Sprawdzamy czy w wynikach jest link do oryginalnej kwadratowej okładki Google/YT Music (lh3.googleusercontent.com)
      const lh3Match = html.match(/https:\/\/lh3\.googleusercontent\.com\/[a-zA-Z0-9_-]+/);
      if (lh3Match && lh3Match[0]) {
        // Parametr =w600-h600-l90-rj wymusza idealny kwadrat w wysokiej rozdzielczości
        const squareCover = `${lh3Match[0]}=w600-h600-l90-rj`;
        return NextResponse.json({ cover: squareCover }, { headers: { "Cache-Control": "no-store, max-age=0" } });
      }

      // 2. Jeśli nie ma lh3, bierzemy maxresdefault (pełne 16:9 bez wklejonych czarnych pasów góra/dół)
      const videoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (videoIdMatch && videoIdMatch[1]) {
        const videoId = videoIdMatch[1];
        // maxresdefault nie posiada wprasowanych pasów letterbox jak hqdefault
        const ytCoverUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
        return NextResponse.json({ cover: ytCoverUrl }, { headers: { "Cache-Control": "no-store, max-age=0" } });
      }
    }
  } catch {}

  // ==========================================
  // KROK 6: Jeśli totalnie nic nie ma -> pusta nutka
  // ==========================================
  return NextResponse.json({ cover: "" }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}