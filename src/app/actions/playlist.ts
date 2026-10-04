"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const LIKED_PLAYLIST_NAME = "Polubione utwory";

export async function getOrCreateLikedPlaylist() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  let liked = await prisma.playlist.findFirst({
    where: {
      userId: user.id,
      name: LIKED_PLAYLIST_NAME,
    },
  });

  if (!liked) {
    liked = await prisma.playlist.create({
      data: {
        name: LIKED_PLAYLIST_NAME,
        userId: user.id,
      },
    });
  }

  return liked;
}

export async function getUserPlaylists() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  await getOrCreateLikedPlaylist();

  const playlists = await prisma.playlist.findMany({
    where: { 
      userId: user.id,
      is_owner_deleted: false,
    },
    include: {
      _count: {
        select: { songs: true },
      },
      songs: {
        orderBy: { addedAt: "desc" },
        take: 4,
        include: {
          song: {
            select: {
              albumCover: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const formattedPlaylists = playlists.map((p: any) => ({
    ...p,
    songs: (p.songs || []).map((ps: any) => ({
      albumCover: ps.song?.albumCover || null,
    })),
  }));

  return formattedPlaylists.sort((a: any, b: any) => {
    if (a.name === LIKED_PLAYLIST_NAME) return -1;
    if (b.name === LIKED_PLAYLIST_NAME) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function toggleLikeTrack(track: {
  id: string | number;
  title: string;
  artist: string;
  albumCover: string;
  duration?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const likedPlaylist = await getOrCreateLikedPlaylist();
  const songIdStr = String(track.id);

  // 1. Sprawdzamy czy piosenka jest w Polubionych po ścisłym ID
  let existing = await prisma.playlistSong.findUnique({
    where: {
      playlistId_songId: {
        playlistId: likedPlaylist.id,
        songId: songIdStr,
      },
    },
  });

  // 2. Jeśli nie ma po ID, sprawdzamy po tytule i artyście (dla zaimportowanych ze Spotify)
  if (!existing && track.title && track.artist) {
    const cleanTitle = track.title
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .trim();
    const cleanArtist = track.artist.split(/[,;&/]/)[0].trim().toLowerCase();

    const likedSongs = await prisma.playlistSong.findMany({
      where: { playlistId: likedPlaylist.id },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            artist: true,
          },
        },
      },
    });

    const match = likedSongs.find((item) => {
      if (!item.song?.title) return false;
      const sTitle = item.song.title
        .toLowerCase()
        .replace(/\(.*?\)/g, "")
        .replace(/\[.*?\]/g, "")
        .trim();
      const sArtist = (item.song.artist || "").split(/[,;&/]/)[0].trim().toLowerCase();

      return (
        (sTitle === cleanTitle || sTitle.includes(cleanTitle) || cleanTitle.includes(sTitle)) &&
        sArtist &&
        cleanArtist &&
        (sArtist.includes(cleanArtist) || cleanArtist.includes(sArtist))
      );
    });

    if (match) {
      existing = match;
    }
  }

  // Jeśli utwór jest już polubiony -> usuwamy powiązanie
  if (existing) {
    await prisma.playlistSong.delete({
      where: {
        playlistId_songId: {
          playlistId: likedPlaylist.id,
          songId: existing.songId,
        },
      },
    });
    revalidatePath("/library");
    revalidatePath(`/library/playlist/${likedPlaylist.id}`);
    return { liked: false };
  } else {
    // Jeśli nie ma -> dodajemy do bazy i przypisujemy do Polubionych
    await prisma.song.upsert({
      where: { id: songIdStr },
      update: {},
      create: {
        id: songIdStr,
        title: track.title,
        artist: track.artist,
        albumCover: track.albumCover || "",
        duration: track.duration ? Math.round(track.duration) : null,
      },
    });

    await prisma.playlistSong.create({
      data: {
        playlistId: likedPlaylist.id,
        songId: songIdStr,
      },
    });

    revalidatePath("/library");
    revalidatePath(`/library/playlist/${likedPlaylist.id}`);
    return { liked: true };
  }
}

export async function isTrackLiked(
  trackId: string | number,
  title?: string,
  artist?: string
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const likedPlaylist = await prisma.playlist.findFirst({
      where: { userId: user.id, name: LIKED_PLAYLIST_NAME },
      select: { id: true },
    });

    if (!likedPlaylist) return false;

    const trackIdStr = String(trackId).replace("spotify:track:", "").trim();

    // 1. Szybkie sprawdzenie bezpośrednio po ID (indeksowane, ~2ms)
    const directMatch = await prisma.playlistSong.findFirst({
      where: {
        playlistId: likedPlaylist.id,
        songId: trackIdStr,
      },
      select: { songId: true },
    });

    if (directMatch) return true;

    // 2. Jeśli nie ma po ID i podano tytuł -> niech PostgreSQL sam dopasuje tytuł bez pobierania 612 rekordów
    if (title) {
      const cleanTitle = title
        .replace(/\(.*?\)/g, "")
        .replace(/\[.*?\]/g, "")
        .replace(/feat\..*$/gi, "")
        .replace(/ft\..*$/gi, "")
        .trim();

      const songMatch = await prisma.playlistSong.findFirst({
        where: {
          playlistId: likedPlaylist.id,
          song: {
            title: {
              contains: cleanTitle,
              mode: "insensitive", // Ignoruje małe/wielkie litery po stronie bazy
            },
          },
        },
        select: { songId: true },
      });

      if (songMatch) return true;
    }

    return false;
  } catch (err) {
    console.error("[isTrackLiked] Błąd:", err);
    return false;
  }
}

export async function createPlaylist(input?: {
  name?: string;
  description?: string;
  coverUrl?: string | null;
  isPublic?: boolean;
} | string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const data = typeof input === "string" ? { name: input } : input || {};

  let finalName = data.name?.trim();

  // Jeśli użytkownik nie wpisał nazwy -> liczymy jego playlisty bez Polubionych
  if (!finalName) {
    const existingCount = await prisma.playlist.count({
      where: {
        userId: user.id,
        name: { not: LIKED_PLAYLIST_NAME },
      },
    });
    finalName = `Moja playlista #${existingCount + 1}`;
  }

  const finalDescription = data.description ? data.description.trim().slice(0, 300) : null;
  const isPublicVal = data.isPublic !== undefined ? Boolean(data.isPublic) : true;
  const coverUrlVal = data.coverUrl || null;

  const playlist = await prisma.playlist.create({
    data: {
      name: finalName,
      userId: user.id,
      originalOwnerId: user.id,
      is_owner_deleted: false,
      coverUrl: coverUrlVal,
      description: finalDescription,
      is_public: isPublicVal,
    },
  });

  revalidatePath("/library");
  return playlist;
}

export async function getPlaylistDetails(playlistId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      songs: {
        include: {
          song: true,
        },
        orderBy: {
          addedAt: "desc",
        },
      },
    },
  });

  if (!playlist) return null;

  const isOwnerDeleted = Boolean(playlist.is_owner_deleted);

  // Zabezpieczenie: playlista prywatna dostępna tylko dla twórcy, jeśli nie została usunięta
  if (!playlist.is_public && (playlist.userId !== user.id || isOwnerDeleted) && playlist.name !== LIKED_PLAYLIST_NAME) {
    throw new Error("Ta playlista jest prywatna.");
  }

  // Właścicielem jest user tylko wtedy, gdy nie oznaczył jej jako usuniętą
  const isOwner = playlist.userId === user.id && !isOwnerDeleted;

  // Możliwość odzyskania praw: user jest pierwotnym twórcą i playlista ma status usuniętej
  const canReclaim = (playlist.originalOwnerId === user.id || playlist.userId === user.id) && isOwnerDeleted;

  // Jeśli twórca usunął playlistę, maskujemy nick na "Użytkownik Songify", zachowując awatar
  const displayUser = {
    ...playlist.user,
    username: isOwnerDeleted ? "Użytkownik Songify" : (playlist.user?.username || "Użytkownik Songify"),
  };

  return {
    ...playlist,
    user: displayUser,
    currentUserId: user.id,
    isOwner,
    canReclaim,
  };
}

export async function updatePlaylist(
  playlistId: string,
  data: {
    name: string;
    description?: string | null;
    coverUrl?: string | null;
    is_public?: boolean;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const target = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!target || target.userId !== user.id) {
    throw new Error("Brak uprawnień do edycji tej playlisty");
  }
  if (target.name === LIKED_PLAYLIST_NAME) {
    throw new Error("Nie można modyfikować playlisty Polubione utwory");
  }

  const updated = await prisma.playlist.update({
    where: { id: playlistId },
    data: {
      name: data.name,
      description: data.description !== undefined ? data.description : undefined,
      coverUrl: data.coverUrl !== undefined ? data.coverUrl : undefined,
      is_public: data.is_public !== undefined ? data.is_public : undefined,
    },
  });

  revalidatePath(`/library/playlist/${playlistId}`);
  revalidatePath("/library");
  return updated;
}

export async function togglePlaylistVisibility(playlistId: string, isPublic: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const target = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!target || target.userId !== user.id) {
    throw new Error("Tylko właściciel może zmieniać widoczność playlisty");
  }

  const updated = await prisma.playlist.update({
    where: { id: playlistId },
    data: { is_public: isPublic },
  });

  revalidatePath(`/library/playlist/${playlistId}`);
  revalidatePath("/library");
  return updated;
}

export async function uploadPlaylistCover(playlistId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Brak pliku");

  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error("Dozwolone są wyłącznie formaty JPG, PNG oraz WEBP");
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_SIZE) {
    throw new Error("Maksymalny rozmiar zdjęcia to 5 MB");
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${user.id}/${playlistId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("covers")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Błąd uploadu okładki:", uploadError);
    throw new Error("Błąd podczas przesyłania zdjęcia do bazy");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("covers").getPublicUrl(filePath);

  const updated = await prisma.playlist.update({
    where: { id: playlistId, userId: user.id },
    data: { coverUrl: publicUrl },
  });

  revalidatePath(`/library/playlist/${playlistId}`);
  revalidatePath("/library");
  return updated;
}

export async function deletePlaylist(playlistId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const target = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!target || target.userId !== user.id) {
    throw new Error("Brak uprawnień do usunięcia tej playlisty");
  }
  if (target.name === LIKED_PLAYLIST_NAME) {
    throw new Error("Nie można usunąć playlisty Polubione utwory");
  }

  // Soft delete: utwory (Song) i okładki zostają nietknięte w bazie.
  // Jeśli playlista była publiczna, pozostaje w wyszukiwarce jako "Użytkownik Songify".
  await prisma.playlist.update({
    where: { id: playlistId },
    data: {
      is_owner_deleted: true,
      originalOwnerId: target.originalOwnerId || user.id,
      is_public: target.is_public ? true : false,
    },
  });

  revalidatePath("/library");
  revalidatePath(`/library/playlist/${playlistId}`);
  return { success: true };
}

export async function addSongToPlaylist(
  playlistId: string,
  track: {
    id: string | number;
    title: string;
    artist: string;
    albumCover: string;
    duration?: number;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const songIdStr = String(track.id);

  await prisma.song.upsert({
    where: { id: songIdStr },
    update: {},
    create: {
      id: songIdStr,
      title: track.title,
      artist: track.artist,
      albumCover: track.albumCover,
      duration: track.duration ? Math.round(track.duration) : null,
    },
  });

  await prisma.playlistSong.upsert({
    where: {
      playlistId_songId: {
        playlistId,
        songId: songIdStr,
      },
    },
    update: {},
    create: {
      playlistId,
      songId: songIdStr,
    },
  });

  revalidatePath(`/library/playlist/${playlistId}`);
  return { success: true };
}

export async function removeSongFromPlaylist(
  playlistId: string,
  songId: string | number
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  await prisma.playlistSong.deleteMany({
    where: {
      playlistId,
      songId: String(songId),
    },
  });

  revalidatePath(`/library/playlist/${playlistId}`);
  return { success: true };
}

export async function bulkLikeTracks(
  tracks: Array<{
    id: string | number;
    title: string;
    artist: string;
    albumCover: string;
    duration?: number;
  }>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const likedPlaylist = await getOrCreateLikedPlaylist();

  // 1. Oczyszczenie ID ze Spotify URI i zamiana średników na przecinki
  const sanitizedTracks = tracks.map((t) => ({
    ...t,
    id: String(t.id).replace("spotify:track:", "").trim(),
    artist: t.artist.replace(/;/g, ", "),
  }));

  // 2. Pobranie istniejących powiązań i odrzucenie duplikatów
  const existingSongs = await prisma.playlistSong.findMany({
    where: { playlistId: likedPlaylist.id },
    select: { songId: true },
  });

  const existingIdsSet = new Set(existingSongs.map((s) => s.songId));
  const tracksToInsert = sanitizedTracks.filter((track) => !existingIdsSet.has(track.id));

  if (tracksToInsert.length === 0) {
    return { success: true, count: 0, message: "Wszystkie utwory były już w Twoich Polubionych!" };
  }

  const baseTimestamp = Date.now();

  // 3. Zapis paczkami po 100 utworów w transakcji bazy (błyskawiczny zapis bez timeoutu)
  const BATCH_SIZE = 100;
  for (let i = 0; i < tracksToInsert.length; i += BATCH_SIZE) {
    const chunk = tracksToInsert.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(
      chunk.flatMap((track, idx) => {
        const globalIdx = i + idx;
        const simulatedAddedAt = new Date(baseTimestamp + (tracksToInsert.length - globalIdx) * 1000);

        return [
          prisma.song.upsert({
            where: { id: track.id },
            update: {},
            create: {
              id: track.id,
              title: track.title,
              artist: track.artist,
              albumCover: track.albumCover || "",
              duration: track.duration ? Math.round(track.duration) : null,
            },
          }),
          prisma.playlistSong.create({
            data: {
              playlistId: likedPlaylist.id,
              songId: track.id,
              addedAt: simulatedAddedAt,
            },
          }),
        ];
      })
    );
  }

  revalidatePath("/library");
  revalidatePath(`/library/playlist/${likedPlaylist.id}`);
  return { success: true, count: tracksToInsert.length };
}

export async function clearLikedTracks() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const likedPlaylist = await getOrCreateLikedPlaylist();

  await prisma.playlistSong.deleteMany({
    where: {
      playlistId: likedPlaylist.id,
    },
  });

  revalidatePath("/library");
  revalidatePath(`/library/playlist/${likedPlaylist.id}`);
  return { success: true };
}

// Akcja dociągająca okładki partiami bezpośrednio z oEmbed Spotify / iTunes
export async function enrichTracksWithCovers(
  tracks: Array<{ id: string; title: string; artist: string }>
) {
  const results = await Promise.all(
    tracks.map(async (item) => {
      // 1. Oficjalny oEmbed Spotify (bez limitów rate-limit dla pojedynczych ID)
      const cleanId = item.id.replace("spotify:track:", "").trim();
      if (cleanId && !cleanId.startsWith("imported_")) {
        try {
          const spRes = await fetch(
            `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${cleanId}`,
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              },
            }
          );
          if (spRes.ok) {
            const spData = await spRes.json();
            if (spData.thumbnail_url) {
              return { id: item.id, albumCover: spData.thumbnail_url };
            }
          }
        } catch {}
      }

      // 2. Fallback iTunes
      try {
        const query = `${item.title} ${item.artist.split(/[,;&/]/)[0]}`.trim();
        const itunesRes = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`,
          {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          }
        );
        if (itunesRes.ok) {
          const data = await itunesRes.json();
          const first = data.results?.[0];
          if (first?.artworkUrl100) {
            return {
              id: item.id,
              albumCover: first.artworkUrl100.replace("100x100bb", "600x600bb"),
            };
          }
        }
      } catch {}

      return { id: item.id, albumCover: "" };
    })
  );

  return results;
}

export async function updateSongCover(songId: string | number, albumCover: string) {
  if (!albumCover || !songId) return { success: false };

  try {
    await prisma.song.update({
      where: { id: String(songId) },
      data: { albumCover },
    });
    revalidatePath("/library");
    return { success: true };
  } catch (error) {
    console.error("Błąd aktualizacji okładki w bazie:", error);
    return { success: false };
  }
}

export async function importPlaylistFromTracks(params: {
  name?: string;
  description?: string;
  coverUrl?: string | null;
  isPublic?: boolean;
  tracks: Array<{
    id: string | number;
    title: string;
    artist: string;
    albumCover: string;
    duration?: number;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  let finalName = params.name?.trim().slice(0, 80);
  if (!finalName) {
    const existingCount = await prisma.playlist.count({
      where: {
        userId: user.id,
        name: { not: LIKED_PLAYLIST_NAME },
      },
    });
    finalName = `Moja playlista #${existingCount + 1}`;
  }

  const finalDescription = params.description ? params.description.trim().slice(0, 300) : null;
  const isPublicVal = params.isPublic !== undefined ? Boolean(params.isPublic) : true;
  const coverUrlVal = params.coverUrl || null;

  // 1. Tworzymy playlistę
  const newPlaylist = await prisma.playlist.create({
    data: {
      name: finalName,
      userId: user.id,
      originalOwnerId: user.id,
      is_owner_deleted: false,
      coverUrl: coverUrlVal,
      description: finalDescription,
      is_public: isPublicVal,
    },
  });

  // 2. Jeśli są utwory, wstawiamy je paczkami po 100
  if (params.tracks && params.tracks.length > 0) {
    const sanitizedTracks = params.tracks.map((t) => ({
      ...t,
      id: String(t.id).replace("spotify:track:", "").trim(),
      artist: t.artist.replace(/;/g, ", "),
    }));

    const baseTimestamp = Date.now();
    const BATCH_SIZE = 100;

    for (let i = 0; i < sanitizedTracks.length; i += BATCH_SIZE) {
      const chunk = sanitizedTracks.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(
        chunk.flatMap((track, idx) => {
          const globalIdx = i + idx;
          const simulatedAddedAt = new Date(baseTimestamp + (sanitizedTracks.length - globalIdx) * 1000);

          return [
            prisma.song.upsert({
              where: { id: track.id },
              update: {},
              create: {
                id: track.id,
                title: track.title,
                artist: track.artist,
                albumCover: track.albumCover || "",
                duration: track.duration ? Math.round(track.duration) : null,
              },
            }),
            prisma.playlistSong.create({
              data: {
                playlistId: newPlaylist.id,
                songId: track.id,
                addedAt: simulatedAddedAt,
              },
            }),
          ];
        })
      );
    }
  }

  revalidatePath("/library");
  return newPlaylist;
}

export async function overrideYouTubeTrack(title: string, artist: string, videoId: string) {
  const supabase = await createClient();

  const normalize = (txt: string) =>
    txt
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  const mainArtist = (artist || "").split(/[,;&/]/)[0].trim();

  // Zapisujemy wszystkie możliwe warianty zapytania z odtwarzacza
  const queriesToSave = Array.from(
    new Set([
      normalize(`${title} ${artist}`),
      normalize(`${title} ${mainArtist}`),
      normalize(title),
      normalize(`${artist} ${title}`),
      normalize(`${mainArtist} ${title}`),
    ])
  ).filter(Boolean);

  const rows = queriesToSave.map((q) => ({
    query: q,
    video_id: videoId,
  }));

  const { error } = await supabase
    .from("youtube_cache")
    .upsert(rows, { onConflict: "query" });

  if (error) {
    console.error("Błąd nadpisywania youtube_cache:", error);
    throw new Error("Nie udało się zapisać linku w bazie.");
  }

  return { success: true };
}

export async function getPlaylistsContainingSong(track: {
  id: string | number;
  title: string;
  artist: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const trackIdStr = String(track.id);
  const cleanTitle = (track.title || "").trim().toLowerCase();
  const cleanArtist = (track.artist || "").split(/[,;&/]/)[0].trim().toLowerCase();

  const userPlaylistSongs = await prisma.playlistSong.findMany({
    where: {
      playlist: {
        userId: user.id,
        name: { not: LIKED_PLAYLIST_NAME },
      },
    },
    select: {
      playlistId: true,
      songId: true,
      song: {
        select: {
          title: true,
          artist: true,
        },
      },
    },
  });

  const matchingPlaylistIds = new Set<string>();

  for (const item of userPlaylistSongs) {
    // 1. Zgodność po ID
    if (String(item.songId) === trackIdStr) {
      matchingPlaylistIds.add(item.playlistId);
      continue;
    }

    // 2. Zgodność po tytule i artyście (dla utworów ze Spotify / wyszukiwarki)
    if (item.song?.title) {
      const sTitle = item.song.title.trim().toLowerCase();
      const sArtist = (item.song.artist || "").split(/[,;&/]/)[0].trim().toLowerCase();

      const sameTitle = sTitle === cleanTitle || sTitle.includes(cleanTitle) || cleanTitle.includes(sTitle);
      const sameArtist = sArtist && cleanArtist && (sArtist.includes(cleanArtist) || cleanArtist.includes(sArtist));

      if (sameTitle && sameArtist) {
        matchingPlaylistIds.add(item.playlistId);
      }
    }
  }

  return Array.from(matchingPlaylistIds);
}

export async function reclaimPlaylist(playlistId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const target = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!target) throw new Error("Playlista nie istnieje");

  // Tylko pierwotny twórca może odzyskać prawa właściciela
  if (target.originalOwnerId !== user.id && target.userId !== user.id) {
    return { reclaimed: false };
  }

  const updated = await prisma.playlist.update({
    where: { id: playlistId },
    data: {
      userId: user.id,
      is_owner_deleted: false,
    },
  });

  revalidatePath("/library");
  revalidatePath(`/library/playlist/${playlistId}`);
  return { reclaimed: true, playlist: updated };
}