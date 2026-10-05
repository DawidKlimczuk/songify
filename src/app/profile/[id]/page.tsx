"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Music, Calendar, Disc } from "lucide-react";
import { getUserProfile } from "@/app/actions/user";

function getAvatarBgColor(name: string) {
  const colors = [
    "bg-emerald-600 text-white",
    "bg-indigo-600 text-white",
    "bg-rose-600 text-white",
    "bg-amber-600 text-white",
    "bg-sky-600 text-white",
    "bg-purple-600 text-white",
    "bg-teal-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      getUserProfile(userId)
        .then((data) => setProfile(data))
        .finally(() => setLoading(false));
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-teal-400 [html.light_&]:text-[#db2777] text-xs">
        Ładowanie profilu...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen p-6 text-center text-gray-400 text-xs">
        Nie znaleziono profilu użytkownika.
      </div>
    );
  }

  const joinDate = new Date(profile.createdAt).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  const initial = (profile.username?.trim()?.[0] || "U").toUpperCase();
  const avatarBg = getAvatarBgColor(profile.username || "");

  return (
    <div className="min-h-screen pb-36 pt-4 px-4 text-white">
      {/* Przycisk Wróć */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:text-[#5c0612] transition mb-6 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Wróć</span>
      </button>

      {/* Sekcja Profilu: Duży Awatar + Nick + Data rejestracji */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden border-2 border-teal-500/40 [html.light_&]:border-[#fbcfe8] flex-shrink-0 shadow-xl">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.username}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className={`h-full w-full ${avatarBg} flex items-center justify-center text-2xl sm:text-3xl font-black select-none`}>
              {initial}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-white [html.light_&]:text-[#5c0612] truncate">
            {profile.username}
          </h1>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 [html.light_&]:text-[#9f1239] mt-1 font-medium">
            <Calendar className="h-3.5 w-3.5 opacity-80" />
            <span>W Songify od {joinDate}</span>
          </div>
          <p className="text-[11px] font-semibold text-teal-400 [html.light_&]:text-[#db2777] mt-1">
            {profile.playlists.length} {profile.playlists.length === 1 ? "publiczna playlista" : "publicznych playlist"}
          </p>
        </div>
      </div>

      {/* Tytuł sekcji playlist */}
      <div className="mb-4 flex items-center gap-2 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] pb-2.5">
        <Disc className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
        <h2 className="text-xs font-bold tracking-wider uppercase text-gray-300 [html.light_&]:text-[#701a28]">
          Playlisty użytkownika
        </h2>
      </div>

      {/* GRID PLAYLIST W FORMACIE ZE SCREENA */}
      {profile.playlists.length === 0 ? (
        <div className="py-12 text-center text-xs text-gray-500 [html.light_&]:text-[#9f1239]">
          Ten użytkownik nie posiada jeszcze publicznych playlist.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {profile.playlists.map((playlist: any) => {
            return (
              <Link
                key={playlist.id}
                href={`/library/playlist/${playlist.id}`}
                className="group flex flex-col cursor-pointer transition active:scale-95"
              >
                {/* Okładka / Mozaika 2x2 kwadrat */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-teal-900/40 bg-[#0e1619] shadow-lg [html.light_&]:border-[#fbcfe8] [html.light_&]:bg-[#fff5f7]">
                  {playlist.coverUrl ? (
                    <img
                      src={playlist.coverUrl}
                      alt={playlist.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                    />
                  ) : playlist.previewCovers && playlist.previewCovers.length > 0 ? (
                    <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                      {[0, 1, 2, 3].map((idx) => {
                        const sCover = playlist.previewCovers[idx];
                        return (
                          <div
                            key={idx}
                            className="relative flex h-full w-full items-center justify-center border border-teal-900/20 bg-teal-950/50 [html.light_&]:border-white/30 [html.light_&]:bg-gradient-to-br [html.light_&]:from-[#ff758c] [html.light_&]:to-[#ff7eb3] overflow-hidden"
                          >
                            {sCover ? (
                              <img src={sCover} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Music className="h-3 w-3 text-teal-400/60 [html.light_&]:text-white/95" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Music className="h-8 w-8 text-teal-500/40 [html.light_&]:text-[#be123c]/60" />
                    </div>
                  )}
                </div>

                {/* Teksty pod kafelkiem (dokładnie jak ze screena) */}
                <div className="mt-2 flex flex-col min-w-0">
                  <span className="truncate text-xs font-bold text-white [html.light_&]:text-[#5c0612] group-hover:text-teal-400 [html.light_&]:group-hover:text-[#db2777] transition">
                    {playlist.name}
                  </span>
                  <span className="truncate text-[11px] text-gray-400 [html.light_&]:text-[#9f1239] mt-0.5">
                    Playlista • {profile.username}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}