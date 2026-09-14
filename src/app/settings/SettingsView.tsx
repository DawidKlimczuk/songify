"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Mail,
  Lock,
  Sun,
  Moon,
  Check,
  Loader2,
  ZoomIn,
} from "lucide-react";
import { updateAvatar, updateEmail, updatePassword } from "../actions/settings";

interface SettingsViewProps {
  initialEmail: string;
  initialAvatarUrl: string | null;
  username: string;
}

export default function SettingsView({
  initialEmail,
  initialAvatarUrl,
  username,
}: SettingsViewProps) {
  const router = useRouter();

  // Awatar & Kadrowanie
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);

  // Zmiana E-mail
  const [email, setEmail] = useState(initialEmail);
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Zmiana Hasła
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Motyw (DARK / LIGHT)
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = (localStorage.getItem("songify_theme") as "dark" | "light") || "dark";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("light", savedTheme === "light");
  }, []);

  const handleThemeToggle = (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    localStorage.setItem("songify_theme", newTheme);
    document.documentElement.classList.toggle("light", newTheme === "light");
  };

  // Wybór pliku ze zdjęciem
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  // Zapis kadrowanego zdjęcia przez HTML Canvas (kompresja do lekkiego WebP/JPEG)
  const handleSaveCroppedAvatar = async () => {
    if (!previewImgRef.current) return;
    setAvatarLoading(true);

    try {
      const img = previewImgRef.current;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const size = 200; // lekki awatar o boku 200px
      canvas.width = size;
      canvas.height = size;

      if (ctx) {
        ctx.drawImage(img, 0, 0, size, size);
        const base64Data = canvas.toDataURL("image/webp", 0.85);

        const res = await updateAvatar(base64Data);
        if (res.success) {
          setAvatarUrl(base64Data);
          setSelectedImage(null);
          setAvatarSuccess(true);
          setTimeout(() => setAvatarSuccess(false), 2500);
          router.refresh();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAvatarLoading(false);
    }
  };

  // Aktualizacja E-mail
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);

    if (newEmail !== confirmEmail) {
      setEmailMsg({ text: "Wprowadzone adresy e-mail nie są identyczne.", error: true });
      return;
    }

    setEmailLoading(true);
    try {
      const res = await updateEmail(newEmail);
      if (res.error) {
        setEmailMsg({ text: res.error, error: true });
      } else {
        setEmail(newEmail);
        setNewEmail("");
        setConfirmEmail("");
        setEmailMsg({ text: "Adres e-mail został zaktualizowany." });
      }
    } catch (err) {
      setEmailMsg({ text: "Wystąpił błąd podczas zmiany e-maila.", error: true });
    } finally {
      setEmailLoading(false);
    }
  };

  // Aktualizacja Hasła
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "Wprowadzone hasła nie są identyczne.", error: true });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMsg({ text: "Nowe hasło musi mieć min. 6 znaków.", error: true });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await updatePassword(oldPassword, newPassword);
      if (res.error) {
        setPasswordMsg({ text: res.error, error: true });
      } else {
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordMsg({ text: "Hasło zostało pomyślnie zmienione." });
      }
    } catch (err) {
      setPasswordMsg({ text: "Wystąpił błąd podczas zmiany hasła.", error: true });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-36 pt-4 px-4 text-white">
      {/* Pasek Górny */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Wróć</span>
        </button>
        <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">
          Ustawienia
        </span>
        <div className="w-10" />
      </div>

      <div className="space-y-6">
        {/* 1. SEKCJA: ZMIANA AWATARA */}
        <section className="rounded-2xl border border-teal-950/70 bg-[#0e1619] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="h-4 w-4 text-teal-400" />
            <h2 className="text-sm font-bold">Awatar profilu</h2>
          </div>

          <div className="flex flex-col items-center">
            {/* Ramka kadrowania */}
            <div className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-teal-500/50 shadow-lg mb-3 bg-[#162125] flex items-center justify-center">
              {selectedImage ? (
                <img
                  ref={previewImgRef}
                  src={selectedImage}
                  alt="Podgląd"
                  style={{ transform: `scale(${zoom})` }}
                  className="h-full w-full object-cover origin-center transition-transform duration-100"
                />
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Awatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl font-black text-teal-400">
                  {username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {!selectedImage ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20 active:scale-95 transition"
              >
                Wybierz nowe zdjęcie
              </button>
            ) : (
              <div className="w-full flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 w-48">
                  <ZoomIn className="h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="range"
                    min="1"
                    max="2.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveCroppedAvatar}
                    disabled={avatarLoading}
                    className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-teal-400 text-black active:scale-95 transition"
                  >
                    {avatarLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span>Zapisz awatar</span>
                  </button>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="text-xs font-semibold px-3 py-2 rounded-xl bg-transparent text-gray-400 hover:text-white"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            )}

            {avatarSuccess && (
              <span className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
                <Check className="h-3 w-3" /> Awatar został zaktualizowany!
              </span>
            )}
          </div>
        </section>

        {/* 2. SEKCJA: ZMIANA MOTYWU */}
        <section className="rounded-2xl border border-teal-950/70 bg-[#0e1619] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold">Motyw aplikacji</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Wybierz preferowany styl wizualny
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#162125] border border-teal-900/30">
              <button
                onClick={() => handleThemeToggle("dark")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  theme === "dark"
                    ? "bg-teal-500 text-black shadow-md shadow-teal-500/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
                <span>DARK</span>
              </button>
              <button
                onClick={() => handleThemeToggle("light")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  theme === "light"
                    ? "bg-[#ffb6c1] text-[#6b1426] shadow-md shadow-[#ffb6c1]/30 font-bold"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
                <span>LIGHT</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3. SEKCJA: ZMIANA ADRESU E-MAIL */}
        <section className="rounded-2xl border border-teal-950/70 bg-[#0e1619] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-teal-400" />
            <h2 className="text-sm font-bold">Zmiana adresu e-mail</h2>
          </div>

          <p className="text-[11px] text-gray-400 mb-3">
            Aktualny: <span className="text-white font-medium">{email}</span>
          </p>

          <form onSubmit={handleUpdateEmail} className="space-y-3">
            <input
              type="email"
              placeholder="Nowy adres e-mail"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-xl bg-[#162125] border border-teal-950 px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
            />
            <input
              type="email"
              placeholder="Powtórz nowy adres e-mail"
              required
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="w-full rounded-xl bg-[#162125] border border-teal-950 px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
            />

            {emailMsg && (
              <p
                className={`text-[11px] ${
                  emailMsg.error ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {emailMsg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={emailLoading}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-400 py-2.5 text-xs font-bold text-black active:scale-[0.98] transition hover:bg-teal-300"
            >
              {emailLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Zatwierdź zmianę e-mail</span>
            </button>
          </form>
        </section>

        {/* 4. SEKCJA: ZMIANA HASŁA */}
        <section className="rounded-2xl border border-teal-950/70 bg-[#0e1619] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-4 w-4 text-teal-400" />
            <h2 className="text-sm font-bold">Zmiana hasła</h2>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <input
              type="password"
              placeholder="Stare hasło"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full rounded-xl bg-[#162125] border border-teal-950 px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
            />
            <input
              type="password"
              placeholder="Nowe hasło (min. 6 znaków)"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl bg-[#162125] border border-teal-950 px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
            />
            <input
              type="password"
              placeholder="Powtórz nowe hasło"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl bg-[#162125] border border-teal-950 px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50"
            />

            {passwordMsg && (
              <p
                className={`text-[11px] ${
                  passwordMsg.error ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {passwordMsg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-400 py-2.5 text-xs font-bold text-black active:scale-[0.98] transition hover:bg-teal-300"
            >
              {passwordLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Zatwierdź zmianę hasła</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}