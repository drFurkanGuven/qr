"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Camera,
  Play,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  ImageUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { StudentProfile, StudentVerifyResult, BatchDispatchResponse } from "@/lib/types";
import { QrScannerModal } from "@/components/QrScannerModal";
import { decodeQrFromBlob } from "@/lib/qrDecode";

export default function BatchRunnerPage() {
  const [qrToken, setQrToken] = useState<string>("");
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("tubitak_ekip");
  const [autoSendOnScan, setAutoSendOnScan] = useState<boolean>(true);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  const [running, setRunning] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<BatchDispatchResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoDecoding, setPhotoDecoding] = useState<boolean>(false);
  const directFileInputRef = React.useRef<HTMLInputElement>(null);

  // Aktif öğrenci profillerini yükle
  const loadProfiles = useCallback(async () => {
    try {
      const data = await api.getProfiles();
      setProfiles(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const activeCount = profiles.filter(
    (p) => p.is_active && (selectedGroup === "all" || p.group_tag === selectedGroup)
  ).length;

  // Toplu yoklama ateşleme fonksiyonu
  const handleDispatch = async (tokenOverride?: string) => {
    const tokenToUse = (tokenOverride || qrToken).trim();
    if (!tokenToUse) {
      setErrorMsg("Lütfen önce kamerayla QR kod okutun veya metin kutusuna girin.");
      return;
    }

    setRunning(true);
    setErrorMsg(null);

    try {
      const res = await api.dispatchBatch(tokenToUse, selectedGroup);
      setLastResult(res);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Toplu yoklama gönderimi sırasında sunucu hatası oluştu.");
    } finally {
      setRunning(false);
    }
  };

  // Kameradan QR okununca
  const handleScanSuccess = (scannedText: string) => {
    setQrToken(scannedText);
    setIsScannerOpen(false);
    if (autoSendOnScan) {
      void handleDispatch(scannedText);
    }
  };

  // Doğrudan fotoğraftan çözme
  const handleDirectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoDecoding(true);
    setErrorMsg(null);
    try {
      const decoded = await decodeQrFromBlob(file);
      if (decoded) {
        setQrToken(decoded);
        if (autoSendOnScan) {
          void handleDispatch(decoded);
        }
      } else {
        setErrorMsg("Seçilen fotoğrafta QR kod bulunamadı. Tahtayı daha yakından ve parlamasız çekmeyi deneyin.");
      }
    } catch {
      setErrorMsg("Fotoğraf işlenirken hata oluştu.");
    } finally {
      setPhotoDecoding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Hero Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Dekanlık & TÜBİTAK Çoklu Yoklama Otomasyonu
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-900">
              Otomasyon Motoru
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Sınıfta tahtadaki QR kodu tek bir cihazdan okutun; sunucu tüm ekip üyeleri adına resmi CAS oturumlarını açıp yoklamayı tek hamlede göndersin.
          </p>
        </div>

        <Link
          href="/profiles"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
        >
          <Users className="w-4 h-4 text-rose-600" />
          <span>Öğrenci Profillerini Yönet ({profiles.length})</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
        </Link>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* QR Input & Controls Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-rose-600" />
            <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              QR Kod Okutma & Gönderim Kontrolleri
            </h2>
          </div>
          <span className="text-xs font-mono text-emerald-600 font-semibold">
            {activeCount} öğrenci hazır
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* QR Token Input */}
          <div className="md:col-span-8 space-y-2">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Okunan QR Değeri (qr_token)
            </label>
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="text"
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder="Kamerayla okutun veya QR metnini buraya yapıştırın..."
                className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors shrink-0"
              >
                <Camera className="w-4 h-4" />
                <span>Kamera ile Tara</span>
              </button>
              <button
                type="button"
                onClick={() => directFileInputRef.current?.click()}
                disabled={photoDecoding}
                className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold text-xs flex items-center gap-2 transition-colors shrink-0 disabled:opacity-50"
                title="Kamera izni verilemeyen veya HTTP ağlarda telefon kamerası / galeri ile QR seçin"
              >
                <ImageUp className="w-4 h-4 text-rose-500" />
                <span>{photoDecoding ? "Taranıyor..." : "Fotoğraf / Galeri"}</span>
              </button>
              <input
                ref={directFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleDirectFile}
              />
            </div>
          </div>

          {/* Group Selector */}
          <div className="md:col-span-4 space-y-2">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Hedef Öğrenci Grubu
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="tubitak_ekip">TÜBİTAK Ekibi (tubitak_ekip)</option>
              <option value="all">Tüm Aktif Öğrenciler</option>
            </select>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={autoSendOnScan}
              onChange={(e) => setAutoSendOnScan(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
            />
            <span>Kamera QR&apos;ı okuduğu anda otomatik tüm ekibe gönder</span>
          </label>

          <button
            type="button"
            onClick={() => void handleDispatch()}
            disabled={running || !qrToken.trim() || activeCount === 0}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-rose-600/20 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 disabled:opacity-50"
          >
            {running ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {running
                ? "Yoklamalar Eşzamanlı Gönderiliyor..."
                : `${activeCount} Öğrenci İçin Tek Hamlede Yoklama Gönder`}
            </span>
          </button>
        </div>
      </div>

      {/* Results Section */}
      {lastResult && (
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Gönderim Sonuçları</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  Toplam: {lastResult.total_count}
                </span>
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Tüm öğrencilerin bağımsız CAS token ve telefon UUID bilgileriyle Fırat API yanıtları.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono font-bold">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ✓ {lastResult.success_count} Başarılı
              </span>
              {lastResult.failed_count > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  ✕ {lastResult.failed_count} Başarısız
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Öğrenci No</th>
                  <th className="py-2.5 px-3">Adı Soyadı</th>
                  <th className="py-2.5 px-3">HTTP Kodu</th>
                  <th className="py-2.5 px-3">Süre</th>
                  <th className="py-2.5 px-3">Fırat API Yanıt Mesajı</th>
                  <th className="py-2.5 px-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono">
                {lastResult.results.map((res, idx) => (
                  <tr key={res.profile_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="py-3 px-3 text-zinc-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-bold text-zinc-900 dark:text-zinc-100">
                      {res.student_no}
                    </td>
                    <td className="py-3 px-3 font-sans font-medium text-zinc-800 dark:text-zinc-200">
                      {res.full_name}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          res.status_code === 200 || res.status_code === 201
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : res.status_code === 409
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {res.status_code}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-500 text-[11px]">
                      {res.response_time_ms} ms
                    </td>
                    <td className="py-3 px-3 font-sans text-zinc-700 dark:text-zinc-300 max-w-[280px] truncate" title={res.message}>
                      {res.message}
                    </td>
                    <td className="py-3 px-3">
                      {res.success ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-sans font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Onaylandı
                        </span>
                      ) : res.status_code === 409 ? (
                        <span className="inline-flex items-center gap-1 text-indigo-600 font-sans font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Zaten Alınmış
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-sans font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Başarısız
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advanced QR Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}