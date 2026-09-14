"use client";

import { useState } from "react";
import { Eye, EyeOff, Music2 } from "lucide-react";
import { login, register } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const action = isLogin ? login : register;
    const res = await action(formData);

    if (res?.error) {
      setErrorMessage(res.error);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090e11] px-4 py-12 text-white">
      {/* Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-2xl border border-teal-900/30 bg-[#0e1619]/80 p-8 backdrop-blur-xl shadow-2xl">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 mb-3">
            <Music2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Songify</h1>
          <p className="text-xs text-teal-400/80 mt-1 font-mono">
            {isLogin ? "Zaloguj się do aplikacji" : "Stwórz nowe konto"}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400 text-center">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Nazwa użytkownika
              </label>
              <input
                name="username"
                type="text"
                required
                className="w-full rounded-xl border border-teal-900/50 bg-[#162125] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 transition"
                placeholder="np. meloman"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Adres E-mail
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-teal-900/50 bg-[#162125] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 transition"
              placeholder="twoj@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Hasło
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                className="w-full rounded-xl border border-teal-900/50 bg-[#162125] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-teal-400 transition"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Powtórz hasło
              </label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-teal-900/50 bg-[#162125] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 transition"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-teal-400 transition"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          )}

          {isLogin && (
            <div className="flex items-center text-xs text-gray-400">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-gray-700 bg-[#162125] text-teal-500 focus:ring-teal-500"
              />
              <label htmlFor="remember" className="ml-2 select-none cursor-pointer">
                Zapamiętaj to urządzenie
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-teal-500 py-3 text-sm font-semibold text-black transition hover:bg-teal-400 disabled:opacity-50 mt-2"
          >
            {loading ? "Przetwarzanie..." : isLogin ? "Zaloguj się" : "Zarejestruj się"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-teal-900/40" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0e1619] px-2 text-gray-400">lub</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-900/50 bg-[#162125] py-2.5 text-sm font-medium text-white transition hover:bg-[#1a282d]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Kontynuuj z Google
        </button>

        <div className="mt-6 text-center text-xs text-gray-400">
          {isLogin ? (
            <p>
              Nie masz jeszcze konta?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(false);
                  setErrorMessage(null);
                }}
                className="font-semibold text-teal-400 hover:underline"
              >
                Zarejestruj się
              </button>
            </p>
          ) : (
            <p>
              Masz już konto?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  setErrorMessage(null);
                }}
                className="font-semibold text-teal-400 hover:underline"
              >
                Zaloguj się
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}