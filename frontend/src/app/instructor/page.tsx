"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Tv,
  Play,
  StopCircle,
  Users,
  Download,
  Maximize2,
  Minimize2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  BookOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import { User, Course, CourseSession, AttendanceRecordItem } from "@/lib/types";
import { RotatingQrDisplay } from "@/components/RotatingQrDisplay";

export default function InstructorPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [activeSession, setActiveSession] = useState<CourseSession | null>(null);

  // QR State
  const [qrToken, setQrToken] = useState<string>("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);

  // Attendees & Live Stream
  const [attendees, setAttendees] = useState<AttendanceRecordItem[]>([]);
  const [liveNotifications, setLiveNotifications] = useState<string[]>([]);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const projectionRef = useRef<HTMLDivElement>(null);

  // 1. Yetki ve Dersleri Yükle
  const initInstructor = useCallback(async () => {
    try {
      const res = await api.getMe();
      if (!res.success || !res.user) {
        router.push("/");
        return;
      }
      if (res.user.role !== "instructor" && res.user.role !== "admin") {
        router.push("/student");
        return;
      }
      setUser(res.user);

      const courseList = await api.getCourses();
      setCourses(courseList);
      if (courseList.length > 0) {
        setSelectedCourseId(courseList[0].id);
      }
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    initInstructor();
  }, [initInstructor]);

  // 2. Dinamik QR Kodunu Periyodik Çekme (Her 30s)
  const fetchQr = useCallback(async (sessionId: string) => {
    try {
      const res = await api.getRotatingQr(sessionId);
      if (res.success) {
        setQrToken(res.qr_token);
        setSecondsRemaining(res.seconds_remaining);
      }
    } catch (e: any) {
      if (e.response?.status === 410) {
        // Oturum kapandı
        setActiveSession(null);
        setErrorMsg("Yoklama süresi doldu ve oturum kapandı.");
      }
    }
  }, []);

  // Timer loop for QR rotation countdown
  useEffect(() => {
    if (!activeSession) return;

    // Hemen ilk QR'ı çek
    fetchQr(activeSession.id);

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchQr(activeSession.id);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession, fetchQr]);

  // 3. SSE Canlı Katılım Akışını Bağla
  useEffect(() => {
    if (!activeSession) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    const sseUrl = `${apiUrl}/attendance/sessions/${activeSession.id}/stream`;
    const es = new EventSource(sseUrl, { withCredentials: true });
    eventSourceRef.current = es;

    es.addEventListener("student_verified", (e) => {
      try {
        const data = JSON.parse(e.data);
        const newRecord: AttendanceRecordItem = {
          id: Math.random().toString(),
          university_student_id: data.student_id,
          full_name: data.full_name,
          verified_at: data.verified_at,
        };
        setAttendees((prev) => [newRecord, ...prev]);
        setLiveNotifications((prev) => [
          `✅ ${data.full_name} (${data.student_id || ""}) katıldı`,
          ...prev.slice(0, 4),
        ]);
      } catch {}
    });

    es.addEventListener("student_rejected", (e) => {
      try {
        const data = JSON.parse(e.data);
        setLiveNotifications((prev) => [
          `⚠️ Kayıtsız öğrenci reddedildi: ${data.name || ""}`,
          ...prev.slice(0, 4),
        ]);
      } catch {}
    });

    es.addEventListener("session_closed", () => {
      setActiveSession(null);
    });

    return () => {
      es.close();
    };
  }, [activeSession]);

  // 4. Yoklama Başlat
  const handleStartSession = async () => {
    if (!selectedCourseId) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const session = await api.createSession(selectedCourseId, durationMinutes);
      setActiveSession(session);
      setAttendees([]);
      setLiveNotifications([]);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Yoklama oturumu başlatılamadı.");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Yoklama Kapat
  const handleCloseSession = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    try {
      await api.closeSession(activeSession.id);
      setActiveSession(null);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Oturum kapatılırken hata oluştu.");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Rapor İndir (JSON formatında)
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(attendees, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `yoklama_${activeSession?.course_code || "rapor"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Tam ekran projeksiyon modu
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      projectionRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {user?.full_name}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-900">
              Öğretim Görevlisi Paneli
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Ders seçin, yoklama süresini belirleyin ve projeksiyonda dinamik QR kodunu başlatın.
          </p>
        </div>

        {activeSession && (
          <button
            onClick={handleCloseSession}
            disabled={actionLoading}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors"
          >
            <StopCircle className="w-4 h-4" />
            <span>Yoklamayı Bitir</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Session Setup or Active Session View */}
      {!activeSession ? (
        /* Setup Session Card */
        <div className="max-w-xl mx-auto p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <Tv className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Yeni Yoklama Oturumu Başlat
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Ders Seçimi
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} - {c.name} ({c.academic_semester})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Oturum Süresi (Dakika)
              </label>
              <div className="flex items-center gap-3">
                {[5, 10, 15, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      durationMinutes === mins
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {mins} dk
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartSession}
              disabled={actionLoading || !selectedCourseId}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-700 hover:to-rose-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {actionLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>Yoklamayı Başlat ve QR Göster</span>
            </button>
          </div>
        </div>
      ) : (
        /* Active Session: Live Projection Screen & Realtime Attendee Table */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Projection Mode QR Code */}
          <div
            ref={projectionRef}
            className="lg:col-span-5 p-6 rounded-2xl bg-zinc-950 text-white shadow-xl border border-zinc-800 flex flex-col items-center justify-between space-y-4"
          >
            <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                  Aktif Yoklama
                </span>
                <h3 className="font-bold text-lg text-white">
                  {activeSession.course_code} - {activeSession.course_name}
                </h3>
              </div>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                title="Projeksiyon Tam Ekran"
              >
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Rotating QR Display */}
            {qrToken ? (
              <RotatingQrDisplay
                qrToken={qrToken}
                secondsRemaining={secondsRemaining}
                totalSeconds={30}
                size={300}
              />
            ) : (
              <div className="w-[300px] h-[300px] flex items-center justify-center bg-zinc-900 rounded-xl">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            )}

            <p className="text-[11px] text-zinc-400 text-center leading-relaxed max-w-xs">
              Bu QR kod 30 saniyede bir otomatik yenilenir. Öğrencilerin tahtadaki güncel kodu kendi telefonlarıyla okutmaları gerekir.
            </p>
          </div>

          {/* Right Column: Live Attendees & Notifications */}
          <div className="lg:col-span-7 space-y-4">
            {/* Live Stats Bar */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Katılan Öğrenci</p>
                  <p className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
                    {attendees.length}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">Rapor ve Döküm</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Canlı katılım listesi</p>
                </div>
                <button
                  onClick={handleExportJson}
                  disabled={attendees.length === 0}
                  className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Döküm Al</span>
                </button>
              </div>
            </div>

            {/* Live Notifications Feed */}
            {liveNotifications.length > 0 && (
              <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs font-mono">
                {liveNotifications.map((notif, idx) => (
                  <p key={idx} className="text-zinc-700 dark:text-zinc-300">
                    {notif}
                  </p>
                ))}
              </div>
            )}

            {/* Realtime Attendees Table */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    Canlı Katılan Öğrenciler
                  </h3>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">
                  Otomatik SSE Akışı Aktif
                </span>
              </div>

              {attendees.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-zinc-400" />
                  <p>Öğrencilerin QR kodu taraması bekleniyor...</p>
                </div>
              ) : (
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Öğrenci No</th>
                        <th className="py-2 px-3">Adı Soyadı</th>
                        <th className="py-2 px-3">Zaman</th>
                        <th className="py-2 px-3">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono">
                      {attendees.map((att, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="py-2.5 px-3 text-zinc-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                            {att.university_student_id || "-"}
                          </td>
                          <td className="py-2.5 px-3 font-sans font-medium text-zinc-800 dark:text-zinc-200">
                            {att.full_name}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-500">
                            {new Date(att.verified_at).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-emerald-600 dark:text-emerald-400 font-sans font-bold">
                              ✓ Onaylandı
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
