"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  Lock,
  AlertCircle,
  LogOut,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { clearAdminToken, getAdminToken, isAdminLoggedIn, setAdminToken } from "@/lib/admin";

type GateState = "loading" | "authed" | "unauthed";

interface AdminGateProps {
  children: React.ReactNode;
  /** Kendi çocuğunu bağımsız yöneten sayfalar için (örn. admin login modal'lı listeler) */
  onLoginSuccess?: () => void;
}

export const AdminGate: React.FC<AdminGateProps> = ({ children }) => {
  const [state, setState] = useState<GateState>("loading");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setState("loading");
      if (!isAdminLoggedIn()) {
        setState("unauthed");
        return;
      }
      try {
        const res = await api.adminVerify();
        if (cancelled) return;
        if (res.valid) {
          setState("authed");
        } else {
          clearAdminToken();
          setState("unauthed");
        }
      } catch {
        if (cancelled) return;
        // Token var ama backend'e ulaşılamıyor: bir kez giriş denemesine izin ver
        clearAdminToken();
        setState("unauthed");
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!password.trim()) {
      setLoginError("Lütfen yönetici parolasını girin.");
      return;
    }
    setLoggingIn(true);
    try {
      const res = await api.adminLogin(password.trim());
      setAdminToken(res.token);
      setPassword("");
      setState("authed");
    } catch (err: any) {
      setLoginError(err.response?.data?.detail || "Giriş sırasında bir hata oluştu.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setState("unauthed");
  };

  if (state === "loading") {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-zinc-400 space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <p className="text-sm">Yönetici oturumu kontrol ediliyor...</p>
      </div>
    );
  }

  if (state === "authed") {
    return (
      <div>
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={handleLogout}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 hover:text-rose-600 hover:border-rose-300 transition"
            title="Yönetici oturumunu kapat"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Çıkış Yap</span>
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-16">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8">
        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Yönetici Girişi
        </h2>
        <p className="text-xs text-zinc-500 mt-1 mb-6 leading-relaxed">
          Profil (istek şablonu) ekleme, düzenleme, silme ve klonlama işlemleri yönetici yetkisi
          gerektirir. Ziyaretçiler QR / metin gönderimini şablon sayfası olmadan
          <span className="font-semibold"> Toplu Çalıştırıcı </span>
          üzerinden kullanabilir.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Yönetici Parolası
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            {loginError && (
              <p className="mt-2 text-xs text-rose-600 flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{loginError}</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loggingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Doğrulanıyor...</span>
              </>
            ) : (
              <span>Giriş Yap</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};