"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  History,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import { BatchRun } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

export default function HistoryPage() {
  const [runs, setRuns] = useState<BatchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const loadRuns = async () => {
    try {
      setLoading(true);
      const data = await api.getExecutions({ limit: 100 });
      setRuns(data);
    } catch (err) {
      console.error("Failed to fetch runs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Bu çalıştırma kaydını ve altındaki tüm logları silmek istediğinize emin misiniz?")) return;
    try {
      await api.deleteExecution(id);
      setRuns((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert("Kayıt silinirken hata oluştu.");
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const filteredRuns = runs.filter((run) => {
    const matchesSearch = run.input_value.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || run.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <History className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Çalıştırma Geçmişi & Loglar</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Daha önce gerçekleştirilen tüm toplu test oturumlarını ve dönen yanıt detaylarını inceleyin.
          </p>
        </div>

        <button
          onClick={loadRuns}
          className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition"
          title="Yenile"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Girdi verisinde ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto">
          {["ALL", "completed", "partial_failure", "failed"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                statusFilter === st
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {st === "ALL" ? "Tümü" : st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Runs Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm text-zinc-400">Kayıtlar yükleniyor...</div>
        ) : filteredRuns.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 space-y-2">
            <History className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Eşleşen çalıştırma kaydı bulunamadı.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 uppercase font-semibold bg-zinc-50 dark:bg-zinc-950">
                  <th className="py-3.5 px-4">Tarih</th>
                  <th className="py-3.5 px-4">Girdi Verisi</th>
                  <th className="py-3.5 px-4">Mod / Tür</th>
                  <th className="py-3.5 px-4">Durum</th>
                  <th className="py-3.5 px-4">Başarı / Toplam</th>
                  <th className="py-3.5 px-4">Süre</th>
                  <th className="py-3.5 px-4 text-right">Eylemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono">
                {filteredRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition group"
                  >
                    <td className="py-3.5 px-4 text-zinc-500 whitespace-nowrap font-sans text-[11px]">
                      {formatDate(run.created_at)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100 max-w-[200px] truncate">
                      {run.input_value}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500 font-sans text-xs">
                      <span className="capitalize">{run.execution_mode}</span>
                      <span className="text-[10px] text-zinc-400 block">
                        ({run.input_type === "qr_camera" ? "QR Kamera" : "Metin"})
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge statusText={run.status} />
                    </td>
                    <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300">
                      <span className="text-emerald-600 font-bold">{run.successful_requests}</span>
                      {" / "}
                      <span>{run.total_requests}</span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500">{run.total_duration_ms} ms</td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/history/${run.id}`}
                          className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 font-semibold text-xs flex items-center space-x-1"
                        >
                          <span>Loglar</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={(e) => handleDelete(run.id, e)}
                          className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-500 hover:text-rose-700 transition"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
