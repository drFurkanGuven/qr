"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  PlusCircle,
  PlayCircle,
  AlertTriangle,
  QrCode,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { BatchRun, DashboardStats } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRuns, setRecentRuns] = useState<BatchRun[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, runsData] = await Promise.all([
        api.getStats().catch(() => null),
        api.getExecutions({ limit: 5 }).catch(() => []),
      ]);
      setStats(statsData);
      setRecentRuns(runsData);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-blue-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>Genel Amaçlı API Test & Otomasyon Motoru</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            API Test ve Otomasyon Kontrol Merkezi
          </h1>
          <p className="text-blue-100 text-sm max-w-2xl leading-relaxed">
            QR ve metin girdilerini dinamik şablon değişkenleriyle eşleyin, tekil veya toplu istekleri eşzamanlı/sıralı olarak dış API uç noktalarına gönderin ve tüm yanıtları anlık olarak inceleyin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/runner"
            className="px-4 py-2.5 rounded-xl bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 transition shadow flex items-center space-x-2"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Toplu Çalıştırıcı</span>
          </Link>
          <Link
            href="/templates/new"
            className="px-4 py-2.5 rounded-xl bg-blue-700/60 hover:bg-blue-700 text-white font-semibold text-sm border border-white/20 transition flex items-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Yeni Şablon</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Runs */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Toplam Oturum
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {loading ? "..." : stats?.total_batch_runs ?? 0}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {stats?.total_requests_executed ?? 0} toplam istek
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Başarı Oranı
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {loading ? "..." : `${stats?.overall_success_rate_pct ?? 0}%`}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {stats?.successful_requests ?? 0} başarılı / {stats?.failed_requests ?? 0} hata
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Average Latency */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Ortalama Gecikme
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {loading ? "..." : `${stats?.average_latency_ms ?? 0} ms`}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              HTTP yanıt süresi
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Templates Count */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Aktif Şablonlar
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {loading ? "..." : `${stats?.active_templates ?? 0} / ${stats?.total_templates ?? 0}`}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Tetiklenmeye hazır
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Launch & Recent Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launch Card */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 font-semibold mb-2">
              <QrCode className="w-5 h-5" />
              <span>Hızlı Başlatıcı</span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              QR Tara veya Metin Gönder
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed mb-6">
              Kameranızı açarak barkod/QR okutabilir veya elle metin girip tüm aktif şablonlara anında istek gönderebilirsiniz.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/runner"
              className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center space-x-2 shadow transition"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Toplu Çalıştırıcı Sayfasına Git</span>
            </Link>

            <Link
              href="/templates"
              className="w-full py-2.5 px-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium flex items-center justify-center space-x-2 transition"
            >
              <Layers className="w-4 h-4" />
              <span>Şablonları Listele</span>
            </Link>
          </div>
        </div>

        {/* Recent Runs List */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                Son Çalıştırma Oturumları
              </h3>
            </div>
            <Link
              href="/history"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
            >
              <span>Tümünü Gör</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-400">Veriler yükleniyor...</div>
          ) : recentRuns.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-400 flex flex-col items-center">
              <AlertTriangle className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mb-2" />
              <span>Henüz bir çalıştırma kaydı bulunmuyor.</span>
              <Link
                href="/runner"
                className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                İlk testinizi şimdi başlatın
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 uppercase font-medium">
                    <th className="pb-3">Girdi Değeri</th>
                    <th className="pb-3">Mod</th>
                    <th className="pb-3">Durum</th>
                    <th className="pb-3">İstek / Başarı</th>
                    <th className="pb-3">Süre</th>
                    <th className="pb-3 text-right">Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                  {recentRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                      <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100 max-w-[150px] truncate">
                        {run.input_value}
                      </td>
                      <td className="py-3 text-zinc-500 font-sans">
                        <span className="capitalize">{run.execution_mode}</span>
                      </td>
                      <td className="py-3">
                        <StatusBadge statusText={run.status} />
                      </td>
                      <td className="py-3 text-zinc-600 dark:text-zinc-300">
                        {run.successful_requests}/{run.total_requests}
                      </td>
                      <td className="py-3 text-zinc-500">{run.total_duration_ms} ms</td>
                      <td className="py-3 text-right font-sans">
                        <Link
                          href={`/history/${run.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                          İncele
                        </Link>
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
  );
}
