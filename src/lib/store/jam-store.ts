import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Track } from "./player-store";

export interface JamParticipant {
  id: string;
  username: string;
  avatarUrl?: string | null;
  isHost: boolean;
}

export interface JamTrack extends Track {
  addedBy?: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
}

interface JamState {
  jamCode: string | null;
  isHost: boolean;
  allowGuestControl: boolean; // true = goście mogą pomijać i edytować; false = tylko dodawanie na koniec
  participants: JamParticipant[];
  jamQueue: JamTrack[];
  currentJamTrack: JamTrack | null;
  isJamModalOpen: boolean;

  setJamCode: (code: string | null, isHost?: boolean) => void;
  setAllowGuestControl: (allow: boolean) => void;
  setParticipants: (participants: JamParticipant[]) => void;
  setJamQueue: (queue: JamTrack[]) => void;
  addToJamQueue: (track: JamTrack) => void;
  removeFromJamQueue: (index: number) => void;
  reorderJamQueue: (startIndex: number, endIndex: number) => void;
  setCurrentJamTrack: (track: JamTrack | null) => void;
  setJamModalOpen: (open: boolean) => void;
  leaveJam: () => void;
}

export const useJamStore = create<JamState>()(
  persist(
    (set, get) => ({
      jamCode: null,
      isHost: false,
      allowGuestControl: true,
      participants: [],
      jamQueue: [],
      currentJamTrack: null,
      isJamModalOpen: false,

      setJamCode: (jamCode, isHost = false) =>
        set({ jamCode, isHost }),

      setAllowGuestControl: (allowGuestControl) =>
        set({ allowGuestControl }),

      setParticipants: (participants) =>
        set({ participants }),

      setJamQueue: (jamQueue) =>
        set({ jamQueue }),

      addToJamQueue: (track) => {
        const { jamQueue } = get();
        set({ jamQueue: [...jamQueue, track] });
      },

      removeFromJamQueue: (index) => {
        const { jamQueue } = get();
        set({ jamQueue: jamQueue.filter((_, i) => i !== index) });
      },

      reorderJamQueue: (startIndex, endIndex) => {
        const { jamQueue } = get();
        const updated = [...jamQueue];
        const [moved] = updated.splice(startIndex, 1);
        updated.splice(endIndex, 0, moved);
        set({ jamQueue: updated });
      },

      setCurrentJamTrack: (currentJamTrack) =>
        set({ currentJamTrack }),

      setJamModalOpen: (isJamModalOpen) =>
        set({ isJamModalOpen }),

      leaveJam: () =>
        set({
          jamCode: null,
          isHost: false,
          allowGuestControl: true,
          participants: [],
          jamQueue: [],
          currentJamTrack: null,
          isJamModalOpen: false,
        }),
    }),
    {
      name: "songify_jam_state",
      storage: createJSONStorage(() => sessionStorage), // Trzymamy w sesji karty przeglądarki
    }
  )
);