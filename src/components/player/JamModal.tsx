"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useJamStore, JamTrack, JamParticipant } from "@/lib/store/jam-store";
import { usePlayerStore } from "@/lib/store/player-store";
import { getCurrentUserProfile } from "@/app/actions/user";
import {
  X,
  Users,
  Copy,
  Check,
  Play,
  Pause,
  SkipForward,
  Trash2,
  GripVertical,
  SlidersHorizontal,
  Music2,
  AlertTriangle,
} from "lucide-react";

// Generator 6-znakowego kodu bez 0, O, 1, I
function generateJamCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function JamJarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="7" y="2" width="10" height="3" rx="1" />
      <path d="M6 5h12" />
      <path d="M5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8z" />
      <path d="M8 12h8" />
      <path d="M9 15h6" />
    </svg>
  );
}

function getAvatarBgColor(name: string) {
  const colors = [
    "bg-emerald-600 text-white",
    "bg-indigo-600 text-white",
    "bg-rose-600 text-white",
    "bg-amber-600 text-white",
    "bg-sky-600 text-white",
    "bg-purple-600 text-white",
    "bg-teal-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function UserAvatarBadge({
  user,
  size = "h-7 w-7 text-[10px]",
}: {
  user: { avatarUrl?: string | null; username?: string | null } | null;
  size?: string;
}) {
  const initial = (user?.username?.trim()?.[0] || "U").toUpperCase();
  const bg = getAvatarBgColor(user?.username || "");

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.username || "Awatar"}
        className={`${size} rounded-full object-cover border border-teal-900/60 [html.light_&]:border-white shadow-sm`}
      />
    );
  }

  return (
    <div
      className={`${size} ${bg} rounded-full flex items-center justify-center font-bold select-none shadow-sm border border-black/20 [html.light_&]:border-white`}
    >
      {initial}
    </div>
  );
}

// Globalny kanał do emitowania zdarzeń
let activeJamChannel: any = null;
let lastAddedTrackId: string | null = null;
let lastAddedTime = 0;

export async function addTrackToJamSession(track: any) {
  const jamState = useJamStore.getState();
  if (!jamState.jamCode || !track) return false;

  const now = Date.now();
  const trackId = String(track.id);

  // Blokada przed podwójnym odpaleniem (np. touch + click) w ciągu 800ms
  if (lastAddedTrackId === trackId && now - lastAddedTime < 800) {
    return false;
  }
  lastAddedTrackId = trackId;
  lastAddedTime = now;

  let addedBy: any = undefined;

  try {
    const profile = await getCurrentUserProfile();
    if (profile) {
      addedBy = {
        id: profile.id,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
      };
    }
  } catch (err) {
    console.error("Błąd pobierania profilu dla utworu:", err);
  }

  const newJamTrack: JamTrack = {
    id: String(track.id),
    title: track.title,
    artist: track.artist,
    albumCover: track.albumCover,
    duration: track.duration,
    addedBy,
  };

  // Dodajemy u siebie lokalnie
  jamState.addToJamQueue(newJamTrack);

  if (jamState.isHost) {
    usePlayerStore.getState().addToQueue(newJamTrack);
  }

  // Rozgłaszamy TYLKO do pozostałych uczestników (self: false zapobiega duplikatom)
  try {
    if (activeJamChannel && activeJamChannel.state === "joined") {
      await activeJamChannel.send({
        type: "broadcast",
        event: "JAM_COMMAND",
        payload: {
          type: "ADD_TO_QUEUE",
          track: newJamTrack,
        },
      });
    }
  } catch (e) {
    console.error("Błąd rozgłaszania utworu w Dżemie:", e);
  }

  return true;
}

