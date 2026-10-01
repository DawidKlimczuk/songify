"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDeviceStore, DeviceInfo } from "@/lib/store/device-store";
import { usePlayerStore } from "@/lib/store/player-store";

let activeRealtimeChannel: any = null;

export default function ConnectSyncEngine() {
  const supabase = createClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const isHandlingRemoteActionRef = useRef<boolean>(false);
  const isInitialSyncGracePeriodRef = useRef<boolean>(true);
  const isInitialMountRef = useRef<boolean>(true);
  const lastTrackIdSentRef = useRef<string | null>(null);

  const {
    deviceId,
    deviceName,
    deviceType,
    activeDeviceId,
    onlineDevices,
    initDevice,
    setOnlineDevices,
    setActiveDeviceId,
    volume,
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

  // 1. Inicjalizacja tożsamości urządzenia i pobranie usera
  useEffect(() => {
    initDevice();

    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          setCurrentUserId(user.id);
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            setCurrentUserId(session.user.id);
          }
        }
      } catch {}
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, [initDevice, supabase]);

  // 2. Obsługa połączenia Realtime
  useEffect(() => {
    if (!deviceId) return;

    // Bezpieczna nazwa kanału: jeśli user jest zalogowany, dostaje swój prywatny kanał.
    // Jeśli sesja się jeszcze doczytuje, łączy się do kanału wspólnego, dopóki user się nie pojawi.
    const channelName = currentUserId ? `songify_connect_${currentUserId}` : "songify_connect_hub";

    const channel = supabase.channel(channelName, {
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

        const currentActive = useDeviceStore.getState().activeDeviceId;
        if (currentActive && currentActive !== deviceId) {
          const hostStillPresent = devices.some((d) => d.id === currentActive);
          if (!hostStillPresent && devices.length === 1) {
            // Zabezpieczenie: zachowujemy aktualny postęp czasu ze store'a przed przejęciem roli hosta
            const preservedTime = usePlayerStore.getState().currentTime;
            setActiveDeviceId(deviceId);
            useDeviceStore.setState({ activeDeviceId: deviceId });

            if (typeof preservedTime === "number" && preservedTime > 0) {
              usePlayerStore.setState({ currentTime: preservedTime });
            }
          }
        }
      })
      // B. Ktoś pyta o stan hosta
      .on("broadcast", { event: "REQUEST_HOST_STATE" }, ({ payload }) => {
        if (!payload || payload.senderId === deviceId) return;

        const pState = usePlayerStore.getState();

        if (pState.currentTrack && pState.isPlaying) {
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
              volume: useDeviceStore.getState().volume ?? 100,
              repeatMode: pState.repeatMode,
              isShuffle: pState.isShuffle,
              sleepTimerEndsAt: pState.sleepTimerEndsAt,
              sleepTimerMode: pState.sleepTimerMode,
            },
          });
        }
      })
      // C. Otrzymanie snapshotu od aktywnego hosta
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
          const incomingQueue = Array.isArray(payload.queue) && payload.queue.length > 0
            ? payload.queue
            : [{ ...payload.currentTrack, id: String(payload.currentTrack.id) }];

          usePlayerStore.setState({
            currentTrack: { ...payload.currentTrack, id: String(payload.currentTrack.id) },
            queue: incomingQueue,
            isPlaying: shouldPlay,
          });
        }
        if (typeof payload.currentTime === "number") {
          setCurrentTime(payload.currentTime);
          const isMeTheHost = payload.activeDeviceId === deviceId;
          if (!isMeTheHost) {
            usePlayerStore.setState({ currentTime: payload.currentTime });
          }
        }
        if (typeof payload.isPlaying === "boolean") {
          setIsPlaying(payload.isPlaying);
        }
        if (typeof payload.volume === "number" && !isNaN(payload.volume)) {
          setVolume(payload.volume);
        }
        if (payload.repeatMode) {
          usePlayerStore.setState({ repeatMode: payload.repeatMode });
        }
        if (typeof payload.isShuffle === "boolean") {
          usePlayerStore.setState({ isShuffle: payload.isShuffle });
        }
        if (payload.sleepTimerMode !== undefined) {
          usePlayerStore.setState({
            sleepTimerEndsAt: payload.sleepTimerEndsAt || null,
            sleepTimerMode: payload.sleepTimerMode || null,
          });
        }

        usePlayerStore.getState().setIsLoadingAudio(false);

        setTimeout(() => {
          isHandlingRemoteActionRef.current = false;
        }, 500);
      })
      // D. Zdalne komendy
      .on("broadcast", { event: "CONNECT_COMMAND" }, ({ payload }) => {
        const currentMyId = useDeviceStore.getState().deviceId;
        if (!payload || (payload.senderId && payload.senderId === currentMyId)) return;

        console.log("[Songify Connect] Odebrano zdalną komendę:", payload.type, payload);
        isHandlingRemoteActionRef.current = true;

        switch (payload.type) {
          case "SET_ACTIVE_DEVICE":
            setActiveDeviceId(payload.targetDeviceId);
            useDeviceStore.setState({ activeDeviceId: payload.targetDeviceId });

            if (typeof payload.currentTime === "number") {
              setCurrentTime(payload.currentTime);
            }
            
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
              if (useDeviceStore.getState().activeDeviceId === useDeviceStore.getState().deviceId) {
                seekTo(payload.time);
              }
            }
            break;

          case "SET_TRACK":
            if (payload.track) {
              const pStore = usePlayerStore.getState();
              const isDifferentSong = pStore.currentTrack?.id !== payload.track.id;
              
              lastTrackIdSentRef.current = payload.track.id;
              if (payload.activeDeviceId) {
                setActiveDeviceId(payload.activeDeviceId);
              }
              const shouldAutoPlay = typeof payload.isPlaying === "boolean" ? payload.isPlaying : false;
              
              const history = pStore.currentTrack && isDifferentSong ? [...pStore.history, pStore.currentTrack] : pStore.history;
              const incomingQueue = Array.isArray(payload.queue) && payload.queue.length > 0
                ? payload.queue
                : [{ ...payload.track, id: String(payload.track.id) }];

              usePlayerStore.setState({
                currentTrack: { ...payload.track, id: String(payload.track.id) },
                queue: incomingQueue,
                isPlaying: shouldAutoPlay,
                currentTime: isDifferentSong ? 0 : pStore.currentTime,
                duration: payload.track.duration || 0,
                history,
                isLiked: false,
                isLoadingAudio: false,
              });
            }
            break;

          case "SET_VOLUME":
            setVolume(payload.value);
            break;

          case "SET_LIKED":
            if (payload.trackId && usePlayerStore.getState().currentTrack?.id === payload.trackId) {
              usePlayerStore.getState().setIsLiked(payload.isLiked);
            }
            break;

          case "SET_REPEAT":
            if (payload.mode) {
              usePlayerStore.setState({ repeatMode: payload.mode });
            }
            break;

          case "SET_SHUFFLE":
            if (typeof payload.isShuffle === "boolean") {
              usePlayerStore.setState({ isShuffle: payload.isShuffle });
            }
            if (Array.isArray(payload.queue)) {
              usePlayerStore.setState({ queue: payload.queue });
            }
            break;

          case "SYNC_QUEUE":
            if (Array.isArray(payload.queue)) {
              usePlayerStore.setState({
                queue: payload.queue,
                ...(payload.originalQueue ? { originalQueue: payload.originalQueue } : {}),
              });
            }
            break;

          case "SET_SLEEP_TIMER":
            usePlayerStore.setState({
              sleepTimerEndsAt: payload.sleepTimerEndsAt ?? null,
              sleepTimerMode: payload.sleepTimerMode ?? null,
            });
            break;
        }

        setTimeout(() => {
          isHandlingRemoteActionRef.current = false;
        }, 300);
      })
      // E. Odbiór postępu czasu z aktywnego hosta
      .on("broadcast", { event: "TIME_TICK" }, ({ payload }) => {
        const myId = useDeviceStore.getState().deviceId;
        if (!payload || payload.senderId === myId) return;

        if (typeof payload.currentTime === "number" && !isNaN(payload.currentTime)) {
          const latency = payload.sentAt ? (Date.now() - payload.sentAt) / 1000 : 0;
          const adjustedTime = payload.currentTime + Math.max(0, Math.min(latency, 0.4));
          
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
    currentUserId,
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
    supabase,
  ]);

  // 3. Rozgłaszanie zmiany utworu
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

  // 4. Rozgłaszanie kliknięcia Play / Pause
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

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

  // 4b. Rozgłaszanie zmiany głośności
  const lastVolumeRef = useRef<number>(volume);
  useEffect(() => {
    if (isInitialMountRef.current || isHandlingRemoteActionRef.current || !activeRealtimeChannel) return;
    if (onlineDevices.length <= 1) return;
    if (lastVolumeRef.current === volume) return;

    lastVolumeRef.current = volume;

    activeRealtimeChannel.send({
      type: "broadcast",
      event: "CONNECT_COMMAND",
      payload: {
        senderId: deviceId,
        type: "SET_VOLUME",
        value: volume,
      },
    });
  }, [volume, deviceId, onlineDevices.length]);

  // 5. Host rozsyła precyzyjny TICK czasu
  useEffect(() => {
    const interval = setInterval(() => {
      if (!activeRealtimeChannel) return;

      const dState = useDeviceStore.getState();
      const pState = usePlayerStore.getState();

      if (!pState.isPlaying || !pState.currentTrack) return;
      if (dState.onlineDevices.length <= 1) return;

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
  const channel = activeRealtimeChannel;
  const devId = useDeviceStore.getState().deviceId;

  if (!channel) {
    console.warn("[Songify Connect] Brak aktywnego kanału Realtime do wysłania komendy:", command);
    return;
  }

  try {
    await channel.send({
      type: "broadcast",
      event: "CONNECT_COMMAND",
      payload: {
        senderId: devId,
        ...command,
      },
    });
    console.log("[Songify Connect] Wysłano komendę:", command.type, command);
  } catch (err) {
    console.error("[Songify Connect] Błąd wysyłania komendy:", err);
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