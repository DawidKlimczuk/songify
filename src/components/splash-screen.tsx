"use client";

import React from "react";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090e11]">
      {/* Ambient background glow */}
      <div className="absolute h-72 w-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-center justify-center">
        {/* Wznoszące się nutki wylatujące z dzioba (pozycja startowa z dzioba: ok. x=85, y=38) */}
        <div className="absolute left-[70px] top-[10px] pointer-events-none select-none">
          {/* Nuta 1: Ćwierćnuta */}
          <span className="absolute animate-note-1 text-teal-300 text-lg opacity-0">
            ♪
          </span>
          {/* Nuta 2: Ósemka */}
          <span className="absolute animate-note-2 text-teal-400 text-2xl opacity-0">
            ♫
          </span>
          {/* Nuta 3: Podwójna nuta */}
          <span className="absolute animate-note-3 text-teal-200 text-base opacity-0">
            ♬
          </span>
        </div>

        {/* Wektorowy ptak z machającym skrzydłem */}
        <svg
          viewBox="0 0 100 100"
          className="h-28 w-28 drop-shadow-[0_0_15px_rgba(20,184,166,0.35)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Ciało ptaka */}
          <path
            d="M20 58 C 22 75, 45 82, 68 70 C 78 64, 85 52, 85 40 C 82 40, 78 43, 74 44 C 82 38, 86 32, 88 28 C 84 31, 79 33, 73 34 C 67 27, 56 26, 48 32 C 43 36, 40 43, 41 49 C 30 49, 23 44, 18 36 C 16 45, 18 53, 20 58 Z"
            fill="#14b8a6"
          />

          {/* Dziób ptaka */}
          <path
            d="M84 41 L95 38 L85 45 Z"
            fill="#2dd4bf"
          />

          {/* Oko */}
          <circle cx="70" cy="38" r="2.5" fill="#090e11" />

          {/* Animowane Skrzydło */}
          <path
            className="animate-wing"
            d="M48 50 C 42 42, 28 44, 25 54 C 23 61, 33 66, 44 57 Z"
            fill="#0d9488"
          />
        </svg>
      </div>
    </div>
  );
}