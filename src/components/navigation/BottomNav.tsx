"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  const tabs = [
    { name: "Główna", href: "/", icon: Home },
    { name: "Szukaj", href: "/search", icon: Search },
    { name: "Biblioteka", href: "/library", icon: Library },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-teal-950/50 bg-[#090e11]/90 backdrop-blur-md max-w-md mx-auto">
      <div className="grid h-full grid-cols-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 transition ${
                isActive
                  ? "text-teal-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
              <span className="text-[10px] font-medium tracking-wide">
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}