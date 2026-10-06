"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUserProfile() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return null;

    // Pobieramy dane bezpośrednio z bazy przez Prismę (dokładnie jak dla reszty aplikacji)
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
      },
    });

    const username =
      dbUser?.username ||
      authUser.user_metadata?.username ||
      authUser.user_metadata?.full_name ||
      authUser.email?.split("@")[0] ||
      "Uczestnik";

    const avatarUrl =
      dbUser?.avatarUrl ||
      authUser.user_metadata?.avatar_url ||
      null;

    return {
      id: authUser.id,
      username,
      avatarUrl,
    };
  } catch (error) {
    console.error("Błąd pobierania profilu zalogowanego użytkownika:", error);
    return null;
  }
}

export async function getUserProfile(userId: string) {
  try {
    // 1. Pobieramy podstawowe dane użytkownika
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) return null;

    // 2. Pobieramy playlisty: własne ORAZ współtworzone (members)
    const playlists = await prisma.playlist.findMany({
      where: {
        is_public: true,
        is_owner_deleted: false,
        name: {
          notIn: ["Polubione utwory", "Liked Songs"],
        },
        OR: [
          { userId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        songs: {
          take: 4,
          orderBy: { addedAt: "desc" },
          include: {
            song: {
              select: { albumCover: true },
            },
          },
        },
        _count: {
          select: { songs: true },
        },
      },
    });

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      playlists: playlists.map((p: any) => ({
        id: p.id,
        name: p.name,
        coverUrl: p.coverUrl,
        songCount: p._count.songs,
        previewCovers: p.songs
          .map((s: any) => s.song?.albumCover)
          .filter(Boolean),
      })),
    };
  } catch (error) {
    console.error("Błąd pobierania profilu:", error);
    return null;
  }
}