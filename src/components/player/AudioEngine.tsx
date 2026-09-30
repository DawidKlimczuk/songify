"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/lib/store/player-store";
import { useDeviceStore } from "@/lib/store/device-store";

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

export default function AudioEngine() {
  const playerRef = useRef<any>(null);
  const isReadyRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeTrackIdRef = useRef<string | null>(null);
  const isInitialMountRef = useRef<boolean>(true);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const userInitiatedPlayRef = useRef<boolean>(false);

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    seekTarget,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setIsLoadingAudio,
    setAudioData,
    resetSeek,
    nextTrack,
    previousTrack,
    sleepTimerEndsAt,
    sleepTimerMode,
    setSleepTimer,
  } = usePlayerStore();

  // Sprawdzamy, czy to urządzenie jest wybranym hostem audio
  const { deviceId, activeDeviceId, volume } = useDeviceStore();

  const isAudioHost = activeDeviceId
    ? activeDeviceId === deviceId
    : Boolean(userInitiatedPlayRef.current);

  // 1. Ładowanie YouTube Iframe API oraz kotwicy audio dla grania w tle
  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio(
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
    );
    audio.loop = true;
    silentAudioRef.current = audio;

    if (window.YT && window.YT.Player) return;

    const existingScript = document.getElementById("yt-iframe-script");
    if (!existingScript) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-script";
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // 2. Obsługa MediaSession API
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      if (isReadyRef.current && typeof playerRef.current?.playVideo === "function") {
        playerRef.current.playVideo();
        silentAudioRef.current?.play().catch(() => {});
        setIsPlaying(true);
      }
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      if (isReadyRef.current && typeof playerRef.current?.pauseVideo === "function") {
        playerRef.current.pauseVideo();
        silentAudioRef.current?.pause();
        setIsPlaying(false);
      }
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      previousTrack();
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      nextTrack();
    });

    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        if (playerRef.current && typeof playerRef.current.seekTo === "function") {
          playerRef.current.seekTo(details.seekTime, true);
          setCurrentTime(details.seekTime);
        }
      }
    });
  }, [nextTrack, previousTrack, setIsPlaying, setCurrentTime]);

  // 3. Ładowanie utworu i obsługa startu / wznawiania
  useEffect(() => {
    if (!currentTrack || !currentTrack.artist || !currentTrack.title) return;

    const abortController = new AbortController();
    const isFirstAppLoad = isInitialMountRef.current;
    isInitialMountRef.current = false;

    // Utwór jest zmieniony tylko wtedy, gdy to nie pierwsze wejście i ID się faktycznie różni
    const isDifferentTrack = !isFirstAppLoad && activeTrackIdRef.current !== currentTrack.id;
    activeTrackIdRef.current = currentTrack.id;

    if (isDifferentTrack && isReadyRef.current && playerRef.current) {
      try {
        if (typeof playerRef.current.stopVideo === "function") {
          playerRef.current.stopVideo();
        }
      } catch (err) {
        console.warn("Błąd zatrzymywania poprzedniego utworu:", err);
      }
    }

    setIsLoadingAudio(true);

    const query = `${currentTrack.artist} - ${currentTrack.title}`;

    fetch(`/api/audio/stream?q=${encodeURIComponent(query)}`, {
      signal: abortController.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Błąd pobierania stream ID");
        return res.json();
      })
      .then((data) => {
        if (abortController.signal.aborted || !data?.videoId) return;

        setAudioData(data.youtubeUrl);

        // Nowa piosenka ZAWSZE startuje od 0:00!
        const initialTime = isDifferentTrack ? 0 : Math.max(0, Math.floor(currentTime || 0));
        if (isDifferentTrack) {
          setCurrentTime(0);
        }

        const launchPlayer = () => {
          if (!playerRef.current) {
            playerRef.current = new window.YT.Player("songify-hidden-player", {
              height: "1",
              width: "1",
              videoId: data.videoId,
              playerVars: {
                autoplay: 0,
                controls: 0,
                disablekb: 1,
                fs: 0,
                playsinline: 1,
                start: initialTime,
              },
              events: {
                onReady: (event: any) => {
                  isReadyRef.current = true;
                  setIsLoadingAudio(false);

                  try {
                    event.target.setVolume(volume);
                  } catch {}

                  if (initialTime > 0) {
                    event.target.seekTo(initialTime, true);
                  }

                  const shouldPlay = usePlayerStore.getState().isPlaying;
                  const currentActive = useDeviceStore.getState().activeDeviceId;
                  const amIReallyHost = currentActive ? currentActive === deviceId : isAudioHost;

                  // ZAWSZE ustawiamy realną głośność ze store'a, żeby odtwarzacz nie był wyciszony do zera!
                  try {
                    const currentVol = useDeviceStore.getState().volume ?? 100;
                    event.target.setVolume(currentVol);
                  } catch {}

                  if (shouldPlay && amIReallyHost) {
                    event.target.playVideo();
                    silentAudioRef.current?.play().catch(() => {});
                  } else {
                    try {
                      event.target.pauseVideo();
                    } catch {}
                  }
                },
                onStateChange: (event: any) => {
                  const currentActive = useDeviceStore.getState().activeDeviceId;
                  const amITheHost = currentActive ? currentActive === deviceId : isAudioHost;
                  if (!amITheHost) return;

                  if (event.data === 1) {
                    setIsPlaying(true);
                    silentAudioRef.current?.play().catch(() => {});
                    setIsLoadingAudio(false);
                    if (typeof playerRef.current?.getDuration === "function") {
                      const ytDur = playerRef.current.getDuration();
                      if (ytDur && ytDur > 0) {
                        setDuration(ytDur);
                      }
                    }
                  } else if (event.data === 0) {
                    const currentMode = usePlayerStore.getState().sleepTimerMode;
                    if (currentMode === "end_of_track") {
                      try {
                        playerRef.current?.stopVideo?.();
                      } catch {}
                      setIsPlaying(false);
                      silentAudioRef.current?.pause();
                      setSleepTimer(null);
                      return;
                    }

                    try {
                      playerRef.current?.stopVideo?.();
                    } catch {}
                    nextTrack();
                  } else if (event.data === 3) {
                    // BUFFERING
                  }
                },
                onError: () => {
                  setIsLoadingAudio(false);
                  setIsPlaying(false);
                },
              },
            });
          } else {
            // Player już istnieje
            if (isPlaying && isAudioHost) {
              playerRef.current.loadVideoById({
                videoId: data.videoId,
                startSeconds: initialTime,
              });
              playerRef.current.playVideo();
              silentAudioRef.current?.play().catch(() => {});
            } else {
              playerRef.current.cueVideoById({
                videoId: data.videoId,
                startSeconds: initialTime,
              });
              setIsLoadingAudio(false);
            }
          }
        };

        if (window.YT && window.YT.Player) {
          launchPlayer();
        } else {
          window.onYouTubeIframeAPIReady = launchPlayer;
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") {
          return; // Ciche ignorowanie przerwanego zapytania
        }
        console.warn("Błąd ładowania streamu:", err.message || err);
        setIsLoadingAudio(false);
      });

    // Przekazanie metadanych utworu do MediaSession (tylko gdy jest prawidłowa okładka)
    if (typeof window !== "undefined" && "mediaSession" in navigator) {
      const artworkList = currentTrack.albumCover
        ? [
            {
              src: currentTrack.albumCover,
              sizes: "512x512",
              type: "image/jpeg",
            },
          ]
        : [];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.source || "Songify",
        artwork: artworkList,
      });
    }

    return () => {
      abortController.abort();
    };
  }, [currentTrack?.id]);

  // 4. Obsługa kliknięcia Play / Pause przez użytkownika
  useEffect(() => {
    if (isPlaying) {
      // Użytkownik kliknął Play na tym urządzeniu
      if (!activeDeviceId) {
        useDeviceStore.getState().setActiveDeviceId(deviceId);
      }
      userInitiatedPlayRef.current = true;
    }

    if (!isReadyRef.current || !playerRef.current) return;

    try {
      if (isPlaying && isAudioHost) {
        // Gwarancja: przed wznowieniem dźwięku upewniamy się, że głośność jest poprawna
        if (typeof playerRef.current.setVolume === "function") {
          const curVol = useDeviceStore.getState().volume ?? 100;
          playerRef.current.setVolume(curVol);
        }
        if (typeof playerRef.current.playVideo === "function") {
          playerRef.current.playVideo();
          silentAudioRef.current?.play().catch(() => {});
        }
      } else {
        if (typeof playerRef.current.pauseVideo === "function") {
          playerRef.current.pauseVideo();
          silentAudioRef.current?.pause();
        }
      }
    } catch (err) {
      console.warn("Błąd toggle play/pause:", err);
    }

    if (typeof window !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying, isAudioHost]);

  // 5. Przewijanie (Seek)
  useEffect(() => {
    if (
      seekTarget !== null &&
      playerRef.current &&
      typeof playerRef.current.seekTo === "function"
    ) {
      // Jeśli to urządzenie NIE jest hostem dźwięku, przewijamy cicho bez wznawiania odtwarzacza
      if (!isAudioHost) {
        try {
          playerRef.current.seekTo(seekTarget, false);
          playerRef.current.pauseVideo();
        } catch {}
      } else {
        // Tylko fizyczny host dźwięku wznawia odtwarzanie po przewinięciu
        playerRef.current.seekTo(seekTarget, true);
      }
      resetSeek();
    }
  }, [seekTarget, isAudioHost, resetSeek]);

  // 6. Pętla synchronizacji pozycji i paska postępu
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (isPlaying) {
      timerRef.current = setInterval(() => {
        if (
          isReadyRef.current &&
          playerRef.current &&
          typeof playerRef.current.getCurrentTime === "function"
        ) {
          const isActuallyPlayingHere =
            typeof playerRef.current.getPlayerState === "function"
              ? playerRef.current.getPlayerState() === 1
              : isAudioHost;

          if (isActuallyPlayingHere) {
            const cur = playerRef.current.getCurrentTime();
            if (typeof cur === "number" && !isNaN(cur)) {
              setCurrentTime(cur);
            }

            let currentDuration = duration;
            if (typeof playerRef.current.getDuration === "function") {
              const ytDur = playerRef.current.getDuration();
              if (ytDur && ytDur > 0 && Math.abs(ytDur - duration) > 1) {
                setDuration(ytDur);
                currentDuration = ytDur;
              }
            }

            if (
              typeof window !== "undefined" &&
              "mediaSession" in navigator &&
              "setPositionState" in navigator.mediaSession &&
              !isNaN(currentDuration) &&
              currentDuration > 0 &&
              typeof cur === "number" &&
              !isNaN(cur)
            ) {
              try {
                navigator.mediaSession.setPositionState({
                  duration: currentDuration,
                  playbackRate: 1.0,
                  position: Math.min(cur, currentDuration),
                });
              } catch (e) {}
            }
          }
        }
      }, 250);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isAudioHost, duration, setCurrentTime, setDuration]);

  // 7. Obsługa Sleep Timera (płynny Fade-out i automatyczna pauza)
  useEffect(() => {
    if (!sleepTimerEndsAt || sleepTimerMode !== "time") return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeLeftMs = sleepTimerEndsAt - now;

      if (timeLeftMs <= 0) {
        // Koniec czasu -> Pauza, reset głośności i zerowanie timera
        clearInterval(interval);
        if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
          playerRef.current.pauseVideo();
          try {
            playerRef.current.setVolume(100);
          } catch {}
        }
        silentAudioRef.current?.pause();
        setIsPlaying(false);
        setSleepTimer(null);
        return;
      }

      // Płynny fade-out przez ostatnie 10 sekund
      if (timeLeftMs <= 10000 && playerRef.current && typeof playerRef.current.setVolume === "function") {
        const factor = Math.max(0, timeLeftMs / 10000);
        const targetVol = Math.floor(factor * 100);
        playerRef.current.setVolume(targetVol);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [sleepTimerEndsAt, sleepTimerMode, setIsPlaying, setSleepTimer]);

  // 8. Czysty Handoff bez nakładania się dźwięku i przycinek
  useEffect(() => {
    const currentActive = useDeviceStore.getState().activeDeviceId;
    const amITheHost = currentActive ? currentActive === deviceId : isAudioHost;

    if (!amITheHost) {
      try {
        if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
          playerRef.current.pauseVideo();
        }
        silentAudioRef.current?.pause();
      } catch {}
      return;
    }

    // To urządzenie staje się fizycznym głośnikiem
    userInitiatedPlayRef.current = true;
    const shouldPlay = usePlayerStore.getState().isPlaying;
    if (!shouldPlay) return;

    const exactSec = usePlayerStore.getState().currentTime || 0;
    let hasTriggered = false;

    const startHostPlayback = () => {
      if (!playerRef.current || hasTriggered) return;
      hasTriggered = true;

      try {
        const curVol = useDeviceStore.getState().volume ?? 100;
        if (typeof playerRef.current.setVolume === "function") {
          playerRef.current.setVolume(curVol);
        }

        // Pobieramy ID wideo z odtwarzacza lub streamu
        const playerState = typeof playerRef.current.getPlayerState === "function" 
          ? playerRef.current.getPlayerState() 
          : -1;

        // Jeśli odtwarzacz był w stanie CUED (5) lub niegrającym, wymuszamy odpalenie
        if (playerState === 5 || playerState === -1 || playerState === 2) {
          if (typeof playerRef.current.seekTo === "function") {
            playerRef.current.seekTo(exactSec, true);
          }
          if (typeof playerRef.current.playVideo === "function") {
            playerRef.current.playVideo();
          }
        } else {
          if (exactSec > 0 && typeof playerRef.current.seekTo === "function") {
            playerRef.current.seekTo(exactSec, true);
          }
          if (typeof playerRef.current.playVideo === "function") {
            playerRef.current.playVideo();
          }
        }

        silentAudioRef.current?.play().catch(() => {});
        setIsPlaying(true);
      } catch (err) {
        console.warn("Błąd startu audio po handoffie:", err);
      }
    };

    if (isReadyRef.current && playerRef.current) {
      startHostPlayback();
    } else {
      const checkInterval = setInterval(() => {
        if (isReadyRef.current && playerRef.current) {
          clearInterval(checkInterval);
          startHostPlayback();
        }
      }, 50);
      return () => clearInterval(checkInterval);
    }
  }, [isAudioHost, activeDeviceId, deviceId, currentTrack?.id, setIsPlaying]);

  // 9. Płynna zmiana głośności bez wpływu na strumień
  useEffect(() => {
    if (!isAudioHost || !playerRef.current) return;
    try {
      if (typeof playerRef.current.getVolume === "function") {
        if (playerRef.current.getVolume() !== volume) {
          playerRef.current.setVolume(volume);
        }
      } else if (typeof playerRef.current.setVolume === "function") {
        playerRef.current.setVolume(volume);
      }
    } catch {}
  }, [volume, isAudioHost]);

  return (
    <div className="fixed -top-96 -left-96 h-1 w-1 opacity-0 pointer-events-none overflow-hidden">
      <div id="songify-hidden-player" />
    </div>
  );
}