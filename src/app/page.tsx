import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getOrCreateLikedPlaylist } from "@/app/actions/playlist";
import DashboardView from "./DashboardView";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [dbUser, likedPlaylist] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
    }),
    getOrCreateLikedPlaylist(),
  ]);

  return (
    <DashboardView
      username={dbUser?.username}
      avatarUrl={dbUser?.avatarUrl}
      likedPlaylistId={likedPlaylist.id}
    />
  );
}