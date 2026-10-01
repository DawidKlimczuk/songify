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
  volume: number;
  deviceVolumes: Record<string, number>;
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
  
  let localId = localStorage.getItem("songify_persistent_device_id");
  if (!localId) {
    const prefix = /mobile|android|iphone/i.test(navigator.userAgent) ? "mob_" : "pc_";
    localId = prefix + Math.random().toString(36).substring(2, 7) + "_" + Date.now().toString(36).slice(-4);
    localStorage.setItem("songify_persistent_device_id", localId);
  }
  return localId;
}

export function getLocalHardwareVolume(): number {
  if (typeof window === "undefined") return 50;
  const saved = localStorage.getItem("songify_hardware_volume");
  if (saved !== null) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
  }
  return 50;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      deviceId: "",
      deviceName: "Moje urządzenie",
      deviceType: "computer",
      activeDeviceId: "",
      onlineDevices: [],
      volume: 50,
      deviceVolumes: {},
      isDevicePickerOpen: false,

      setDevicePickerOpen: (open) => set({ isDevicePickerOpen: open }),
      
      setActiveDeviceId: (id) => {
        const { deviceVolumes, deviceId } = get();
        const myHardVol = getLocalHardwareVolume();

        // Jeśli przełączamy na samego siebie – bierzemy twardy hardware volume
        if (!id || id === deviceId) {
          set({ activeDeviceId: id, volume: myHardVol });
          return;
        }

        // Jeśli przełączamy na zdalne urządzenie – bierzemy jego zapamiętany stan lub obecny
        const remoteVol = deviceVolumes[id] ?? get().volume;
        set({ activeDeviceId: id, volume: remoteVol });
      },

      setOnlineDevices: (devices) => set({ onlineDevices: devices }),
      
      setVolume: (newVolume, targetDeviceId) => {
        const { activeDeviceId, deviceId, deviceVolumes } = get();
        const target = targetDeviceId || activeDeviceId || deviceId;

        // Jeśli suwak zmienia głośność tego urządzenia – ZAWSZE zapisujemy w localStorage
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
        const hardVol = getLocalHardwareVolume();
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
      }),
    }
  )
);