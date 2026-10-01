"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/lib/store/player-store";
import { useDeviceStore } from "@/lib/store/device-store";
import { broadcastTimeTick } from "./ConnectSyncEngine";

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
  const loadingTrackIdRef = useRef<string | null>(null);
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

    // Zapisujemy ID piosenki, którą WŁAŚNIE zaczynamy ładować
    loadingTrackIdRef.current = currentTrack.id;

    const isDifferentTrack = !isFirstAppLoad && activeTrackIdRef.current !== currentTrack.id;
    activeTrackIdRef.current = currentTrack.id;

    // Jeśli zmieniamy utwór, BEZWZGLĘDNIE i natychmiast uciszamy cokolwiek, co gra lub mogłoby zagrać
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.pauseVideo === "function") {
          playerRef.current.pauseVideo();
        }
        if (typeof playerRef.current.stopVideo === "function") {
          playerRef.current.stopVideo();
        }
      } catch (err) {}
    }
    silentAudioRef.current?.pause();

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

        // Jeśli przechodzimy handoff (urządzenie nie było głośnikiem i ma już odtworzony czas w store), nie zerujemy go!
        const latestTime = usePlayerStore.getState().currentTime || 0;
        const isHandoffTransition = !isAudioHost && latestTime > 0;
        const initialTime = (isDifferentTrack && !isHandoffTransition) ? 0 : Math.max(0, Math.floor(latestTime));

        if (isDifferentTrack && !isHandoffTransition) {
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

                  const latestState = usePlayerStore.getState();
                  const isTrackStillValid = latestState.currentTrack?.id === currentTrack.id;
                  const isLoadingNow = latestState.isLoadingAudio;

                  // Odtwarzamy TYLKO wtedy, gdy ID jest wciąż aktualne I nie trwa ładowanie nowszego utworu
                  if (shouldPlay && amIReallyHost && isTrackStillValid && !isLoadingNow) {
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
                onError: (event: any) => {
                  console.warn("YouTube Player Error:", event?.data);
                  setIsLoadingAudio(false);

                  // Kody 101, 150 (blokada osadzania/wytwórnia) lub 2, 5 (złe parametry/błąd HTML5)
                  // Automatycznie przeskakujemy zepsuty utwór zamiast blokować aplikację
                  if (event?.data === 150 || event?.data === 101 || event?.data === 2 || event?.data === 5) {
                    nextTrack();
                  } else {
                    setIsPlaying(false);
                  }
                },
              },
            });
          } else {
            // Player już istnieje
            const shouldAutoPlay = usePlayerStore.getState().isPlaying;
            const currentActive = useDeviceStore.getState().activeDeviceId;
            const amIReallyHost = currentActive ? currentActive === deviceId : isAudioHost;

            if (shouldAutoPlay && amIReallyHost) {
              playerRef.current.loadVideoById({
                videoId: data.videoId,
                startSeconds: initialTime,
              });
              try {
                playerRef.current.playVideo();
              } catch {}
              silentAudioRef.current?.play().catch(() => {});
              setIsLoadingAudio(false);
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

    const isLoading = usePlayerStore.getState().isLoadingAudio;

    try {
      if (isPlaying && isAudioHost) {
        // Blokujemy wznowienie starego utworu z bufora, jeśli trwa pobieranie nowego!
        if (!isLoading) {
          // Gwarancja: przed wznowieniem dźwięku upewniamy się, że głośność jest poprawna
          if (typeof playerRef.current.setVolume === "function") {
            const curVol = useDeviceStore.getState().volume ?? 100;
            playerRef.current.setVolume(curVol);
          }
          if (typeof playerRef.current.playVideo === "function") {
            playerRef.current.playVideo();
            silentAudioRef.current?.play().catch(() => {});
          }
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
              // Skoro fizycznie gramy dźwięk tutaj, natychmiast wysyłamy ten czas do drugiego urządzenia!
              broadcastTimeTick(cur);
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

      // Sprawdzamy czy to urządzenie fizycznie odtwarza dźwięk
      const currentActive = useDeviceStore.getState().activeDeviceId;
      const amITheHost = currentActive ? currentActive === deviceId : isAudioHost;

      if (timeLeftMs <= 0) {
        clearInterval(interval);

        // Tylko urządzenie fizycznie grające pauzuje odtwarzacz i przywraca głośność bazową
        if (amITheHost) {
          if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
            playerRef.current.pauseVideo();
            try {
              const baseVol = useDeviceStore.getState().volume ?? 100;
              playerRef.current.setVolume(baseVol);
            } catch {}
          }
          silentAudioRef.current?.pause();
          setIsPlaying(false);
        }

        setSleepTimer(null);
        return;
      }

      // Płynny fade-out przez ostatnie 10 sekund - TYLKO na fizycznym głośniku!
      if (amITheHost && timeLeftMs <= 10000 && playerRef.current && typeof playerRef.current.setVolume === "function") {
        const factor = Math.max(0, timeLeftMs / 10000);
        const baseVol = useDeviceStore.getState().volume ?? 100;
        const targetVol = Math.floor(factor * baseVol);
        playerRef.current.setVolume(targetVol);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [sleepTimerEndsAt, sleepTimerMode, isAudioHost, deviceId, setIsPlaying, setSleepTimer]);

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

    // Urządzenie staje się fizycznym głośnikiem
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

        // Jeśli odtwarzacz ma funkcję loadVideoById, to jest to najbardziej niezawodny sposób wznawiania
        if (typeof playerRef.current.seekTo === "function") {
          playerRef.current.seekTo(exactSec, true);
        }
        if (typeof playerRef.current.playVideo === "function") {
          playerRef.current.playVideo();
        }

        // Odpalamy kotwicę audio w tle
        silentAudioRef.current?.play().catch(() => {});
        setIsPlaying(true);
        usePlayerStore.getState().setIsLoadingAudio(false);
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
  }, [activeDeviceId, deviceId, isAudioHost, setIsPlaying]);

  // 9. Płynna zmiana głośności bez wpływu na strumień
  useEffect(() => {
    if (!isAudioHost || !playerRef.current || typeof volume !== "number") return;
    try {
      if (typeof playerRef.current.setVolume === "function") {
        playerRef.current.setVolume(volume);
      }
    } catch (err) {
      console.warn("Błąd ustawiania głośności w YouTube Player:", err);
    }
  }, [volume, isAudioHost]);

  return (
    <div className="fixed -top-96 -left-96 h-1 w-1 opacity-0 pointer-events-none overflow-hidden">
      <div id="songify-hidden-player" />
    </div>
  );
}