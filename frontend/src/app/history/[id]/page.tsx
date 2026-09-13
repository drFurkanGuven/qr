"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Layers,
  Sparkles,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { BatchRun, RequestLog } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponseInspectorModal } from "@/components/ResponseInspectorModal";

export default function HistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [run, setRun] = useState<BatchRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectorLog, setInspectorLog] = useState<RequestLog | null>(null);

  useEffect(() => {
    if (!id) return;
    const loadRunDetail = async () => {
      try {
        setLoading(true);
        const data = await api.getExecutionDetail(id);
        setRun(data);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Çalıştırma detayı bulunamadı.");
      } finally {
        setLoading(false);
      }
    };
    loadRunDetail();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Bu çalıştırma oturumunu silmek istediğinize emin misiniz?")) return;
    try {
      await api.deleteExecution(id);
      router.push("/history");
    } catch (err) {
      alert("Silme işlemi başarısız oldu.");
    }
  };

  const handleExportJson = () => {
    if (!run) return;
    const blob = new Blob([JSON.stringify(run, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${run.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="py-20 text-center text-sm text-zinc-400">Loglar yükleniyor...</div>;
  }

  if (error || !run) {
    return (
      <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-xl border border-rose-200 text-rose-600 text-sm">
        {error || "Kayıt bulunamadı"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/history"
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <span>Oturum Detayları</span>
              <StatusBadge statusText={run.status} />
            </h1>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">ID: {run.id}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON İndir</span>
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-500 hover:text-rose-700 transition"
            title="Oturumu Sil"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Stat Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <p className="text-[10px] uppercase font-semibold text-zinc-400">Girdi Verisi</p>
          <p className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-100 truncate mt-1">
            {run.input_value}
          </p>
          <p className="text-[11px] text-zinc-500 capitalize">{run.input_type}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <p className="text-[10px] uppercase font-semibold text-zinc-400">Başarı / Toplam</p>
          <p className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {run.successful_requests} / {run.total_requests}
          </p>
          <p className="text-[11px] text-zinc-500 capitalize">{run.execution_mode} mod</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <p className="text-[10px] uppercase font-semibold text-zinc-400">Toplam Süre</p>
          <p className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400 mt-1">
            {run.total_duration_ms} ms
          </p>
          <p className="text-[11px] text-zinc-500">Tüm istekler</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <p className="text-[10px] uppercase font-semibold text-zinc-400">Tarih</p>
          <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 mt-1">
            {new Date(run.created_at).toLocaleString("tr-TR")}
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Tetiklenen İstekler ve Yanıt Günlükleri ({run.logs?.length || 0})</span>
          </h3>
        </div>

        {!run.logs || run.logs.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-xs">Bu oturuma ait log kaydı bulunamadı.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 uppercase font-semibold bg-zinc-50 dark:bg-zinc-950">
                  <th className="py-3 px-4">Şablon</th>
                  <th className="py-3 px-4">Metod / URL</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Süre</th>
                  <th className="py-3 px-4">Durum / Hata</th>
                  <th className="py-3 px-4 text-right">Eylem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono">
                {run.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                    <td className="py-3.5 px-4 font-sans font-semibold text-zinc-900 dark:text-zinc-100 max-w-[150px] truncate">
                      {log.template_name}
                    </td>
                    <td className="py-3.5 px-4 max-w-[280px]">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                          {log.request_method}
                        </span>
                        <span className="text-zinc-500 text-[11px] truncate">{log.request_url}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge statusCode={log.response_status_code} />
                    </td>
                    <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-300">
                      {log.response_time_ms} ms
                    </td>
                    <td className="py-3.5 px-4 font-sans text-xs">
                      {log.error_message ? (
                        <span className="text-rose-500 text-[11px] font-mono truncate block max-w-[200px]">
                          {log.error_message}
                        </span>
                      ) : log.is_success ? (
                        <span className="text-emerald-600 text-[11px] font-medium truncate block max-w-[220px]" title={log.response_body || ""}>
                          {(() => {
                            try {
                              const p = JSON.parse(log.response_body || "");
                              return p.message || p.detail || "Başarılı";
                            } catch {
                              return "Başarılı";
                            }
                          })()}
                        </span>
                      ) : (
                        <span className="text-amber-600 text-[11px] font-medium truncate block max-w-[220px]" title={log.response_body || ""}>
                          {(() => {
                            try {
                              const p = JSON.parse(log.response_body || "");
                              return p.message || p.detail || p.error || "Başarısız Yanıt";
                            } catch {
                              return "Başarısız Yanıt";
                            }
                          })()}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <button
                        onClick={() => setInspectorLog(log)}
                        className="px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-blue-600 dark:text-blue-400 font-semibold text-xs transition"
                      >
                        İncele
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Response Inspector Modal */}
      {inspectorLog && (
        <ResponseInspectorModal
          log={inspectorLog}
          onClose={() => setInspectorLog(null)}
        />
      )}
    </div>
  );
}