export default function JamModal() {
  const supabase = createClient();
  const {
    jamCode,
    isHost,
    allowGuestControl,
    participants,
    jamQueue,
    currentJamTrack,
    isJamModalOpen,
    setJamCode,
    setAllowGuestControl,
    setParticipants,
    setJamQueue,
    addToJamQueue,
    setCurrentJamTrack,
    setJamModalOpen,
    leaveJam,
  } = useJamStore();

  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
  } = usePlayerStore();

  const [jamIsPlaying, setJamIsPlaying] = useState<boolean>(isPlaying);

  useEffect(() => {
    if (isHost) {
      setJamIsPlaying(isPlaying);
    }
  }, [isPlaying, isHost]);

  const [inputCode, setInputCode] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  // Stan modala potwierdzenia zamknięcia (dla Hosta)
  const [isConfirmCloseModalOpen, setIsConfirmCloseModalOpen] = useState(false);
  // Stan powiadomienia na górze ekranu o zamknięciu sesji (dla Gości)
  const [jamClosedNotice, setJamClosedNotice] = useState(false);

  // Pobieranie profilu usera przez Prisma Action
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (profile) {
          setCurrentUser(profile);
        }
      } catch (e) {
        console.error("Błąd pobierania profilu w Dżemie:", e);
      }
    };
    fetchUser();
  }, []);

  // Realtime Broadcast & Presence
  useEffect(() => {
    if (!jamCode || !currentUser?.id) return;

    const channelName = `songify_jam_${jamCode}`;

    // Usuwamy stary kanał jeśli istniał
    const existingChannels = supabase.getChannels();
    const existing = existingChannels.find((ch: any) => ch.topic === `realtime:${channelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: currentUser.id },
        // self: false ZAPOBIEGA DUBELKOM UTWORÓW
        broadcast: { ack: false, self: false },
      },
    });

    activeJamChannel = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: JamParticipant[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          if (presences && presences.length > 0) {
            const p = presences[0];
            users.push({
              id: p.id || key,
              username: p.username || "Uczestnik",
              avatarUrl: p.avatarUrl || null,
              isHost: Boolean(p.isHost),
            });
          }
        });

        setParticipants(users);

        // Jeśli brakuje hosta, zamykamy sesję u gości
        const currentIsHost = useJamStore.getState().isHost;
        if (!currentIsHost && users.length > 0) {
          const hasHost = users.some((u) => u.isHost);
          if (!hasHost) {
            setJamClosedNotice(true);
            leaveJam();
            setTimeout(() => setJamClosedNotice(false), 4000);
          }
        }
      })
      .on("broadcast", { event: "JAM_COMMAND" }, ({ payload }) => {
        if (!payload) return;

        switch (payload.type) {
          case "REQUEST_SYNC":
            if (useJamStore.getState().isHost && channel.state === "joined") {
              channel.send({
                type: "broadcast",
                event: "JAM_COMMAND",
                payload: {
                  type: "SYNC_QUEUE",
                  queue: useJamStore.getState().jamQueue,
                  track: usePlayerStore.getState().currentTrack,
                  allowGuestControl: useJamStore.getState().allowGuestControl,
                  isPlaying: usePlayerStore.getState().isPlaying,
                },
              });
            }
            break;

          case "SYNC_QUEUE":
            if (Array.isArray(payload.queue)) {
              setJamQueue(payload.queue);
            }
            if (payload.track !== undefined) {
              setCurrentJamTrack(payload.track);
            }
            if (payload.allowGuestControl !== undefined) {
              setAllowGuestControl(payload.allowGuestControl);
            }
            if (payload.isPlaying !== undefined) {
              setJamIsPlaying(payload.isPlaying);
            }
            break;

          case "SYNC_CURRENT_TRACK":
            if (payload.track !== undefined) {
              setCurrentJamTrack(payload.track);
            }
            if (payload.isPlaying !== undefined) {
              setJamIsPlaying(payload.isPlaying);
            }
            break;

          case "ADD_TO_QUEUE":
            if (payload.track) {
              addToJamQueue(payload.track);
              if (useJamStore.getState().isHost) {
                usePlayerStore.getState().addToQueue(payload.track);
              }
            }
            break;

          case "REMOTE_TOGGLE_PLAY":
            if (useJamStore.getState().isHost) {
              togglePlay();
            }
            break;

          case "REMOTE_NEXT":
            if (useJamStore.getState().isHost) {
              nextTrack();
            }
            break;

          case "JAM_CLOSED":
            setJamClosedNotice(true);
            leaveJam();
            setTimeout(() => setJamClosedNotice(false), 4000);
            break;
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            id: currentUser.id,
            username: currentUser.username,
            avatarUrl: currentUser.avatarUrl,
            isHost,
            onlineAt: new Date().toISOString(),
          });

          if (!isHost) {
            channel.send({
              type: "broadcast",
              event: "JAM_COMMAND",
              payload: { type: "REQUEST_SYNC" },
            });
          }
        }
      });

    return () => {
      activeJamChannel = null;
      supabase.removeChannel(channel);
    };
  }, [jamCode, currentUser?.id, isHost]);

  // Synchronizacja bieżącego kawałka przez Hosta + odcinanie zagranych
  useEffect(() => {
    if (!isHost || !jamCode || !activeJamChannel) return;
    if (!currentTrack) return;

    setCurrentJamTrack(currentTrack);

    const currentQueue = useJamStore.getState().jamQueue;
    let nextQueue = currentQueue;

    const playingIdx = currentQueue.findIndex(
      (t) => String(t.id) === String(currentTrack.id)
    );

    if (playingIdx !== -1) {
      nextQueue = currentQueue.slice(playingIdx + 1);
      setJamQueue(nextQueue);
    }

    // Wysyłamy TYLKO wtedy, gdy kanał jest w 100% gotowy (likwiduje błąd REST API na starcie)
    if (activeJamChannel.state === "joined") {
      activeJamChannel.send({
        type: "broadcast",
        event: "JAM_COMMAND",
        payload: {
          type: "SYNC_CURRENT_TRACK",
          track: currentTrack,
          isPlaying,
        },
      });

      if (nextQueue.length !== currentQueue.length) {
        activeJamChannel.send({
          type: "broadcast",
          event: "JAM_COMMAND",
          payload: {
            type: "SYNC_QUEUE",
            queue: nextQueue,
            track: currentTrack,
            allowGuestControl,
            isPlaying,
          },
        });
      }
    }
  }, [currentTrack?.id, isPlaying, isHost, jamCode, allowGuestControl]);

  const sendJamCommand = async (payload: any) => {
    if (!activeJamChannel || activeJamChannel.state !== "joined") return;
    try {
      await activeJamChannel.send({
        type: "broadcast",
        event: "JAM_COMMAND",
        payload,
      });
    } catch (err) {
      console.error("Błąd wysyłania komendy Dżemu:", err);
    }
  };

  const handleCreateJam = () => {
    const newCode = generateJamCode();
    setJamCode(newCode, true);

    if (currentTrack) {
      setCurrentJamTrack(currentTrack);
      // Czyścimy kolejkę odtwarzacza, zostawiając TYLKO aktualnie grający utwór
      usePlayerStore.getState().setQueue([currentTrack]);
    } else {
      usePlayerStore.getState().setQueue([]);
    }
    // Czysta kolejka Dżemu
    setJamQueue([]);
  };

  const handleJoinJam = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (clean.length !== 6) {
      alert("Kod Dżemu musi mieć 6 znaków!");
      return;
    }
    setJamCode(clean, false);
    setJamQueue([]);
    setInputCode("");
  };

  const handleLeaveOrCloseJam = () => {
    if (isHost) {
      setIsConfirmCloseModalOpen(true);
    } else {
      leaveJam();
    }
  };

  const confirmCloseJam = async () => {
    setIsConfirmCloseModalOpen(false);
    await sendJamCommand({ type: "JAM_CLOSED" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Usuwamy zakolejkowane kawałki z silnika audio, żeby nie zostały jako widma
    const current = usePlayerStore.getState().currentTrack;
    if (current) {
      usePlayerStore.getState().setQueue([current]);
    } else {
      usePlayerStore.getState().setQueue([]);
    }

    leaveJam();
  };

  const handleCopyCode = () => {
    if (!jamCode) return;
    navigator.clipboard.writeText(jamCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRemoveTrack = (index: number) => {
    if (!isHost && !allowGuestControl) return;
    const trackToRemove = jamQueue[index];
    const updated = jamQueue.filter((_, i) => i !== index);
    setJamQueue(updated);
    sendJamCommand({ type: "SYNC_QUEUE", queue: updated, allowGuestControl, isPlaying });

    if (isHost && trackToRemove) {
      // Usuwamy ten konkretny utwór z kolejki playera
      const pQueue = usePlayerStore.getState().queue;
      const pIndex = pQueue.findIndex((t) => String(t.id) === String(trackToRemove.id));
      if (pIndex !== -1) {
        usePlayerStore.getState().removeFromQueue(pIndex);
      }
    }
  };

  const handleDrop = (targetIdx: number) => {
    if (!isHost && !allowGuestControl) return;
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    const updated = [...jamQueue];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setJamQueue(updated);
    setDraggedIdx(null);
    sendJamCommand({ type: "SYNC_QUEUE", queue: updated, allowGuestControl, isPlaying });

    if (isHost) {
      usePlayerStore.getState().reorderQueue(draggedIdx, targetIdx);
    }
  };

  const handleTogglePlayRemote = () => {
    if (isHost) {
      togglePlay();
    } else if (allowGuestControl) {
      sendJamCommand({ type: "REMOTE_TOGGLE_PLAY" });
    }
  };

  const handleNextRemote = () => {
    if (isHost) {
      nextTrack();
    } else if (allowGuestControl) {
      sendJamCommand({ type: "REMOTE_NEXT" });
    }
  };

  return (
    <>
      {/* PŁYWAJĄCY TOAST NA GÓRZE EKRANU DLA GOŚCIA */}
      {jamClosedNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 rounded-full border border-teal-500/40 bg-[#0e1619] px-5 py-2.5 text-xs font-bold text-white shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-top-4 duration-300 [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-400 text-black [html.light_&]:bg-[#db2777] [html.light_&]:text-white">
            <JamJarIcon className="h-3.5 w-3.5 stroke-[2.5]" />
          </div>
          <span>Gospodarz zakończył sesję Dżemu</span>
        </div>
      )}

      {/* GŁÓWNY MODAL DŻEMU */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm animate-in fade-in duration-200 ${
          isJamModalOpen ? "" : "hidden pointer-events-none"
        }`}
      >
        <div className="w-full max-w-md h-[88vh] max-h-[700px] flex flex-col rounded-3xl border border-teal-900/80 bg-[#0c1417] shadow-2xl animate-in zoom-in-95 duration-200 text-white overflow-hidden [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]">
          
          {/* NAGŁÓWEK MODALA */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-teal-950/60 [html.light_&]:border-[#fce7f3] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-400 [html.light_&]:bg-[#fdf2f8] [html.light_&]:border [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#db2777]">
                <JamJarIcon className="h-5 w-5 [html.light_&]:!stroke-[#db2777]" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">Songify Dżem</h2>
                <p className="text-[11px] text-gray-400 [html.light_&]:text-[#9f1239]">
                  {jamCode ? (isHost ? "Sesja Łączona (Gospodarz)" : "Dołączono jako gość") : "Wspólna kolejka imprezowa"}
                </p>
              </div>
            </div>

            <button
              onClick={() => setJamModalOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#142025] text-gray-400 hover:text-white [html.light_&]:bg-[#fff1f2] [html.light_&]:text-[#9f1239] transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ZAWARTOŚĆ MODALA */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {!jamCode ? (
              /* WIDOK STARTOWY */
              <div className="space-y-6 my-auto">
                <div className="rounded-2xl border border-teal-900/50 bg-[#121c20] p-4.5 space-y-3.5 [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-400 [html.light_&]:text-[#db2777]">
                      Rozpocznij nową sesję
                    </span>
                    <Users className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
                  </div>

                  <p className="text-[11px] text-gray-300 leading-relaxed [html.light_&]:text-[#881337]">
                    Muzyka będzie leciała z Twojego urządzenia (np. z głośnika), a znajomi będą mogli zdalnie dokładać swoje utwory.
                  </p>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#091013] border border-teal-950/60 cursor-pointer [html.light_&]:bg-[#fff1f2] [html.light_&]:border-[#fecdd3]">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-teal-400 [html.light_&]:text-[#db2777]" />
                      <span className="text-xs font-semibold">Zezwól gościom na edycję kolejki</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowGuestControl}
                      onChange={(e) => setAllowGuestControl(e.target.checked)}
                      className="h-4 w-4 accent-teal-400 rounded cursor-pointer [html.light_&]:accent-[#db2777]"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleCreateJam}
                    className="w-full rounded-xl bg-teal-400 py-3 text-xs font-bold text-black shadow-lg shadow-teal-500/20 hover:scale-[1.01] active:scale-95 transition cursor-pointer [html.light_&]:bg-[#db2777] [html.light_&]:text-white"
                  >
                    Utwórz Songify Dżem
                  </button>
                </div>

                <form onSubmit={handleJoinJam} className="rounded-2xl border border-teal-900/50 bg-[#121c20] p-4.5 space-y-3.5 [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3]">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400 [html.light_&]:text-[#db2777] block">
                    Dołącz do trwającego Dżemu
                  </span>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-gray-400 [html.light_&]:text-[#9f1239]">
                      Wpisz 6-znakowy kod sesji
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="np. K9X2B4"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      className="w-full text-center font-mono text-lg tracking-widest uppercase rounded-xl border border-teal-900/60 bg-[#162125] py-2.5 text-white placeholder-gray-600 focus:border-teal-400 focus:outline-none [html.light_&]:bg-[#fff1f2] [html.light_&]:border-[#fbcfe8] [html.light_&]:text-[#5c0612]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={inputCode.trim().length !== 6}
                    className="w-full rounded-xl border border-teal-700/60 bg-teal-950/40 py-2.5 text-xs font-bold text-teal-300 hover:bg-teal-500/20 active:scale-95 transition disabled:opacity-40 cursor-pointer [html.light_&]:bg-[#fff1f2] [html.light_&]:border-[#db2777] [html.light_&]:text-[#db2777]"
                  >
                    Dołącz do kolejki
                  </button>
                </form>
              </div>
            ) : (
              /* WIDOK AKTYWNEJ SESJI */
              <div className="space-y-5">
                {/* PASEK Z KODEM PIN I UCZESTNIKAMI */}
                <div className="rounded-2xl border border-teal-500/30 bg-[#121c20] p-3.5 flex items-center justify-between [html.light_&]:bg-[#fff1f2] [html.light_&]:border-[#fecdd3]">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 font-mono text-xs font-bold hover:bg-teal-500/30 transition cursor-pointer [html.light_&]:bg-[#db2777]/15 [html.light_&]:text-[#db2777]"
                      title="Kliknij, aby skopiować kod"
                    >
                      <span>{jamCode}</span>
                      {copiedCode ? <Check className="h-3.5 w-3.5 text-teal-400 stroke-[3]" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>

                    <div className="flex items-center -space-x-1.5">
                      {participants.slice(0, 4).map((p) => (
                        <div key={p.id} title={`${p.username}${p.isHost ? " (Host)" : ""}`}>
                          <UserAvatarBadge user={p} size="h-7 w-7 text-[11px]" />
                        </div>
                      ))}
                      {participants.length > 4 && (
                        <div className="h-7 w-7 rounded-full border border-teal-900/60 [html.light_&]:border-white bg-gray-800 flex items-center justify-center text-[9px] font-bold text-gray-300">
                          +{participants.length - 4}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLeaveOrCloseJam}
                    className="px-3 py-1.5 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-bold transition cursor-pointer [html.light_&]:bg-[#fee2e2] [html.light_&]:text-[#dc2626]"
                  >
                    {isHost ? "Zakończ Dżem" : "Opuść"}
                  </button>
                </div>

                {/* SEKCJA: TERAZ GRA W DŻEMIE */}
                {currentJamTrack && (
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-400 block mb-2 [html.light_&]:text-[#db2777]">
                      Aktualnie leci na imprezie
                    </span>

                    <div className="flex items-center justify-between rounded-2xl bg-[#091013] border border-teal-500/50 p-3 shadow-lg [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fbcfe8]">
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className="relative h-11 w-11 rounded-xl overflow-hidden flex-shrink-0 bg-[#142025]">
                          {currentJamTrack.albumCover ? (
                            <img src={currentJamTrack.albumCover} alt={currentJamTrack.title} className="h-full w-full object-cover" />
                          ) : (
                            <Music2 className="h-5 w-5 text-teal-400 m-auto" />
                          )}
                        </div>

                        <div className="flex flex-col truncate">
                          <span className="truncate text-xs font-bold text-white [html.light_&]:text-[#5c0612]">
                            {currentJamTrack.title}
                          </span>
                          <span className="truncate text-[11px] text-gray-400 [html.light_&]:text-[#9f1239]">
                            {currentJamTrack.artist}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={handleTogglePlayRemote}
                          disabled={!isHost && !allowGuestControl}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-400 text-black shadow-md hover:scale-105 active:scale-90 transition disabled:opacity-40 cursor-pointer [html.light_&]:bg-[#db2777] [html.light_&]:text-white"
                        >
                          {(isHost ? isPlaying : jamIsPlaying) ? (
                            <Pause className="h-4 w-4 fill-current" />
                          ) : (
                            <Play className="h-4 w-4 fill-current ml-0.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleNextRemote}
                          disabled={!isHost && !allowGuestControl}
                          className="p-2 text-gray-300 hover:text-white transition disabled:opacity-30 cursor-pointer [html.light_&]:text-[#9f1239]"
                          title="Pomiń utwór"
                        >
                          <SkipForward className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* WSPÓLNA KOLEJKA */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 [html.light_&]:text-[#be123c]">
                      Wspólna kolejka ({jamQueue.length})
                    </span>
                    {!allowGuestControl && !isHost && (
                      <span className="text-[10px] text-gray-500 italic">Tylko gospodarz może edytować</span>
                    )}
                  </div>

                  {jamQueue.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-500 [html.light_&]:text-[#f472b6]">
                      Kolejka jest pusta. Dodaj utwór przesuwając palcem w prawo na playliście lub wyszukiwarce!
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {jamQueue.map((track, idx) => (
                        <div
                          key={`${track.id}-${idx}`}
                          draggable={isHost || allowGuestControl}
                          onDragStart={() => setDraggedIdx(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(idx)}
                          className="flex items-center justify-between p-2 rounded-xl bg-[#091013] border border-teal-950/60 hover:bg-[#121c20] transition [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3]"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden min-w-0 pr-2">
                            <span className="w-4 text-center text-[10px] font-mono text-gray-500">
                              {idx + 1}
                            </span>

                            <div className="h-9 w-9 rounded-lg overflow-hidden flex-shrink-0 bg-[#162125]">
                              {track.albumCover ? (
                                <img src={track.albumCover} alt={track.title} className="h-full w-full object-cover" />
                              ) : (
                                <Music2 className="h-4 w-4 text-teal-400/50 m-auto" />
                              )}
                            </div>

                            <div className="flex flex-col truncate">
                              <span className="truncate text-xs font-semibold text-white [html.light_&]:text-[#5c0612]">
                                {track.title}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="truncate text-[10px] text-gray-400 [html.light_&]:text-[#9f1239]">
                                  {track.artist}
                                </span>
                                {track.addedBy && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-teal-950/60 text-teal-300 border border-teal-800/40 truncate max-w-[110px] [html.light_&]:bg-[#fff1f2] [html.light_&]:text-[#db2777] [html.light_&]:border-[#fbcfe8]">
                                    {track.addedBy.username}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {(isHost || allowGuestControl) && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRemoveTrack(idx)}
                                className="p-1.5 text-gray-500 hover:text-red-400 transition cursor-pointer"
                                title="Usuń z kolejki"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <div
                                className="p-1.5 text-gray-500 hover:text-teal-400 cursor-grab active:cursor-grabbing transition"
                                title="Zmień kolejność"
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL POTWIERDZENIA ZAMKNIĘCIA DLA HOSTA */}
      {isConfirmCloseModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xs rounded-3xl border border-teal-900/60 bg-[#0e1619] p-6 shadow-2xl text-center [html.light_&]:bg-white [html.light_&]:border-[#fbcfe8]">
            <AlertTriangle className="h-9 w-9 text-red-400 mx-auto mb-3 [html.light_&]:text-[#e11d48]" />
            <h4 className="text-sm font-bold text-white mb-1 [html.light_&]:text-[#5c0612]">
              Zakończ Songify Dżem
            </h4>
            <p className="text-xs text-gray-300 mb-5 leading-relaxed [html.light_&]:text-[#881337]">
              Czy na pewno chcesz zamknąć Dżem dla wszystkich uczestników? Sesja zostanie natychmiast przerwana.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmCloseModalOpen(false)}
                className="flex-1 rounded-xl border border-teal-900/40 bg-[#162125] py-2.5 text-xs font-semibold text-gray-300 hover:text-white transition cursor-pointer [html.light_&]:bg-[#fff5f7] [html.light_&]:border-[#fce7f3] [html.light_&]:text-[#9f1239]"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={confirmCloseJam}
                className="flex-1 rounded-xl bg-red-500/20 border border-red-500/40 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/30 transition cursor-pointer [html.light_&]:bg-[#fee2e2] [html.light_&]:border-[#fca5a5] [html.light_&]:text-[#dc2626]"
              >
                Zakończ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}