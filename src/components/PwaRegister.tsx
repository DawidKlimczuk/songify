"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("PWA Service Worker zarejestrowany pomyślnie:", reg.scope);
        })
        .catch((err) => {
          console.error("Błąd rejestracji SW:", err);
        });
    }
  }, []);

  return null;
}