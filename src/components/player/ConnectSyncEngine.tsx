"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDeviceStore, DeviceInfo } from "@/lib/store/device-store";
import { usePlayerStore } from "@/lib/store/player-store";

let activeRealtimeChannel: any = null;

export default function ConnectSyncEngine() {
  const supabase = createClient();
  const isIncomingSyncRef = useRef<boolean>(false);
  const isSwitchingDeviceRef = useRef<boolean>(false);
  const lastBroadcastTrackIdRef = useRef<string | null>(null);

  const {
    deviceId,
    deviceName,
    deviceType,
    activeDeviceId,
    volume,
    initDevice,
    setOnlineDevices,
    setActiveDeviceId,
    setVolume,
  } = useDeviceStore();

  const {
    currentTrack,
    isPlaying,
    currentTime,
    queue,
    setCurrentTrack,
    setIsPlaying,
    setCurrentTime,
    seekTo,
  } = usePlayerStore();

  const isHost = !activeDeviceId || activeDeviceId === "" || activeDeviceId === deviceId;

  // 1. Inicjalizacja tożsamości urządzenia
  useEffect(() => {
    initDevice();
  }, [initDevice]);

  // 2. Obsługa połączenia Realtime
  useEffect(() => {
    if (!deviceId) return;

    const channel = supabase.channel("songify_connect_hub", {
      config: {
        presence: { key: deviceId },
        broadcast: { ack: false, self: false },
      },
    });

    activeRealtimeChannel = channel;

    // A. Synchronizacja listy urządzeń i czyszczenie urządzeń-widm
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const devices: DeviceInfo[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          if (presences && presences.length > 0) {
            const p = presences[0];
            devices.push({
              id: p.deviceId || key,
              name: p.deviceName || "Nieznane urządzenie",
              type: p.deviceType || "computer",
              lastSeen: Date.now(),
            });
          }
        });

        setOnlineDevices(devices);

        // Jeśli dotychczasowy host zniknął z sieci (np. zamknięto kartę na PC)
        const currentActive = useDeviceStore.getState().activeDeviceId;
        const hostStillOnline = devices.some((d) => d.id === currentActive);

        if (!hostStillOnline) {
          // Przejmujemy hosta lokalnie, żeby urządzenie nie wisiało w próżni
          setActiveDeviceId(deviceId);
        }
      })
      // B. Ktoś wszedł do aplikacji i pyta o aktualnie odtwarzany utwór
      .on("broadcast", { event: "REQUEST_HOST_STATE" }, ({ payload }) => {
        if (!payload || payload.senderId === deviceId) return;

        // Jeśli to ja jestem grającym hostem, natychmiast wysyłam swój stan
        const currentActiveId = useDeviceStore.getState().activeDeviceId;
        if (currentActiveId === deviceId && currentTrack) {
          activeRealtimeChannel?.send({
            type: "broadcast",
            event: "PROVIDE_HOST_STATE",
            payload: {
              targetId: payload.senderId,
              activeDeviceId: deviceId,
              currentTrack,
              queue,
              isPlaying,
              currentTime: usePlayerStore.getState().currentTime,
            },
          });
        }
      })
      // C. Otrzymaliśmy stan od aktywnego hosta
      .on("broadcast", { event: "PROVIDE_HOST_STATE" }, ({ payload }) => {
        if (!payload || payload.targetId !== deviceId) return;

        isIncomingSyncRef.current = true;
        if (payload.activeDeviceId) {
          setActiveDeviceId(payload.activeDeviceId);
        }
        if (payload.currentTrack) {
          setCurrentTrack(payload.currentTrack, payload.queue || []);
        }
        if (typeof payload.currentTime === "number") {
          setCurrentTime(payload.currentTime);
          seekTo(payload.currentTime);
        }
        if (typeof payload.isPlaying === "boolean") {
          setIsPlaying(payload.isPlaying);
        }

        setTimeout(() => {
          isIncomingSyncRef.current = false;
        }, 500);
      })
      // D. Standardowa synchronizacja zmian w locie
      .on("broadcast", { event: "SYNC_PLAYBACK_STATE" }, ({ payload }) => {
        if (!payload || payload.senderId === deviceId) return;

        isIncomingSyncRef.current = true;

        if (payload.activeDeviceId) {
          setActiveDeviceId(payload.activeDeviceId);
        }

        if (payload.currentTrack) {
          const myCurrentId = usePlayerStore.getState().currentTrack?.id;
          if (myCurrentId !== payload.currentTrack.id) {
            setCurrentTrack(payload.currentTrack, payload.queue || []);
          }
        }

        if (typeof payload.isPlaying === "boolean") {
          setIsPlaying(payload.isPlaying);
        }

        if (typeof payload.currentTime === "number") {
          setCurrentTime(payload.currentTime);
        }

        setTimeout(() => {
          isIncomingSyncRef.current = false;
        }, 200);
      })
      // E. Odbiór dokładnego ticka czasu
      .on("broadcast", { event: "TIME_TICK" }, ({ payload }) => {
        if (!payload || payload.senderId === deviceId) return;
        const activeHost = useDeviceStore.getState().activeDeviceId;
        if (activeHost !== deviceId) {
          if (typeof payload.currentTime === "number") {
            const latency = payload.sentAt ? (Date.now() - payload.sentAt) / 1000 : 0;
            const adjustedTime = payload.currentTime + Math.max(0, Math.min(latency, 1));
            setCurrentTime(adjustedTime);
          }
          if (typeof payload.isPlaying === "boolean") {
            setIsPlaying(payload.isPlaying);
          }
        }
      })
      // F. Bezpośrednie komendy
      .on("broadcast", { event: "CONNECT_COMMAND" }, ({ payload }) => {
        if (!payload) return;

        if (payload.type === "SET_ACTIVE_DEVICE") {
          isIncomingSyncRef.current = true;
          isSwitchingDeviceRef.current = true;
          setActiveDeviceId(payload.targetDeviceId);

          if (typeof payload.currentTime === "number" && payload.currentTime >= 0) {
            setCurrentTime(payload.currentTime);
            seekTo(payload.currentTime);
          }

          setIsPlaying(true);

          setTimeout(() => {
            isIncomingSyncRef.current = false;
            isSwitchingDeviceRef.current = false;
          }, 1200);
        } else if (payload.type === "SET_VOLUME") {
          setVolume(payload.value);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            deviceId,
            deviceName,
            deviceType,
            onlineAt: new Date().toISOString(),
          });

          // Pytamy sieć, czy ktoś inny już gra muzykę
          channel.send({
            type: "broadcast",
            event: "REQUEST_HOST_STATE",
            payload: { senderId: deviceId },
          });
        }
      });

    return () => {
      activeRealtimeChannel = null;
      supabase.removeChannel(channel);
    };
  }, [
    deviceId,
    deviceName,
    deviceType,
    setOnlineDevices,
    setActiveDeviceId,
    setVolume,
    setCurrentTrack,
    setIsPlaying,
    setCurrentTime,
    seekTo,
  ]);

  // 3. Rozgłaszanie zmiany utworu
  useEffect(() => {
    if (!currentTrack || isIncomingSyncRef.current || !activeRealtimeChannel) return;
    if (lastBroadcastTrackIdRef.current === currentTrack.id) return;

    lastBroadcastTrackIdRef.current = currentTrack.id;

    activeRealtimeChannel.send({
      type: "broadcast",
      event: "SYNC_PLAYBACK_STATE",
      payload: {
        senderId: deviceId,
        activeDeviceId: activeDeviceId || deviceId,
        currentTrack,
        queue,
        isPlaying: true,
        currentTime: 0,
      },
    });
  }, [currentTrack?.id, queue, activeDeviceId, deviceId]);

  // 4. Rozgłaszanie pauzy / startu
  useEffect(() => {
    if (isIncomingSyncRef.current || isSwitchingDeviceRef.current || !activeRealtimeChannel || !currentTrack) return;

    activeRealtimeChannel.send({
      type: "broadcast",
      event: "SYNC_PLAYBACK_STATE",
      payload: {
        senderId: deviceId,
        activeDeviceId: activeDeviceId || deviceId,
        currentTrack,
        queue,
        isPlaying,
        currentTime,
      },
    });
  }, [isPlaying]);

  // 5. Host rozsyła precyzyjny tick czasu
  useEffect(() => {
    if (!isHost || !isPlaying || !activeRealtimeChannel || !currentTrack) return;

    const interval = setInterval(() => {
      if (activeRealtimeChannel && !isIncomingSyncRef.current) {
        const exactTime = usePlayerStore.getState().currentTime;
        activeRealtimeChannel.send({
          type: "broadcast",
          event: "TIME_TICK",
          payload: {
            senderId: deviceId,
            currentTime: exactTime,
            isPlaying: true,
            sentAt: Date.now(),
          },
        });
      }
    }, 350);

    return () => clearInterval(interval);
  }, [isHost, isPlaying, deviceId, currentTrack]);

  return null;
}

export async function sendConnectCommand(command: {
  type: string;
  [key: string]: any;
}) {
  if (activeRealtimeChannel) {
    await activeRealtimeChannel.send({
      type: "broadcast",
      event: "CONNECT_COMMAND",
      payload: command,
    });
  }
}