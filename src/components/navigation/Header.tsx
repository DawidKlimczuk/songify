"use client";

import Link from "next/link";

interface HeaderProps {
  username?: string;
  avatarUrl?: string | null;
}

export default function Header({ username, avatarUrl }: HeaderProps) {
  const initial = username ? username.charAt(0).toUpperCase() : "U";

  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex h-16 items-center justify-between px-4 backdrop-blur-md bg-[#090e11]/80 border-b border-teal-950/40 max-w-md mx-auto">
      <Link
        href="/settings"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-teal-600 to-teal-400 text-black font-bold shadow-md shadow-teal-900/30 transition active:scale-95"
        title="Ustawienia profilu"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username || "Awatar"}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="text-sm font-black">{initial}</span>
        )}
      </Link>

      <div className="flex items-center justify-center">
        <span className="font-[family-name:var(--font-drip)] text-2xl tracking-wider text-teal-400 drop-shadow-[0_2px_12px_rgba(45,212,191,0.55)] select-none">
          SONGIFY
        </span>
      </div>

      <div className="w-10" />
    </header>
  );
}