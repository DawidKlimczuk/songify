"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDeviceStore, DeviceInfo } from "@/lib/store/device-store";
import { usePlayerStore } from "@/lib/store/player-store";

let activeRealtimeChannel: any = null;

export default function ConnectSyncEngine() {
  const supabase = createClient();
  const isHandlingRemoteActionRef = useRef<boolean>(false);
  const isSeekingGuardRef = useRef<boolean>(false);
  const isInitialSyncGracePeriodRef = useRef<boolean>(true);
  const isInitialMountRef = useRef<boolean>(true);
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
    seekTarget,
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
      // B. Ktoś wszedł i pyta o aktualnie odtwarzany utwór
      .on("broadcast", { event: "REQUEST_HOST_STATE" }, ({ payload }) => {
        if (!payload || payload.senderId === deviceId) return;

        const pState = usePlayerStore.getState();
        const dState = useDeviceStore.getState();

        // Jeśli to urządzenie faktycznie gra dźwięk (isPlaying) LUB jest wybranym hostem:
        const amIActuallyPlaying = pState.isPlaying;
        const amIDesignatedHost = dState.activeDeviceId === deviceId;
        const noHostClaimedYet = !dState.activeDeviceId || dState.activeDeviceId === "";

        if (pState.currentTrack && (amIActuallyPlaying || amIDesignatedHost || noHostClaimedYet)) {
          channel.send({
            type: "broadcast",
            event: "PROVIDE_HOST_STATE",
            payload: {
              targetId: payload.senderId,
              activeDeviceId: dState.activeDeviceId || (amIActuallyPlaying ? deviceId : ""),
              currentTrack: pState.currentTrack,
              queue: pState.queue,
              isPlaying: pState.isPlaying,
              currentTime: pState.currentTime || 0,
            },
          });
        }
      })
      // C. Otrzymanie pełnego snapshotu od aktywnego hosta
      .on("broadcast", { event: "PROVIDE_HOST_STATE" }, ({ payload }) => {
        if (!payload || payload.targetId !== deviceId) return;

        isHandlingRemoteActionRef.current = true;
        isInitialSyncGracePeriodRef.current = false;

        if (payload.activeDeviceId) {
          setActiveDeviceId(payload.activeDeviceId);
        }
        if (payload.currentTrack) {
          lastTrackIdSentRef.current = payload.currentTrack.id;
          const shouldPlay = typeof payload.isPlaying === "boolean" ? payload.isPlaying : false;
          setCurrentTrack(payload.currentTrack, payload.queue || [], shouldPlay);
        }
        if (typeof payload.currentTime === "number") {
          setCurrentTime(payload.currentTime);
          seekTo(payload.currentTime);
        }
        if (typeof payload.isPlaying === "boolean") {
          setIsPlaying(payload.isPlaying);
        }

        // Zdalny ekran natychmiast odblokowuje kontrolki playera
        usePlayerStore.getState().setIsLoadingAudio(false);

        setTimeout(() => {
          isHandlingRemoteActionRef.current = false;
        }, 500);
      })
      // D. Zdalne komendy użytkownika
      .on("broadcast", { event: "CONNECT_COMMAND" }, ({ payload }) => {
        const currentMyId = useDeviceStore.getState().deviceId;
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
              isSeekingGuardRef.current = true;
              setCurrentTime(payload.time);
              seekTo(payload.time);
              setTimeout(() => {
                isSeekingGuardRef.current = false;
              }, 1000);
            }
            break;

          case "SET_TRACK":
            if (payload.track) {
              lastTrackIdSentRef.current = payload.track.id;
              const shouldAutoPlay = typeof payload.isPlaying === "boolean" ? payload.isPlaying : false;
              setCurrentTrack(payload.track, payload.queue || [], shouldAutoPlay);
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
      // E. Odbiór dokładnego postępu czasu
      .on("broadcast", { event: "TIME_TICK" }, ({ payload }) => {
        if (!payload || payload.senderId === deviceId || isSeekingGuardRef.current) return;

        const currentActive = useDeviceStore.getState().activeDeviceId;
        const amIHost = !currentActive || currentActive === deviceId;

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

          // Pytamy sieć o stan natychmiast oraz powtarzamy po 400 ms na wypadek bufora
          const askHost = () => {
            channel.send({
              type: "broadcast",
              event: "REQUEST_HOST_STATE",
              payload: { senderId: deviceId },
            });
          };

          askHost();
          const retryAsk = setTimeout(askHost, 500);
          const secondRetry = setTimeout(askHost, 1000);

          setTimeout(() => {
            isInitialSyncGracePeriodRef.current = false;
            clearTimeout(retryAsk);
            clearTimeout(secondRetry);
          }, 2500);
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

  // 3. Rozgłaszanie zmiany utworu (w tym automatycznego przejścia do kolejnego utworu)
  useEffect(() => {
    if (!currentTrack || isHandlingRemoteActionRef.current || isInitialSyncGracePeriodRef.current || !activeRealtimeChannel) return;
    if (onlineDevices.length <= 1) return;
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
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // Blokada: w trakcie startu lub odbierania akcji zdalnej NIE wysyłamy nic
    if (
      isHandlingRemoteActionRef.current ||
      isInitialSyncGracePeriodRef.current ||
      !activeRealtimeChannel ||
      !currentTrack
    ) {
      return;
    }

    if (onlineDevices.length <= 1) return;

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

  // 5. Host rozsyła precyzyjny TICK czasu
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
    }, 350);

    return () => clearInterval(interval);
  }, [isCurrentHost, isPlaying, deviceId, currentTrack]);

  // 6. Rozgłaszanie przewijania piosenki (Seek)
  useEffect(() => {
    if (seekTarget === null || isHandlingRemoteActionRef.current || !activeRealtimeChannel) return;
    if (onlineDevices.length <= 1) return;

    isSeekingGuardRef.current = true;

    activeRealtimeChannel.send({
      type: "broadcast",
      event: "CONNECT_COMMAND",
      payload: {
        senderId: deviceId,
        type: "SEEK_TO",
        time: seekTarget,
      },
    });

    const timeout = setTimeout(() => {
      isSeekingGuardRef.current = false;
    }, 1000);

    return () => clearTimeout(timeout);
  }, [seekTarget, deviceId, onlineDevices.length]);

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