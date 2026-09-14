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
  history: Track[];
  radioSeedArtist: string | null; // <-- Pamięć głównego artysty stacji radiowej
  isPlaying: boolean;
  isPlayerExpanded: boolean;
  isLiked: boolean;
  isShuffle: boolean;
  currentTime: number;
  duration: number;
  youtubeUrl: string | null;
  isLoadingAudio: boolean;
  seekTarget: number | null;
  isAddToPlaylistOpen: boolean;

  setCurrentTrack: (track: Track, newQueue?: Track[]) => void;
  setQueue: (queue: Track[]) => void;
  nextTrack: () => Promise<void>;
  previousTrack: () => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  setPlayerExpanded: (expanded: boolean) => void;
  setIsLiked: (liked: boolean) => void;
  toggleShuffle: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setAudioData: (ytUrl: string) => void;
  setIsLoadingAudio: (loading: boolean) => void;
  seekTo: (seconds: number) => void;
  resetSeek: () => void;
  setAddToPlaylistOpen: (open: boolean) => void;
}

// Pomocnik do wyciągania pierwszego artysty przy ręcznym wyborze z wyszukiwarki
function extractFirstArtist(artistStr: string): string {
  if (!artistStr) return "";
  const parts = artistStr.split(/,|\s+feat\.?|\s+ft\.?|\s+&\s+|\s+x\s+/i);
  return parts[0]?.trim() || artistStr.trim();
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      history: [],
      radioSeedArtist: null,
      isPlaying: false,
      isPlayerExpanded: false,
      isLiked: false,
      isShuffle: false,
      currentTime: 0,
      duration: 0,
      youtubeUrl: null,
      isLoadingAudio: false,
      seekTarget: null,
      isAddToPlaylistOpen: false,

      setCurrentTrack: (track, newQueue) => {
        const state = get();
        const current = state.currentTrack;
        const history = current ? [...state.history, current] : state.history;

        // Jeśli klikamy kawałek poza playlistą (np. z wyszukiwarki), ustalamy go jako fundament radia
        const seed =
          newQueue && newQueue.length > 0
            ? null
            : extractFirstArtist(track.artist);

        set({
          currentTrack: { ...track, id: String(track.id) },
          queue: newQueue !== undefined ? newQueue : [],
          history,
          radioSeedArtist: seed,
          isPlaying: true,
          isLiked: false,
          currentTime: 0,
          duration: track.duration || 0,
        });
      },

      setQueue: (queue) => set({ queue }),

      nextTrack: async () => {
        const { currentTrack, queue, history, isShuffle, radioSeedArtist } = get();
        if (!currentTrack) return;

        // 1. Odtwarzanie z playlisty
        if (queue.length > 0) {
          const currentIndex = queue.findIndex(
            (t) => String(t.id) === String(currentTrack.id)
          );

          let nextIndex = -1;
          if (isShuffle && queue.length > 1) {
            do {
              nextIndex = Math.floor(Math.random() * queue.length);
            } while (nextIndex === currentIndex);
          } else {
            nextIndex = (currentIndex + 1) % queue.length;
          }

          const next = queue[nextIndex];
          if (next) {
            set({
              currentTrack: { ...next, id: String(next.id) },
              history: [...history, currentTrack],
              isPlaying: true,
              isLiked: false,
              currentTime: 0,
              duration: next.duration || 0,
            });
            return;
          }
        }

        // 2. Tryb Radia: Używamy zapamiętanego głównego wykonawcy (radioSeedArtist)
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
            set({
              currentTrack: {
                ...data.track,
                id: String(data.track.id),
                // Zapewniamy, że nagłówek źródła nie zmieni się na "Radio: Skok", tylko pozostanie "Radio: Kukon"
                source: `Radio: ${targetArtist}`,
              },
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
      toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),
      setCurrentTime: (currentTime) => set({ currentTime }),
      setDuration: (duration) => set({ duration }),
      setAudioData: (youtubeUrl) => set({ youtubeUrl, isLoadingAudio: false }),
      setIsLoadingAudio: (isLoadingAudio) => set({ isLoadingAudio }),
      seekTo: (seconds) => set({ seekTarget: seconds, currentTime: seconds }),
      resetSeek: () => set({ seekTarget: null }),
      setAddToPlaylistOpen: (isAddToPlaylistOpen) => set({ isAddToPlaylistOpen }),
    }),
    {
      name: "songify_player_state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentTrack: state.currentTrack,
        queue: state.queue,
        radioSeedArtist: state.radioSeedArtist,
        currentTime: state.currentTime,
        duration: state.duration,
        isLiked: state.isLiked,
        isShuffle: state.isShuffle,
        youtubeUrl: state.youtubeUrl,
      }),
    }
  )
);