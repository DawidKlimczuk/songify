"use client";

import { useDeviceStore } from "@/lib/store/device-store";
import { usePlayerStore } from "@/lib/store/player-store";
import { sendConnectCommand } from "./ConnectSyncEngine";
import { Monitor, Smartphone, Volume2, X, Check, Laptop } from "lucide-react";

export default function DevicePickerModal() {
  const {
    deviceId,
    activeDeviceId,
    onlineDevices,
    isDevicePickerOpen,
    volume,
    setDevicePickerOpen,
    setActiveDeviceId,
    setVolume,
  } = useDeviceStore();

  if (!isDevicePickerOpen) return null;

  const currentActive = onlineDevices.find((d) => d.id === activeDeviceId);

  const handleSelectDevice = (targetId: string) => {
    const isTargetMe = targetId === deviceId;
    const currentSec = usePlayerStore.getState().currentTime || 0;

    setActiveDeviceId(targetId);
    useDeviceStore.setState({ activeDeviceId: targetId });

    // Jeśli to my przejmujemy dźwięk od innego urządzenia, NIE wysyłamy swojego
    // starego czasu, lecz pozwalamy grającemu urządzeniu podać aktualny stan
    sendConnectCommand({
      type: "SET_ACTIVE_DEVICE",
      targetDeviceId: targetId,
      currentTime: isTargetMe ? null : currentSec,
    });
  };

  const handleVolumeChange = (newVal: number) => {
    setVolume(newVal);
    sendConnectCommand({
      type: "SET_VOLUME",
      value: newVal,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 px-4 pb-6 sm:pb-0 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl border border-teal-900/60 bg-[#0e1619] p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 text-white [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612] [html.light_&]:shadow-2xl [html.light_&]:shadow-[#f472b6]/20">
        {/* Nagłówek */}
        <div className="flex items-center justify-between pb-3 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3]">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-teal-400 [html.light_&]:!text-[#db2777]" />
            <h3 className="text-sm font-bold tracking-tight text-white [html.light_&]:text-[#5c0612]">
              Połącz z urządzeniem
            </h3>
          </div>
          <button
            onClick={() => setDevicePickerOpen(false)}
            className="p-1.5 rounded-full text-gray-400 hover:text-white [html.light_&]:text-[#9f1239] [html.light_&]:hover:bg-[#fce7f3] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Informacja o aktualnym odtwarzaczu */}
        <div className="py-3">
          <p className="text-xs text-gray-400 [html.light_&]:text-[#9f1239]">
            Dźwięk odtwarzany na:{" "}
            <span className="font-bold text-teal-300 [html.light_&]:text-[#db2777]">
              {currentActive ? currentActive.name : "To urządzenie"}
            </span>
          </p>
        </div>

        {/* Lista dostępnych urządzeń */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {onlineDevices.map((dev) => {
            const isSelected = (activeDeviceId || deviceId) === dev.id;
            const isMe = dev.id === deviceId;

            return (
              <div
                key={dev.id}
                onClick={() => handleSelectDevice(dev.id)}
                className={`flex w-full items-center justify-between p-3 rounded-2xl border transition cursor-pointer select-none ${
                  isSelected
                    ? "border-teal-400 bg-teal-950/40 text-teal-300 [html.light_&]:border-[#db2777] [html.light_&]:bg-[#fdf2f8] [html.light_&]:text-[#be123c]"
                    : "border-teal-950/50 bg-[#121c20] text-gray-300 hover:border-teal-800/60 [html.light_&]:border-[#fce7f3] [html.light_&]:bg-[#fff5f7] [html.light_&]:text-[#5c0612] [html.light_&]:hover:border-[#fbcfe8]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-950/60 text-teal-400 border border-teal-900/40 [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#db2777]">
                    {dev.type === "mobile" ? (
                      <Smartphone className="h-5 w-5" />
                    ) : (
                      <Laptop className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold leading-snug">
                      {dev.name} {isMe && "(To urządzenie)"}
                    </span>
                    <span className="text-[10px] text-gray-400 [html.light_&]:text-[#be123c]/80">
                      {isSelected ? "Aktywne połączenie" : "Dostępne w sieci"}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-400 text-black [html.light_&]:bg-[#db2777] [html.light_&]:text-white">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Suwak głośności urządzenia zdalnego */}
        <div className="mt-4 pt-3 border-t border-teal-950/60 [html.light_&]:border-[#fce7f3] space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400 [html.light_&]:text-[#9f1239]">
            <div className="flex items-center gap-1.5">
              <Volume2 className="h-4 w-4" />
              <span>Głośność odtwarzacza</span>
            </div>
            <span className="font-mono font-bold">{volume}%</span>
          </div>

          <div className="relative flex items-center h-4 w-full cursor-pointer">
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-full h-1.5 rounded-full bg-gray-800 accent-teal-400 [html.light_&]:accent-[#db2777] [html.light_&]:bg-pink-100 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}