import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Track {
  id: string;
  title: string;
  artist: string;
  albumCover: string;
  duration?: number;
  source?: string;
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  originalQueue: Track[];
  history: Track[];
  radioSeedArtist: string | null;
  isPlaying: boolean;
  isPlayerExpanded: boolean;
  isLiked: boolean;
  isShuffle: boolean;
  repeatMode: "off" | "track" | "playlist";
  currentTime: number;
  duration: number;
  youtubeUrl: string | null;
  isLoadingAudio: boolean;
  seekTarget: number | null;
  isAddToPlaylistOpen: boolean;

  setCurrentTrack: (track: Track, newQueue?: Track[], autoPlay?: boolean) => void;
  setQueue: (queue: Track[]) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  removeFromQueue: (index: number) => void;
  playNextInQueue: (index: number) => void;
  addToQueue: (track: Track) => void;
  nextTrack: () => Promise<void>;
  previousTrack: () => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  setPlayerExpanded: (expanded: boolean) => void;
  setIsLiked: (liked: boolean) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setAudioData: (ytUrl: string) => void;
  setIsLoadingAudio: (loading: boolean) => void;
  seekTo: (seconds: number) => void;
  resetSeek: () => void;
  setAddToPlaylistOpen: (open: boolean) => void;

  // Sleep Timer
  sleepTimerEndsAt: number | null;
  sleepTimerMode: "time" | "end_of_track" | null;
  setSleepTimer: (minutes: number | null, mode?: "time" | "end_of_track") => void;
}

