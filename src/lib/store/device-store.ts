"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface DeviceInfo {
  id: string;
  name: string;
  type: "computer" | "mobile";
  lastSeen: number;
}

interface DeviceState {
  deviceId: string;
  deviceName: string;
  deviceType: "computer" | "mobile";
  activeDeviceId: string;
  onlineDevices: DeviceInfo[];
  volume: number; // 0 - 100
  isDevicePickerOpen: boolean;

  setDevicePickerOpen: (open: boolean) => void;
  setActiveDeviceId: (id: string) => void;
  setOnlineDevices: (devices: DeviceInfo[]) => void;
  setVolume: (volume: number) => void;
  initDevice: () => void;
}

function detectDeviceInfo(): { name: string; type: "computer" | "mobile" } {
  if (typeof window === "undefined") {
    return { name: "Przeglądarka", type: "computer" };
  }
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|iphone|ipad|ipod|android|blackberry|iemobile|opera mini/i.test(ua);
  
  if (isMobile) {
    if (/iphone|ipad|ipod/i.test(ua)) return { name: "iPhone / iPad", type: "mobile" };
    if (/android/i.test(ua)) return { name: "Telefon z Androidem", type: "mobile" };
    return { name: "Smartfon", type: "mobile" };
  } else {
    if (/windows/i.test(ua)) return { name: "PC (Windows)", type: "computer" };
    if (/macintosh|mac os x/i.test(ua)) return { name: "Mac", type: "computer" };
    if (/linux/i.test(ua)) return { name: "Komputer (Linux)", type: "computer" };
    return { name: "Komputer", type: "computer" };
  }
}

// Funkcja generująca w 100% unikalny ID dla tej konkretnej instancji przeglądarki
function getOrCreateUniqueDeviceId(): string {
  if (typeof window === "undefined") return "";
  
  // Najpierw sprawdzamy sessionStorage – nie podlega synchronizacji chmurowej
  let localId = sessionStorage.getItem("songify_instance_device_id");
  if (!localId) {
    const prefix = /mobile|android|iphone/i.test(navigator.userAgent) ? "mob_" : "pc_";
    localId = prefix + Math.random().toString(36).substring(2, 7) + "_" + Date.now().toString(36).slice(-4);
    sessionStorage.setItem("songify_instance_device_id", localId);
  }
  return localId;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      deviceId: "",
      deviceName: "Moje urządzenie",
      deviceType: "computer",
      activeDeviceId: "",
      onlineDevices: [],
      volume: 100,
      isDevicePickerOpen: false,

      setDevicePickerOpen: (open) => set({ isDevicePickerOpen: open }),
      setActiveDeviceId: (id) => set({ activeDeviceId: id }),
      setOnlineDevices: (devices) => set({ onlineDevices: devices }),
      setVolume: (volume) => set({ volume }),

      initDevice: () => {
        const uniqueId = getOrCreateUniqueDeviceId();
        const detected = detectDeviceInfo();

        set({
          deviceId: uniqueId,
          deviceName: detected.name,
          deviceType: detected.type,
          // activeDeviceId NIE jest wymuszane na dzień dobry, decyduje sieć Realtime
        });
      },
    }),
    {
      name: "songify_device_state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // NIE zapisujemy deviceId w localStorage, aby profil Google nie synchronizował go na drugie urządzenie!
        volume: state.volume,
      }),
    }
  )
);