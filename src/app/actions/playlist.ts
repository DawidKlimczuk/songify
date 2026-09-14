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
    },
    orderBy: { createdAt: "asc" },
  });

  return playlists.sort((a: any, b: any) => {
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

export async function createPlaylist(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");

  const playlist = await prisma.playlist.create({
    data: {
      name,
      userId: user.id,
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