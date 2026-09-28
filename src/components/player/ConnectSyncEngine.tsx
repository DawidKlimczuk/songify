"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDeviceStore, DeviceInfo } from "@/lib/store/device-store";
import { usePlayerStore } from "@/lib/store/player-store";

let activeRealtimeChannel: any = null;

export default function ConnectSyncEngine() {
  const supabase = createClient();
  const isHandlingRemoteActionRef = useRef<boolean>(false);
  const lastTrackIdSentRef = useRef<string | null>(null);

  const {
    deviceId,
    deviceName,
    deviceType,
    activeDeviceId,
    onlineDevices,
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
    nextTrack,
    previousTrack,
    seekTo,
  } = usePlayerStore();

  const isCurrentHost = !activeDeviceId || activeDeviceId === "" || activeDeviceId === deviceId;

  // 1. Inicjalizacja tożsamości urządzenia
  useEffect(() => {
    initDevice();
  }, [initDevice]);

  // 2. Połączenie Realtime
  useEffect(() => {
    if (!deviceId) return;

    const channel = supabase.channel("songify_connect_hub", {
      config: {
        presence: { key: deviceId },
        broadcast: { ack: false, self: false },
      },
    });

    activeRealtimeChannel = channel;

    // A. Czyszczenie urządzeń offline i przejmowanie roli hosta
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

        // Jeśli wybrany host odpiął się z sieci, przejmij rolę hosta lokalnie
        const currentActive = useDeviceStore.getState().activeDeviceId;
        if (currentActive && !devices.some((d) => d.id === currentActive)) {
          setActiveDeviceId(deviceId);
        }
      })
      // B. Ktoś wszedł i pyta o aktualnie grający utwór
      .on("broadcast", { event: "REQUEST_HOST_STATE" }, ({ payload }) => {
        if (!payload || payload.senderId === deviceId) return;

        const currentActive = useDeviceStore.getState().activeDeviceId;
        const amIHost = !currentActive || currentActive === deviceId;

        if (amIHost && currentTrack) {
          channel.send({
            type: "broadcast",
            event: "PROVIDE_HOST_STATE",
            payload: {
              targetId: payload.senderId,
              activeDeviceId: deviceId,
              currentTrack,
              queue,
              isPlaying,
              currentTime: usePlayerStore.getState().currentTime || 0,
            },
          });
        }
      })
      // C. Otrzymanie pełnego snapshotu od hosta
      .on("broadcast", { event: "PROVIDE_HOST_STATE" }, ({ payload }) => {
        if (!payload || payload.targetId !== deviceId) return;

        isHandlingRemoteActionRef.current = true;

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
          isHandlingRemoteActionRef.current = false;
        }, 500);
      })
      // D. Zdalne komendy użytkownika (Play, Pause, Next, Prev, Seek, zmiana urządzenia)
      .on("broadcast", { event: "CONNECT_COMMAND" }, ({ payload }) => {
        const currentMyId = useDeviceStore.getState().deviceId;
        // TWARDY filtr: ignorujemy własne pakiety oraz pakiety gdy jesteśmy jedynym urządzeniem
        if (!payload || payload.senderId === currentMyId || !currentMyId) return;

        isHandlingRemoteActionRef.current = true;

        switch (payload.type) {
          case "SET_ACTIVE_DEVICE":
            setActiveDeviceId(payload.targetDeviceId);
            if (typeof payload.currentTime === "number") {
              setCurrentTime(payload.currentTime);
              seekTo(payload.currentTime);
            }
            setIsPlaying(true);
            break;

          case "SET_PLAYING":
            setIsPlaying(payload.isPlaying);
            break;

          case "NEXT_TRACK":
            nextTrack();
            break;

          case "PREV_TRACK":
            previousTrack();
          break;

          case "SEEK_TO":
            if (typeof payload.time === "number") {
              seekTo(payload.time);
            }
            break;

          case "SET_TRACK":
            if (payload.track) {
              setCurrentTrack(payload.track, payload.queue || []);
              setIsPlaying(true);
            }
            break;

          case "SET_VOLUME":
            setVolume(payload.value);
            break;
        }

        setTimeout(() => {
          isHandlingRemoteActionRef.current = false;
        }, 300);
      })
      // E. Tylko i wyłącznie precyzyjny postęp suwaka (ZERO zmian isPlaying!)
      .on("broadcast", { event: "TIME_TICK" }, ({ payload }) => {
        if (!payload || payload.senderId === deviceId) return;

        const currentActive = useDeviceStore.getState().activeDeviceId;
        const amIHost = !currentActive || currentActive === deviceId;

        // Czas aktualizują tylko urządzenia, które NIE są hostem
        if (!amIHost && typeof payload.currentTime === "number") {
          const latency = payload.sentAt ? (Date.now() - payload.sentAt) / 1000 : 0;
          const adjustedTime = payload.currentTime + Math.max(0, Math.min(latency, 0.8));
          setCurrentTime(adjustedTime);
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

          // Pytamy sieć o stan
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
    nextTrack,
    previousTrack,
    seekTo,
  ]);

  // 3. Rozgłaszanie zmiany utworu z tego urządzenia (tylko gdy inne urządzenia są w sieci!)
  useEffect(() => {
    if (!currentTrack || isHandlingRemoteActionRef.current || !activeRealtimeChannel) return;
    if (onlineDevices.length <= 1) return; // Jeśli jesteśmy sami, nie rozsyłamy niczego do sieci!
    if (lastTrackIdSentRef.current === currentTrack.id) return;

    lastTrackIdSentRef.current = currentTrack.id;

    activeRealtimeChannel.send({
      type: "broadcast",
      event: "CONNECT_COMMAND",
      payload: {
        senderId: deviceId,
        type: "SET_TRACK",
        track: currentTrack,
        queue,
      },
    });
  }, [currentTrack?.id, queue, deviceId, onlineDevices.length]);

  // 4. Rozgłaszanie kliknięcia Play / Pause przez użytkownika
  useEffect(() => {
    if (isHandlingRemoteActionRef.current || !activeRealtimeChannel || !currentTrack) return;
    if (onlineDevices.length <= 1) return; // Jeśli jesteśmy sami, nie dotykamy sieci!

    activeRealtimeChannel.send({
      type: "broadcast",
      event: "CONNECT_COMMAND",
      payload: {
        senderId: deviceId,
        type: "SET_PLAYING",
        isPlaying,
      },
    });
  }, [isPlaying, deviceId, onlineDevices.length]);

  // 5. Host audio wysyła TICK czasu (bez żadnego wymuszania isPlaying)
  useEffect(() => {
    if (!isCurrentHost || !isPlaying || !activeRealtimeChannel || !currentTrack) return;

    const interval = setInterval(() => {
      if (activeRealtimeChannel && !isHandlingRemoteActionRef.current) {
        const exactTime = usePlayerStore.getState().currentTime;
        activeRealtimeChannel.send({
          type: "broadcast",
          event: "TIME_TICK",
          payload: {
            senderId: deviceId,
            currentTime: exactTime,
            sentAt: Date.now(),
          },
        });
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isCurrentHost, isPlaying, deviceId, currentTrack]);

  return null;
}

export async function sendConnectCommand(command: {
  type: string;
  [key: string]: any;
}) {
  if (activeRealtimeChannel) {
    const devId = useDeviceStore.getState().deviceId;
    await activeRealtimeChannel.send({
      type: "broadcast",
      event: "CONNECT_COMMAND",
      payload: {
        senderId: devId,
        ...command,
      },
    });
  }
}