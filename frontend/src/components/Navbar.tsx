"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  QrCode,
  Tv,
  LogOut,
  User as UserIcon,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { User } from "@/lib/types";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.getMe();
      if (res.success && res.user) {
        setCurrentUser(res.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    const handleAuthEvent = () => fetchUser();
    window.addEventListener("auth-changed", handleAuthEvent);
    return () => window.removeEventListener("auth-changed", handleAuthEvent);
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
      setCurrentUser(null);
      router.push("/");
    } catch {
      router.push("/");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-maroon-700 via-rose-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 tracking-tight text-base sm:text-lg">
                  Fırat Üniversitesi
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-900">
                  Yoklama
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
                Yetkili CAS Doğrulamalı Yoklama Portalı
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="hidden md:flex items-center space-x-1.5">
          <Link
            href="/student"
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/student"
                ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-semibold border border-rose-200 dark:border-rose-900"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Öğrenci Paneli</span>
          </Link>

          <Link
            href="/instructor"
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/instructor"
                ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-900"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Öğretim Görevlisi</span>
          </Link>
        </nav>

        {/* User Info / Auth Actions */}
        <div className="flex items-center space-x-3">
          {loading ? (
            <div className="w-24 h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
          ) : currentUser ? (
            <div className="flex items-center space-x-2.5">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                  {currentUser.full_name}
                </p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {currentUser.university_student_id || currentUser.cas_subject}
                  </span>
                  <span
                    className={`text-[9px] px-1 rounded font-semibold uppercase ${
                      currentUser.role === "instructor"
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                    }`}
                  >
                    {currentUser.role === "instructor" ? "Hoca" : "Öğrenci"}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors border border-zinc-200 dark:border-zinc-800"
                title="Çıkış Yap"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Giriş Yap</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
