import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SettingsView from "@/app/settings/SettingsView";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  return (
    <SettingsView
      initialEmail={user.email || dbUser?.email || ""}
      initialAvatarUrl={dbUser?.avatarUrl || null}
      username={dbUser?.username || "Użytkownik"}
    />
  );
}