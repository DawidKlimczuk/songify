"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDeviceStore, DeviceInfo } from "@/lib/store/device-store";
import { usePlayerStore } from "@/lib/store/player-store";

let activeRealtimeChannel: any = null;

export default function ConnectSyncEngine() {
  const supabase = createClient();
  const isIncomingSyncRef = useRef<boolean>(false);
  const lastBroadcastTrackIdRef = useRef<string | null>(null);
  const isSwitchingDeviceRef = useRef<boolean>(false);

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

  // 1. Inicjalizacja urządzenia
  useEffect(() => {
    initDevice();
  }, [initDevice]);

  // 2. Połączenie Realtime Presence + Broadcast
  useEffect(() => {
    if (!deviceId) return;

    const channel = supabase.channel("songify_connect_hub", {
      config: {
        presence: { key: deviceId },
        broadcast: { ack: false, self: false },
      },
    });

    activeRealtimeChannel = channel;

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
      })
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
      .on("broadcast", { event: "TIME_TICK" }, ({ payload }) => {
        if (!payload || payload.senderId === deviceId) return;
        if (!isHost) {
          if (typeof payload.currentTime === "number") {
            const latency = payload.sentAt ? (Date.now() - payload.sentAt) / 1000 : 0;
            const adjustedTime = payload.currentTime + Math.max(0, Math.min(latency, 1));
            setCurrentTime(adjustedTime);
          }
          // Synchronizacja ikony odtwarzania z rzeczywistym stanem hosta
          if (typeof payload.isPlaying === "boolean") {
            setIsPlaying(payload.isPlaying);
          }
        }
      })
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
          
          // Wymuszenie stanu grania na obu urządzeniach
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
    isHost,
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

  // 4. Rozgłaszanie play / pause (z ignorowaniem fałszywych pauz podczas transferu urządzenia)
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

  // 5. Host audio wysyła co 350 ms precyzyjny TICK czasu i stan grania do pilotów
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