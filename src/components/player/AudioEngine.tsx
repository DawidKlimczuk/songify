"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/lib/store/player-store";

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
  } = usePlayerStore();

  // 1. Ładowanie YouTube Iframe API
  useEffect(() => {
    if (typeof window === "undefined") return;
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

  // 2. Obsługa MediaSession API (Globalne akcje odtwarzacza dla Android/iOS/Dynamic Island)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      if (isReadyRef.current && typeof playerRef.current?.playVideo === "function") {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      if (isReadyRef.current && typeof playerRef.current?.pauseVideo === "function") {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      }
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      previousTrack();
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      nextTrack();
    });

    // Umożliwia przewijanie utworu z poziomu zablokowanego ekranu / Dynamic Island
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        if (playerRef.current && typeof playerRef.current.seekTo === "function") {
          playerRef.current.seekTo(details.seekTime, true);
          setCurrentTime(details.seekTime);
        }
      }
    });
  }, [nextTrack, previousTrack, setIsPlaying, setCurrentTime]);

  // 3. Ładowanie i strumieniowanie utworu
  useEffect(() => {
    if (!currentTrack || !currentTrack.artist || !currentTrack.title) return;

    const isDifferentTrack = activeTrackIdRef.current !== currentTrack.id;
    activeTrackIdRef.current = currentTrack.id;

    if (isDifferentTrack && isReadyRef.current && playerRef.current) {
      try {
        if (typeof playerRef.current.stopVideo === "function") {
          playerRef.current.stopVideo();
        }
      } catch (err) {
        console.warn("Błąd zatrzymywania starego utworu:", err);
      }
    }

    setIsLoadingAudio(true);
    let isCancelled = false;

    const query = `${currentTrack.artist} - ${currentTrack.title}`;

    fetch(`/api/audio/stream?q=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Błąd pobierania stream ID");
        return res.json();
      })
      .then((data) => {
        if (isCancelled || !data.videoId) return;

        setAudioData(data.youtubeUrl);

        const launchPlayer = () => {
          const initialTime = isDifferentTrack ? 0 : Math.floor(currentTime || 0);

          if (!playerRef.current) {
            playerRef.current = new window.YT.Player("songify-hidden-player", {
              height: "1",
              width: "1",
              videoId: data.videoId,
              playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                playsinline: 1,
                start: initialTime,
              },
              events: {
                onReady: (event: any) => {
                  isReadyRef.current = true;
                  event.target.playVideo();
                  setIsPlaying(true);
                  setIsLoadingAudio(false);
                },
                onStateChange: (event: any) => {
                  if (event.data === 1) {
                    // PLAYING
                    setIsPlaying(true);
                    setIsLoadingAudio(false);
                    if (typeof playerRef.current?.getDuration === "function") {
                      const ytDur = playerRef.current.getDuration();
                      if (ytDur && ytDur > 0) {
                        setDuration(ytDur);
                      }
                    }
                  } else if (event.data === 0) {
                    // ENDED -> autoodtwarzanie
                    try {
                      playerRef.current?.stopVideo?.();
                    } catch {}
                    nextTrack();
                  } else if (event.data === 2) {
                    // PAUSED
                  }
                },
                onError: () => {
                  setIsLoadingAudio(false);
                  setIsPlaying(false);
                },
              },
            });
          } else {
            playerRef.current.loadVideoById({
              videoId: data.videoId,
              startSeconds: initialTime,
            });
            playerRef.current.playVideo();
            setIsPlaying(true);
          }
        };

        if (window.YT && window.YT.Player) {
          launchPlayer();
        } else {
          window.onYouTubeIframeAPIReady = launchPlayer;
        }
      })
      .catch((err) => {
        console.error("Błąd ładowania streamu:", err);
        setIsLoadingAudio(false);
      });

    // Przekazanie metadanych do systemowego odtwarzacza smartfona
    if (typeof window !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.source || "Songify",
        artwork: [
          {
            src: currentTrack.albumCover,
            sizes: "512x512",
            type: "image/jpeg",
          },
        ],
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [currentTrack?.id]);

  // 4. Synchronizacja stanu Play / Pause z MediaSession
  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current) return;

    try {
      if (isPlaying && typeof playerRef.current.playVideo === "function") {
        playerRef.current.playVideo();
      } else if (!isPlaying && typeof playerRef.current.pauseVideo === "function") {
        playerRef.current.pauseVideo();
      }
    } catch (err) {
      console.warn("Błąd toggle play/pause:", err);
    }

    // Aktualizacja ikony (Play vs Pause) w systemie Android i na iOS
    if (typeof window !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  // 5. Seek z aplikacji
  useEffect(() => {
    if (
      seekTarget !== null &&
      playerRef.current &&
      typeof playerRef.current.seekTo === "function"
    ) {
      playerRef.current.seekTo(seekTarget, true);
      resetSeek();
    }
  }, [seekTarget, resetSeek]);

  // 6. Pętla synchronizacji pozycji i paska postępu na ekranie blokady
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (isPlaying) {
      timerRef.current = setInterval(() => {
        if (
          isReadyRef.current &&
          playerRef.current &&
          typeof playerRef.current.getCurrentTime === "function"
        ) {
          const cur = playerRef.current.getCurrentTime();
          setCurrentTime(cur);

          let currentDuration = duration;
          if (typeof playerRef.current.getDuration === "function") {
            const ytDur = playerRef.current.getDuration();
            if (ytDur && ytDur > 0 && Math.abs(ytDur - duration) > 1) {
              setDuration(ytDur);
              currentDuration = ytDur;
            }
          }

          // Aktualizacja suwaka czasu na ekranie blokady smartfona
          if (
            typeof window !== "undefined" &&
            "mediaSession" in navigator &&
            "setPositionState" in navigator.mediaSession &&
            !isNaN(currentDuration) &&
            currentDuration > 0 &&
            !isNaN(cur)
          ) {
            try {
              navigator.mediaSession.setPositionState({
                duration: currentDuration,
                playbackRate: 1.0,
                position: Math.min(cur, currentDuration),
              });
            } catch (e) {
              // Ignorujemy ewentualne mikro-rozbieżności w zaokrągleniach czasu
            }
          }
        }
      }, 350);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, duration, setCurrentTime, setDuration]);

  return (
    <div className="fixed -top-96 -left-96 h-1 w-1 opacity-0 pointer-events-none overflow-hidden">
      <div id="songify-hidden-player" />
    </div>
  );
}