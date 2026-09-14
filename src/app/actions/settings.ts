"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateAvatar(avatarDataUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Brak autoryzacji");

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: avatarDataUrl },
  });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateEmail(newEmail: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Brak autoryzacji");

  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) return { error: error.message };

  await prisma.user.update({
    where: { id: user.id },
    data: { email: newEmail },
  });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function updatePassword(oldPassword: string, newPassword: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) throw new Error("Brak autoryzacji");

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: oldPassword,
  });

  if (signInError) {
    return { error: "Aktualne hasło jest niepoprawne." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true };
}