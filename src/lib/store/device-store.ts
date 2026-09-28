"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";

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
        let currentId = get().deviceId;
        if (!currentId) {
          currentId = "dev_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        }
        const detected = detectDeviceInfo();
        const activeId = get().activeDeviceId || currentId;

        set({
          deviceId: currentId,
          deviceName: detected.name,
          deviceType: detected.type,
          activeDeviceId: activeId,
        });
      },
    }),
    {
      name: "songify_device_state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        deviceId: state.deviceId,
        deviceName: state.deviceName,
        deviceType: state.deviceType,
        activeDeviceId: state.activeDeviceId,
        volume: state.volume,
      }),
    }
  )
);