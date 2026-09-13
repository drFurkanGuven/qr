"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileCode2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Play,
  CheckCircle2,
  XCircle,
  Tag,
  Clock,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { RequestLog, RequestTemplate } from "@/lib/types";
import { ResponseInspectorModal } from "@/components/ResponseInspectorModal";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<RequestTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");

  // Quick test state
  const [quickTestId, setQuickTestId] = useState<string | null>(null);
  const [quickTestInput, setQuickTestInput] = useState("SCAN_TEST_99");
  const [quickTestLoading, setQuickTestLoading] = useState(false);
  const [quickTestResult, setQuickTestResult] = useState<RequestLog | null>(null);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" adlı şablonu silmek istediğinize emin misiniz?`)) return;
    try {
      await api.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert("Şablon silinirken hata oluştu.");
    }
  };

  const handleDuplicate = async (template: RequestTemplate) => {
    try {
      const created = await api.createTemplate({
        name: `${template.name} (kopya)`,
        description: template.description || undefined,
        method: template.method,
        url: template.url,
        headers: template.headers,
        body_type: template.body_type,
        body: template.body || '{"qr_token":"{{qr_token}}"}',
        query_params: template.query_params || {},
        timeout_seconds: template.timeout_seconds,
        is_active: template.is_active,
        group_name: template.group_name,
        order_index: template.order_index + 1,
      });
      setTemplates((prev) => [...prev, created]);
    } catch {
      alert("İstek kopyalanırken hata oluştu.");
    }
  };

  const handleToggleActive = async (template: RequestTemplate) => {
    try {
      const updated = await api.updateTemplate(template.id, {
        is_active: !template.is_active,
      });
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? updated : t)));
    } catch (err) {
      alert("Durum güncellenirken hata oluştu.");
    }
  };

  const handleQuickTestSubmit = async (templateId: string) => {
    try {
      setQuickTestLoading(true);
      const res = await api.testTemplate(templateId, quickTestInput);
      setQuickTestResult(res);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Test sırasında hata oluştu.");
    } finally {
      setQuickTestLoading(false);
    }
  };

  // Groups list
  const groups = Array.from(new Set(templates.map((t) => t.group_name || "default")));

  // Filtered templates
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.method.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = selectedGroup === "ALL" || t.group_name === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <FileCode2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>İstek Şablonları</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Her kart bir lab cihazı/isteği. 10 cihaz için 10 kayıt açın; QR okutulunca aynı token hepsine gider.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadTemplates}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition"
            title="Yenile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/templates/new"
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni istek ekle</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Şablon ara (ad, url, metod)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedGroup("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedGroup === "ALL"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            Tümü ({templates.length})
          </button>
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedGroup === group
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {group} ({templates.filter((t) => t.group_name === group).length})
            </button>
          ))}
        </div>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="py-20 text-center text-sm text-zinc-400">Şablonlar yükleniyor...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center">
          <FileCode2 className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Kayıtlı Şablon Bulunamadı
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            Henüz herhangi bir API istek şablonu oluşturmadınız veya arama kriterine uygun kayıt yok.
          </p>
          <Link
            href="/templates/new"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>İlk Şablonu Oluştur</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className={`bg-white dark:bg-zinc-900 rounded-xl border transition p-5 flex flex-col justify-between shadow-sm hover:shadow-md ${
                tpl.is_active
                  ? "border-zinc-200 dark:border-zinc-800"
                  : "border-zinc-200 dark:border-zinc-800/50 opacity-60"
              }`}
            >
              <div>
                {/* Header: Method + Name + Toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        tpl.method === "POST"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                          : tpl.method === "GET"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : tpl.method === "PUT"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                      }`}
                    >
                      {tpl.method}
                    </span>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-[220px]">
                      {tpl.name}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleToggleActive(tpl)}
                      title={tpl.is_active ? "Devre Dışı Bırak" : "Aktifleştir"}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium transition ${
                        tpl.is_active
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                      }`}
                    >
                      {tpl.is_active ? "Aktif" : "Pasif"}
                    </button>
                  </div>
                </div>

                {/* Description */}
                {tpl.description && (
                  <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{tpl.description}</p>
                )}

                {/* URL */}
                <div className="mt-3 p-2 rounded bg-zinc-50 dark:bg-zinc-950 font-mono text-xs text-zinc-600 dark:text-zinc-400 break-all border border-zinc-100 dark:border-zinc-800/80">
                  {tpl.url}
                </div>

                {/* Meta Tags */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono">
                  <span className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    <Tag className="w-3 h-3" />
                    <span>{tpl.group_name}</span>
                  </span>
                  <span className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3" />
                    <span>{tpl.timeout_seconds}s</span>
                  </span>
                  <span className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    <ArrowUpDown className="w-3 h-3" />
                    <span>Sıra: {tpl.order_index}</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                <button
                  onClick={() => {
                    setQuickTestId(tpl.id);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold text-xs flex items-center space-x-1.5 transition"
                >
                  <Play className="w-3 h-3" />
                  <span>Tekil Test</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDuplicate(tpl)}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition"
                    title="Bu isteği kopyala (yeni cihaz)"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <Link
                    href={`/templates/edit/${tpl.id}`}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition"
                    title="Düzenle"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(tpl.id, tpl.name)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 transition"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Test Inline Modal */}
      {quickTestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-5 space-y-4">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <Play className="w-4 h-4 text-emerald-600" />
              <span>Hızlı Tekil İstek Gönder</span>
            </h3>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                qr_token (taranan QR):
              </label>
              <input
                type="text"
                value={quickTestInput}
                onChange={(e) => setQuickTestInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setQuickTestId(null);
                  setQuickTestResult(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                İptal
              </button>
              <button
                onClick={() => handleQuickTestSubmit(quickTestId)}
                disabled={quickTestLoading}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center space-x-1 disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                <span>{quickTestLoading ? "Gönderiliyor..." : "İsteği Gönder"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Log Inspector Modal if quick test succeeds */}
      {quickTestResult && (
        <ResponseInspectorModal
          log={quickTestResult}
          onClose={() => setQuickTestResult(null)}
        />
      )}
    </div>
  );
}
