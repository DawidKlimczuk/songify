"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDeviceStore, DeviceInfo } from "@/lib/store/device-store";
import { usePlayerStore } from "@/lib/store/player-store";

let activeRealtimeChannel: any = null;

export default function ConnectSyncEngine() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
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

  // 2. Obsługa połączenia Realtime (tylko w prywatnym kanale zalogowanego usera)
  useEffect(() => {
    if (!deviceId || !userId) return;

    const channel = supabase.channel(`songify_connect_${userId}`, {
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

        // Przejmujemy hosta tylko wtedy, gdy w sieci realnie nikogo innego już nie ma
        const currentActive = useDeviceStore.getState().activeDeviceId;
        if (currentActive && currentActive !== deviceId) {
          const hostStillPresent = devices.some((d) => d.id === currentActive);
          if (!hostStillPresent && devices.length === 1) {
            setActiveDeviceId(deviceId);
          }
        }
      })
      // B. Ktoś wszedł i pyta o aktualnie odtwarzany utwór
      .on("broadcast", { event: "REQUEST_HOST_STATE" }, ({ payload }) => {
        if (!payload || payload.senderId === deviceId) return;

        const pState = usePlayerStore.getState();
        const dState = useDeviceStore.getState();

        // Jeśli to urządzenie fizycznie gra dźwięk:
        if (pState.currentTrack && pState.isPlaying) {
          // Zawsze potwierdzamy w modalu, że to my jesteśmy wybranym hostem
          setActiveDeviceId(deviceId);

          channel.send({
            type: "broadcast",
            event: "PROVIDE_HOST_STATE",
            payload: {
              targetId: payload.senderId,
              activeDeviceId: deviceId,
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
          // Tylko pilot aktualizuje czas, nie cofamy grającego Iframe
          const isMeTheHost = payload.activeDeviceId === deviceId;
          if (!isMeTheHost) {
            usePlayerStore.setState({ currentTime: payload.currentTime });
          }
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
            useDeviceStore.setState({ activeDeviceId: payload.targetDeviceId });

            if (typeof payload.currentTime === "number") {
              setCurrentTime(payload.currentTime);
            }
            
            // Zachowujemy stan isPlaying z komendy (jeśli była pauza, zostaje pauza)
            const shouldStartPlaying = typeof payload.isPlaying === "boolean" ? payload.isPlaying : false;
            setIsPlaying(shouldStartPlaying);
            usePlayerStore.getState().setIsPlaying(shouldStartPlaying);
            usePlayerStore.getState().setIsLoadingAudio(false);
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
              setCurrentTime(payload.time);
              usePlayerStore.setState({ currentTime: payload.time });
              // Jeśli to my jesteśmy głośnikiem, natychmiast przewijamy odtwarzacz
              if (useDeviceStore.getState().activeDeviceId === useDeviceStore.getState().deviceId) {
                seekTo(payload.time);
              }
            }
            break;

          case "SET_TRACK":
            if (payload.track) {
              lastTrackIdSentRef.current = payload.track.id;
              if (payload.activeDeviceId) {
                setActiveDeviceId(payload.activeDeviceId);
              }
              const shouldAutoPlay = typeof payload.isPlaying === "boolean" ? payload.isPlaying : false;
              setCurrentTrack(payload.track, payload.queue || [], shouldAutoPlay);
              setCurrentTime(0);
              usePlayerStore.getState().setIsLoadingAudio(false);
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
      // E. Odbiór dokładnego postępu czasu z aktywnego hosta
      .on("broadcast", { event: "TIME_TICK" }, ({ payload }) => {
        const myId = useDeviceStore.getState().deviceId;
        if (!payload || payload.senderId === myId) return;

        if (typeof payload.currentTime === "number" && !isNaN(payload.currentTime)) {
          const latency = payload.sentAt ? (Date.now() - payload.sentAt) / 1000 : 0;
          const adjustedTime = payload.currentTime + Math.max(0, Math.min(latency, 0.5));
          
          setCurrentTime(adjustedTime);
          usePlayerStore.setState({ currentTime: adjustedTime });
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
          const retryAsk = setTimeout(askHost, 600);

          setTimeout(() => {
            isInitialSyncGracePeriodRef.current = false;
            clearTimeout(retryAsk);
          }, 1500);
        }
      });

    return () => {
      activeRealtimeChannel = null;
      supabase.removeChannel(channel);
    };
  }, [
    deviceId,
    userId,
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

    const currentHostId = useDeviceStore.getState().activeDeviceId || deviceId;

    activeRealtimeChannel.send({
      type: "broadcast",
      event: "CONNECT_COMMAND",
      payload: {
        senderId: deviceId,
        type: "SET_TRACK",
        track: currentTrack,
        queue,
        isPlaying,
        activeDeviceId: currentHostId,
      },
    });
  }, [currentTrack?.id, queue, deviceId, isPlaying, onlineDevices.length]);

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

  // 5. Host rozsyła precyzyjny TICK czasu do wszystkich podłączonych urządzeń
  useEffect(() => {
    const interval = setInterval(() => {
      if (!activeRealtimeChannel) return;

      const dState = useDeviceStore.getState();
      const pState = usePlayerStore.getState();

      // Jeśli jest tylko 1 urządzenie lub muzyka nie gra, nie zużywamy limitu Realtime
      if (dState.onlineDevices.length <= 1 || !pState.isPlaying || !pState.currentTrack) return;

      const amITheSpeaker = dState.activeDeviceId
        ? dState.activeDeviceId === dState.deviceId
        : true;

      if (amITheSpeaker && typeof pState.currentTime === "number" && !isNaN(pState.currentTime)) {
        activeRealtimeChannel.send({
          type: "broadcast",
          event: "TIME_TICK",
          payload: {
            senderId: dState.deviceId,
            currentTime: pState.currentTime,
            sentAt: Date.now(),
          },
        }).catch?.(() => {});
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deviceId, isPlaying]);

  // 6. Rozgłaszanie przewijania piosenki (Seek)
  useEffect(() => {
    if (seekTarget === null || !activeRealtimeChannel) return;

    const targetTime = seekTarget;

    // Natychmiast synchronizujemy czas lokalny z nową pozycją
    setCurrentTime(targetTime);
    usePlayerStore.setState({ currentTime: targetTime });

    activeRealtimeChannel.send({
      type: "broadcast",
      event: "CONNECT_COMMAND",
      payload: {
        senderId: deviceId,
        type: "SEEK_TO",
        time: targetTime,
      },
    });

    usePlayerStore.getState().resetSeek();
  }, [seekTarget, deviceId, setCurrentTime]);

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

export function broadcastTimeTick(time: number) {
  if (activeRealtimeChannel) {
    const devId = useDeviceStore.getState().deviceId;
    activeRealtimeChannel.send({
      type: "broadcast",
      event: "TIME_TICK",
      payload: {
        senderId: devId,
        currentTime: time,
        sentAt: Date.now(),
      },
    });
  }
}