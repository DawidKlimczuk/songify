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
      deviceVolumes: {},
      isDevicePickerOpen: false,

      setDevicePickerOpen: (open) => set({ isDevicePickerOpen: open }),
      setActiveDeviceId: (id) => {
        const { deviceVolumes, deviceId, volume } = get();
        // Pobieramy zapamiętaną głośność przełączanego urządzenia lub obecną
        const targetVol = deviceVolumes[id] ?? (id === deviceId ? volume : 100);
        set({ activeDeviceId: id, volume: targetVol });
      },
      setOnlineDevices: (devices) => set({ onlineDevices: devices }),
      
      setVolume: (newVolume, targetDeviceId) => {
        const { activeDeviceId, deviceId, deviceVolumes } = get();
        const target = targetDeviceId || activeDeviceId || deviceId;

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
        const { deviceVolumes } = get();
        const initialVol = deviceVolumes[uniqueId] ?? 100;

        set({
          deviceId: uniqueId,
          deviceName: detected.name,
          deviceType: detected.type,
          volume: initialVol,
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