function extractFirstArtist(artistStr: string): string {
  if (!artistStr) return "";
  const parts = artistStr.split(/,|\s+feat\.?|\s+ft\.?|\s+&\s+|\s+x\s+/i);
  return parts[0]?.trim() || artistStr.trim();
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      originalQueue: [],
      history: [],
      radioSeedArtist: null,
      isPlaying: false,
      isPlayerExpanded: false,
      isLiked: false,
      isShuffle: false,
      repeatMode: "off",
      currentTime: 0,
      duration: 0,
      youtubeUrl: null,
      isLoadingAudio: false,
      seekTarget: null,
      isAddToPlaylistOpen: false,
      sleepTimerEndsAt: null,
      sleepTimerMode: null,

      setCurrentTrack: (track, newQueue, autoPlay = true) => {
        const state = get();
        const current = state.currentTrack;
        const history = current ? [...state.history, current] : state.history;

        const seed =
          newQueue && newQueue.length > 0
            ? null
            : extractFirstArtist(track.artist);

        const sourceQueue = newQueue !== undefined ? newQueue : state.originalQueue.length > 0 ? state.originalQueue : [track];
        
        let finalQueue: Track[] = [];

        if (state.isShuffle && sourceQueue.length > 1) {
          // Przy włączonym shuffle: bieżący utwór pierwszy, a reszta bez powtórzeń przetasowana
          const others = sourceQueue.filter((t) => String(t.id) !== String(track.id));
          finalQueue = [track, ...shuffleArray(others)];
        } else {
          // Przy odtwarzaniu po kolei: kolejka zaczyna się od wybranego utworu i idzie do końca
          const trackIdx = sourceQueue.findIndex((t) => String(t.id) === String(track.id));
          if (trackIdx !== -1) {
            finalQueue = sourceQueue.slice(trackIdx);
          } else {
            finalQueue = [track, ...sourceQueue];
          }
        }

        set({
          currentTrack: { ...track, id: String(track.id) },
          queue: finalQueue,
          originalQueue: sourceQueue,
          history,
          radioSeedArtist: seed,
          isPlaying: autoPlay,
          isLiked: false,
          currentTime: 0,
          duration: track.duration || 0,
        });
      },

      setQueue: (queue) => set({ queue }),

      reorderQueue: (startIndex, endIndex) => {
        const { queue } = get();
        const updated = [...queue];
        const [moved] = updated.splice(startIndex, 1);
        updated.splice(endIndex, 0, moved);
        set({ queue: updated });
      },

      removeFromQueue: (index) => {
        const { queue } = get();
        const updated = queue.filter((_, idx) => idx !== index);
        set({ queue: updated });
      },

      playNextInQueue: (index) => {
        const { queue } = get();
        if (index <= 1 || index >= queue.length) return;
        const updated = [...queue];
        const [moved] = updated.splice(index, 1);
        // Wstawiamy zaraz na 1. indeks (zaraz za currently playing [0])
        updated.splice(1, 0, moved);
        set({ queue: updated });
      },

      addToQueue: (track) => {
        const { queue, originalQueue, currentTrack } = get();
        const trackWithId = { ...track, id: String(track.id) };

        // Jeśli kolejka jest pusta, ale gra bieżący utwór, ustawiamy go na indeksie 0
        let baseQueue = [...queue];
        if (baseQueue.length === 0 && currentTrack) {
          baseQueue = [{ ...currentTrack, id: String(currentTrack.id) }];
        }

        // Wstawiamy nowy utwór zaraz na pozycję 1 (jako następny do odtworzenia)
        // Dzięki temu od razu widać go na samej górze sekcji "Następne w kolejce"!
        if (baseQueue.length > 0) {
          baseQueue.splice(1, 0, trackWithId);
        } else {
          baseQueue = [trackWithId];
        }

        set({
          queue: baseQueue,
          originalQueue: [trackWithId, ...originalQueue],
        });
      },

      nextTrack: async () => {
        const { currentTrack, queue, originalQueue, history, repeatMode, radioSeedArtist } = get();
        if (!currentTrack) return;

        // Tryb 1: Zapętlenie tego samego utworu
        if (repeatMode === "track") {
          set({ seekTarget: 0, currentTime: 0, isPlaying: true });
          return;
        }

        // Kolejka: sprawdzamy czy za bieżącym utworem (indeks 0 lub bieżący indeks) jest kolejny utwór
        if (queue.length > 1) {
          // Bierzemy następny utwór z kolejki (pozycja 1, bo pozycja 0 to bieżący)
          const next = queue[1];
          // Przesuwamy kolejkę do przodu: usuwamy poprzedni utwór z czoła
          const remainingQueue = queue.slice(1);

          set({
            currentTrack: { ...next, id: String(next.id) },
            queue: remainingQueue,
            history: [...history, currentTrack],
            isPlaying: true,
            isLiked: false,
            currentTime: 0,
            duration: next.duration || 0,
          });
          return;
        }

        // Jeśli kolejka dobiegła końca, a włączone jest zapętlenie playlisty ("playlist"):
        if (repeatMode === "playlist" && originalQueue.length > 0) {
          const firstTrack = originalQueue[0];
          set({
            currentTrack: { ...firstTrack, id: String(firstTrack.id) },
            queue: [...originalQueue],
            history: [...history, currentTrack],
            isPlaying: true,
            isLiked: false,
            currentTime: 0,
            duration: firstTrack.duration || 0,
          });
          return;
        }

        // Tryb radio: tylko gdy brak powtarzania i pusta kolejka
        if (repeatMode !== "off") {
          set({ isPlaying: false, currentTime: 0 });
          return;
        }

        const targetArtist = radioSeedArtist || extractFirstArtist(currentTrack.artist);
        set({ isLoadingAudio: true });
        try {
          const res = await fetch(
            `/api/audio/related?artist=${encodeURIComponent(
              targetArtist
            )}&currentTitle=${encodeURIComponent(currentTrack.title)}`
          );

          if (!res.ok) throw new Error("Błąd pobierania pokrewnego");
          const data = await res.json();

          if (data && data.track) {
            const radioTrack = {
              ...data.track,
              id: String(data.track.id),
              source: `Radio: ${targetArtist}`,
            };
            set({
              currentTrack: radioTrack,
              queue: [radioTrack],
              history: [...history, currentTrack],
              isPlaying: true,
              isLiked: false,
              currentTime: 0,
              duration: data.track.duration || 0,
              isLoadingAudio: false,
            });
          } else {
            set({ isLoadingAudio: false, isPlaying: false });
          }
        } catch (err) {
          console.error("Błąd autoodtwarzania radia wykonawcy:", err);
          set({ isLoadingAudio: false, isPlaying: false });
        }
      },

      previousTrack: () => {
        const { currentTrack, history, currentTime, queue } = get();

        if (currentTime > 3) {
          set({ seekTarget: 0, currentTime: 0 });
          return;
        }

        if (history.length > 0) {
          const prevTrack = history[history.length - 1];
          const newHistory = history.slice(0, -1);
          set({
            currentTrack: prevTrack,
            history: newHistory,
            isPlaying: true,
            isLiked: false,
            currentTime: 0,
            duration: prevTrack.duration || 0,
          });
          return;
        }

        if (currentTrack && queue.length > 1) {
          const currentIndex = queue.findIndex(
            (t) => String(t.id) === String(currentTrack.id)
          );
          const prevIndex =
            (currentIndex - 1 + queue.length) % queue.length;
          const prev = queue[prevIndex];
          set({
            currentTrack: { ...prev, id: String(prev.id) },
            isPlaying: true,
            isLiked: false,
            currentTime: 0,
            duration: prev.duration || 0,
          });
        }
      },

      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setPlayerExpanded: (expanded) => set({ isPlayerExpanded: expanded }),
      setIsLiked: (isLiked) => set({ isLiked }),
      toggleShuffle: () => {
        const state = get();
        const nextShuffle = !state.isShuffle;

        if (!state.currentTrack || state.queue.length <= 1) {
          set({ isShuffle: nextShuffle });
          return;
        }

        const current = state.currentTrack;
        const baseList = state.originalQueue.length > 0 ? state.originalQueue : state.queue;

        if (nextShuffle) {
          // Włączono Shuffle: bieżący zostaje, reszta jest przetasowana
          const rest = baseList.filter((t) => String(t.id) !== String(current.id));
          set({
            isShuffle: true,
            queue: [current, ...shuffleArray(rest)],
          });
        } else {
          // Wyłączono Shuffle: powrót do kolejności oryginalnej
          const currentIdx = baseList.findIndex((t) => String(t.id) === String(current.id));
          let restored: Track[] = [];
          if (currentIdx !== -1) {
            restored = baseList.slice(currentIdx);
          } else {
            restored = [current, ...baseList.filter((t) => String(t.id) !== String(current.id))];
          }
          set({
            isShuffle: false,
            queue: restored,
          });
        }
      },
      toggleRepeat: () =>
        set((state) => {
          const modes: ("off" | "playlist" | "track")[] = ["off", "playlist", "track"];
          const currentIdx = modes.indexOf(state.repeatMode || "off");
          const nextMode = modes[(currentIdx + 1) % modes.length];
          return { repeatMode: nextMode };
        }),
      setCurrentTime: (currentTime) => set({ currentTime }),
      setDuration: (duration) => set({ duration }),
      setAudioData: (youtubeUrl) => set({ youtubeUrl, isLoadingAudio: false }),
      setIsLoadingAudio: (isLoadingAudio) => set({ isLoadingAudio }),
      seekTo: (seconds) => set({ seekTarget: seconds, currentTime: seconds }),
      resetSeek: () => set({ seekTarget: null }),
      setAddToPlaylistOpen: (isAddToPlaylistOpen) => set({ isAddToPlaylistOpen }),

      setSleepTimer: (minutes, mode = "time") => {
        if (minutes === null) {
          set({ sleepTimerEndsAt: null, sleepTimerMode: null });
          return;
        }

        if (mode === "end_of_track") {
          set({ sleepTimerEndsAt: null, sleepTimerMode: "end_of_track" });
          return;
        }

        const endsAt = Date.now() + minutes * 60 * 1000;
        set({ sleepTimerEndsAt: endsAt, sleepTimerMode: "time" });
      },
    }),
    {
      name: "songify_player_state",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Gwarancja: po wczytaniu ze schowka stan ZAWSZE jest zapauzowany
          state.isPlaying = false;
        }
      },
      partialize: (state) => ({
        currentTrack: state.currentTrack,
        queue: state.queue,
        radioSeedArtist: state.radioSeedArtist,
        currentTime: state.currentTime,
        duration: state.duration,
        isLiked: state.isLiked,
        isShuffle: state.isShuffle,
        repeatMode: state.repeatMode,
        youtubeUrl: state.youtubeUrl,
      }),
    }
  )
);