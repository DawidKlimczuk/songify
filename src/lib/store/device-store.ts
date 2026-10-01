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
  volume: number; // aktualnie wyświetlana głośność (aktywnego głośnika)
  deviceVolumes: Record<string, number>; // mapa { [deviceId]: volume }
  isDevicePickerOpen: boolean;

  setDevicePickerOpen: (open: boolean) => void;
  setActiveDeviceId: (id: string) => void;
  setOnlineDevices: (devices: DeviceInfo[]) => void;
  setVolume: (volume: number, targetDeviceId?: string) => void;
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

function getOrCreateUniqueDeviceId(): string {
  if (typeof window === "undefined") return "";
  
  // Trzymamy ID w localStorage, aby to samo urządzenie nie zmieniało tożsamości po każdym zamknięciu karty
  let localId = localStorage.getItem("songify_persistent_device_id");
  if (!localId) {
    const prefix = /mobile|android|iphone/i.test(navigator.userAgent) ? "mob_" : "pc_";
    localId = prefix + Math.random().toString(36).substring(2, 7) + "_" + Date.now().toString(36).slice(-4);
    localStorage.setItem("songify_persistent_device_id", localId);
  }
  return localId;
}

function getSavedHardwareVolume(): number {
  if (typeof window === "undefined") return 40;
  const saved = localStorage.getItem("songify_hardware_volume");
  if (saved !== null) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
  }
  // Bezpieczna wartość startowa (nie urwie uszu na głośnikach PC)
  return 40;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      deviceId: "",
      deviceName: "Moje urządzenie",
      deviceType: "computer",
      activeDeviceId: "",
      onlineDevices: [],
      volume: 40,
      deviceVolumes: {},
      isDevicePickerOpen: false,

      setDevicePickerOpen: (open) => set({ isDevicePickerOpen: open }),
      
      setActiveDeviceId: (id) => {
        const { deviceVolumes, deviceId, volume } = get();
        // Pobieramy zapamiętaną głośność przełączanego urządzenia
        const targetVol = deviceVolumes[id] ?? (id === deviceId ? volume : 50);
        set({ activeDeviceId: id, volume: targetVol });
      },

      setOnlineDevices: (devices) => set({ onlineDevices: devices }),
      
      setVolume: (newVolume, targetDeviceId) => {
        const { activeDeviceId, deviceId, deviceVolumes } = get();
        const target = targetDeviceId || activeDeviceId || deviceId;

        // Jeśli zmieniamy głośność tego fizycznego urządzenia, zapisujemy ją na twardo
        if (target === deviceId) {
          try {
            localStorage.setItem("songify_hardware_volume", String(newVolume));
          } catch {}
        }

        set({
          volume: newVolume,
          deviceVolumes: {
            ...deviceVolumes,
            [target]: newVolume,
          },
        });
      },

      initDevice: () => {
        const uniqueId = getOrCreateUniqueDeviceId();
        const detected = detectDeviceInfo();
        const hardVol = getSavedHardwareVolume();
        const { deviceVolumes } = get();

        set({
          deviceId: uniqueId,
          deviceName: detected.name,
          deviceType: detected.type,
          volume: hardVol,
          deviceVolumes: {
            ...deviceVolumes,
            [uniqueId]: hardVol,
          },
        });
      },
    }),
    {
      name: "songify_device_state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        deviceVolumes: state.deviceVolumes,
        volume: state.volume,
      }),
    }
  )
);