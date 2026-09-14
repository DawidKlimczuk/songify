import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const email = data.user.email!;
      const username =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        email.split("@")[0];

      // Synchronizacja profilu w Prisma
      await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          id: data.user.id,
          email,
          username: `${username}_${data.user.id.slice(0, 4)}`,
          avatarUrl: data.user.user_metadata?.avatar_url || null,
        },
      });

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}