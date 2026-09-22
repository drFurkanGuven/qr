"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ServerCrash,
  UserX,
  History,
  BookOpen,
  RefreshCw,
  LogOut,
  QrCode,
} from "lucide-react";
import { api } from "@/lib/api";
import { User, MyAttendanceRecord, VerificationStatus } from "@/lib/types";
import { QrScannerModal } from "@/components/QrScannerModal";

export default function StudentPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [status, setStatus] = useState<VerificationStatus>("IDLE");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [verifiedRecord, setVerifiedRecord] = useState<any>(null);
  const [myRecords, setMyRecords] = useState<MyAttendanceRecord[]>([]);

  // Öğrenci kimlik kontrolü
  const loadStudentData = useCallback(async () => {
    try {
      const res = await api.getMe();
      if (!res.success || !res.user) {
        router.push("/");
        return;
      }
      if (res.user.role !== "student") {
        router.push("/instructor");
        return;
      }
      setUser(res.user);

      // Geçmiş yoklamaları getir
      const recRes = await api.getMyRecords();
      if (recRes.success) {
        setMyRecords(recRes.records);
      }
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  // QR okunduğunda backend doğrulaması
  const handleScanSuccess = async (scannedText: string) => {
    setStatus("VERIFYING");
    setStatusMessage("QR kod çözüldü, sunucu doğrulaması yapılıyor...");
    setVerifiedRecord(null);

    try {
      const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : undefined;
      const res = await api.verifyAttendance(scannedText, idempotencyKey);

      if (res.success && res.status === "VERIFIED") {
        setStatus("VERIFIED");
        setStatusMessage(res.message || "Yoklamanız başarıyla kaydedildi.");
        setVerifiedRecord(res.record);
        // Listeyi yenile
        const recRes = await api.getMyRecords();
        if (recRes.success) {
          setMyRecords(recRes.records);
        }
      } else {
        setStatus("SERVER_ERROR");
        setStatusMessage(res.message || "Yoklama doğrulanamadı.");
      }
    } catch (err: any) {
      const statusHttp = err.response?.status;
      const detail = err.response?.data?.detail || "";

      if (statusHttp === 400 && detail.includes("süresi dolmuş")) {
        setStatus("QR_EXPIRED");
        setStatusMessage("QR kodunun süresi dolmuş. Lütfen tahtadaki güncel QR kodunu okutun.");
      } else if (statusHttp === 403 && detail.includes("kayıtlı")) {
        setStatus("NOT_ENROLLED");
        setStatusMessage("Bu derse kayıtlı görünmüyorsunuz.");
      } else if (statusHttp === 409) {
        setStatus("DUPLICATE");
        setStatusMessage("Bu ders için yoklamanız daha önce alınmış.");
      } else if (statusHttp === 401) {
        setStatus("UNAUTHORIZED_DEVICE");
        setStatusMessage("Oturumunuz geçersiz veya süresi dolmuş.");
      } else {
        setStatus("SERVER_ERROR");
        setStatusMessage(detail || "Sunucuyla bağlantı kurulamadı veya oturum kapalı.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Student Welcome Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Hoş Geldin, {user?.full_name}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-900">
              Öğrenci
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 font-mono">
            Öğrenci No: {user?.university_student_id || "Belirtilmemiş"} | CAS: {user?.cas_subject}
          </p>
        </div>

        <button
          onClick={() => {
            setStatus("SCANNING");
            setIsScannerOpen(true);
          }}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-md shadow-rose-600/20 flex items-center justify-center gap-2.5 transition-all transform active:scale-95"
        >
          <Camera className="w-5 h-5" />
          <span>Kamera ile Yoklama Ver</span>
        </button>
      </div>

      {/* 8-State Feedback Card */}
      {status !== "IDLE" && (
        <div
          className={`p-5 rounded-2xl border transition-all ${
            status === "VERIFIED"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
              : status === "VERIFYING" || status === "SCANNING"
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-100"
              : status === "QR_EXPIRED"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100"
              : status === "DUPLICATE"
              ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100"
          }`}
        >
          <div className="flex items-start gap-3.5">
            {status === "VERIFIED" && <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />}
            {(status === "VERIFYING" || status === "SCANNING") && (
              <RefreshCw className="w-6 h-6 text-blue-600 shrink-0 mt-0.5 animate-spin" />
            )}
            {status === "QR_EXPIRED" && <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />}
            {status === "DUPLICATE" && <AlertTriangle className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />}
            {status === "NOT_ENROLLED" && <UserX className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />}
            {status === "UNAUTHORIZED_DEVICE" && <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />}
            {status === "SERVER_ERROR" && <ServerCrash className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />}

            <div className="flex-1 space-y-1">
              <h3 className="font-bold text-sm sm:text-base">
                {status === "VERIFIED" && "Yoklamanız Başarıyla Alındı!"}
                {status === "VERIFYING" && "Yoklama Doğrulanıyor..."}
                {status === "SCANNING" && "Kamera Aktif / QR Taranıyor..."}
                {status === "QR_EXPIRED" && "QR Kodunun Süresi Dolmuş"}
                {status === "DUPLICATE" && "Zaten Kayıtlısınız"}
                {status === "NOT_ENROLLED" && "Derse Kayıtlı Değilsiniz"}
                {status === "UNAUTHORIZED_DEVICE" && "Yetkisiz Cihaz / Oturum Hatası"}
                {status === "SERVER_ERROR" && "Sunucu Hatası / Oturum Kapalı"}
              </h3>
              <p className="text-xs opacity-90">{statusMessage}</p>

              {verifiedRecord && (
                <div className="mt-2 p-2.5 rounded-lg bg-white/70 dark:bg-black/30 text-xs font-mono">
                  <p>Ders: {verifiedRecord.course_code} - {verifiedRecord.course_name}</p>
                  <p>Onay Zamanı: {new Date(verifiedRecord.verified_at).toLocaleTimeString()}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setStatus("IDLE")}
              className="text-xs px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* Attendance History */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-rose-600" />
            <h2 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
              Katıldığınız Ders Yoklamaları
            </h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            Toplam: {myRecords.length} ders
          </span>
        </div>

        {myRecords.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 text-xs">
            Henüz onaylanmış bir yoklama kaydınız bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Ders Kodu</th>
                  <th className="py-2.5 px-3">Ders Adı</th>
                  <th className="py-2.5 px-3">Tarih & Saat</th>
                  <th className="py-2.5 px-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {myRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="py-3 px-3 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {rec.course_code}
                    </td>
                    <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300">
                      {rec.course_name}
                    </td>
                    <td className="py-3 px-3 text-zinc-500 font-mono">
                      {new Date(rec.verified_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" />
                        Onaylandı
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Scanner Modal (With BarcodeDetector + ZXing + ImageCapture HD + Gallery File Picker) */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          if (status === "SCANNING") setStatus("IDLE");
        }}
        onScanSuccess={(decodedText) => {
          setIsScannerOpen(false);
          handleScanSuccess(decodedText);
        }}
      />
    </div>
  );
}
