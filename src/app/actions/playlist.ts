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
    where: { userId: user.id },
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

  const existing = await prisma.playlistSong.findUnique({
    where: {
      playlistId_songId: {
        playlistId: likedPlaylist.id,
        songId: songIdStr,
      },
    },
  });

  if (existing) {
    await prisma.playlistSong.delete({
      where: {
        playlistId_songId: {
          playlistId: likedPlaylist.id,
          songId: songIdStr,
        },
      },
    });
    revalidatePath("/library");
    revalidatePath(`/library/playlist/${likedPlaylist.id}`);
    return { liked: false };
  } else {
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

export async function isTrackLiked(trackId: string | number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const likedPlaylist = await prisma.playlist.findFirst({
    where: { userId: user.id, name: LIKED_PLAYLIST_NAME },
  });

  if (!likedPlaylist) return false;

  const count = await prisma.playlistSong.count({
    where: { playlistId: likedPlaylist.id, songId: String(trackId) },
  });

  return count > 0;
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
      coverUrl: coverUrlVal,
      ...({
        description: finalDescription,
        is_public: isPublicVal,
      } as any),
    } as any,
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

  return prisma.playlist.findUnique({
    where: { id: playlistId, userId: user.id },
    include: {
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
}

export async function updatePlaylist(
  playlistId: string,
  data: { name: string; coverUrl?: string | null }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const target = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (target?.name === LIKED_PLAYLIST_NAME) {
    throw new Error("Nie można modyfikować playlisty Polubione utwory");
  }

  const updated = await prisma.playlist.update({
    where: { id: playlistId, userId: user.id },
    data: {
      name: data.name,
      coverUrl: data.coverUrl !== undefined ? data.coverUrl : undefined,
    },
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
  if (target?.name === LIKED_PLAYLIST_NAME) {
    throw new Error("Nie można usunąć playlisty Polubione utwory");
  }

  await prisma.playlist.delete({
    where: { id: playlistId, userId: user.id },
  });

  revalidatePath("/library");
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
      coverUrl: coverUrlVal,
      ...({
        description: finalDescription,
        is_public: isPublicVal,
      } as any),
    } as any,
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