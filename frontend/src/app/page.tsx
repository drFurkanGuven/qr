"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  ShieldCheck,
  Lock,
  QrCode,
  Tv,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import { api } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleQuickTestLogin = async (role: "student" | "instructor") => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const ticket =
        role === "instructor"
          ? "ST-TEST-INSTRUCTOR-1001"
          : "ST-TEST-STUDENT-210101001";
      await api.loginWithCasTicket(ticket);
      window.dispatchEvent(new Event("auth-changed"));
      if (role === "instructor") {
        router.push("/instructor");
      } else {
        router.push("/student");
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Giriş işlemi başarısız oldu.");
    } finally {
      setLoading(false);
    }
  };

  const handleOfficialCasRedirect = () => {
    // Fırat CAS sunucusuna yönlendir
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    window.location.href = `${apiUrl}/auth/cas/start`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="max-w-3xl w-full text-center space-y-8">
        {/* Logo and Hero Header */}
        <div className="space-y-4">
          <div className="inline-flex p-4 rounded-3xl bg-gradient-to-tr from-rose-600 via-rose-700 to-indigo-700 text-white shadow-xl shadow-rose-600/20">
            <GraduationCap className="w-12 h-12" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Fırat Üniversitesi
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-indigo-600 mt-1">
              Yetkili Yoklama Portalı
            </span>
          </h1>
          <p className="max-w-xl mx-auto text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Ders içi güvenli, anlık ve dinamik QR tabanlı üniversite yoklama sistemi.
            Öğretim görevlileri oturum açar, öğrenciler kendi doğrulanmış CAS hesaplarıyla yoklamalarını verir.
          </p>
        </div>

        {errorMsg && (
          <div className="max-w-md mx-auto p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
          {/* Student Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                Öğrenci Girişi
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Kendi hesabınızla giriş yapıp sınıftaki tahtada bulunan QR kodu telefonunuzun kamerasıyla tarayın.
              </p>
            </div>
            <button
              onClick={() => handleQuickTestLogin("student")}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <span>Öğrenci Olarak Devam Et</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Instructor Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Tv className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                Öğretim Görevlisi
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Ders yoklaması başlatın, projeksiyon modunda 30 saniyede bir dönen dinamik QR yansıtın ve canlı izleyin.
              </p>
            </div>
            <button
              onClick={() => handleQuickTestLogin("instructor")}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <span>Hoca Paneline Gir</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Official CAS Login Button */}
        <div className="pt-2">
          <button
            onClick={handleOfficialCasRedirect}
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-4"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Fırat Üniversitesi Resmi CAS Sunucusu Üzerinden Giriş Yap</span>
          </button>
        </div>

        {/* Security & Feature Badges */}
        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-3 rounded-xl bg-zinc-100/60 dark:bg-zinc-900/60 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                httpOnly Çerez Koruması
              </h4>
              <p className="text-[11px] text-zinc-500">
                Tokenlar JavaScript veya tarayıcı belleğine asla sızdırılmaz.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-100/60 dark:bg-zinc-900/60 flex items-start gap-2.5">
            <QrCode className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                30s Dönen Dinamik QR
              </h4>
              <p className="text-[11px] text-zinc-500">
                Ekran görüntüsü paylaşımı ile dışarıdan yoklama alınması engellenir.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-100/60 dark:bg-zinc-900/60 flex items-start gap-2.5">
            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                Yarış Koşulu Önleme
              </h4>
              <p className="text-[11px] text-zinc-500">
                100+ eşzamanlı istekte dahi mükerrer yoklama kesinlikle oluşmaz.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}