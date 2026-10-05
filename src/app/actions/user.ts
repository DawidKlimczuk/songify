"use server";

import { prisma } from "@/lib/prisma";

export async function getUserProfile(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
        playlists: {
          where: {
            is_public: true,
            is_owner_deleted: false,
            name: {
              notIn: ["Polubione utwory", "Liked Songs"],
            },
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
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      playlists: user.playlists.map((p: any) => ({
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