"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Play,
  Eye,
  Tag,
  Clock,
  Sparkles,
  Layers,
  ArrowLeft,
  Check,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { RequestLog, RequestTemplate, TemplateCreateInput } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponseInspectorModal } from "@/components/ResponseInspectorModal";

interface TemplateFormProps {
  initialData?: RequestTemplate;
  isEdit?: boolean;
}

export const TemplateForm: React.FC<TemplateFormProps> = ({ initialData, isEdit = false }) => {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [method, setMethod] = useState(initialData?.method || "POST");
  const [url, setUrl] = useState(initialData?.url || "https://httpbin.org/post");
  const [headersText, setHeadersText] = useState(
    initialData?.headers
      ? JSON.stringify(initialData.headers, null, 2)
      : '{\n  "Content-Type": "application/json"\n}'
  );
  const [bodyType, setBodyType] = useState(initialData?.body_type || "json");
  const [body, setBody] = useState(
    initialData?.body ||
      '{\n  "scanned_code": "{{qr_data}}",\n  "timestamp": "{{iso_timestamp}}",\n  "request_id": "{{uuid}}"\n}'
  );
  const [queryParamsText, setQueryParamsText] = useState(
    initialData?.query_params ? JSON.stringify(initialData.query_params, null, 2) : "{}"
  );
  const [timeoutSeconds, setTimeoutSeconds] = useState(initialData?.timeout_seconds || 10.0);
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [groupName, setGroupName] = useState(initialData?.group_name || "default");
  const [orderIndex, setOrderIndex] = useState(initialData?.order_index || 0);

  // Testing & preview state
  const [testInputValue, setTestInputValue] = useState("TEST_BARCODE_12345");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<RequestLog | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [inspectorLog, setInspectorLog] = useState<RequestLog | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const insertVariable = (variableStr: string, target: "url" | "body") => {
    if (target === "url") {
      setUrl((prev) => `${prev}${variableStr}`);
    } else {
      setBody((prev) => `${prev}\n${variableStr}`);
    }
  };

  const handlePreview = async () => {
    try {
      setFormError(null);
      let parsedHeaders = {};
      let parsedParams = {};
      try {
        parsedHeaders = JSON.parse(headersText);
      } catch {
        setFormError("Headers geçerli bir JSON olmalıdır.");
        return;
      }
      try {
        parsedParams = JSON.parse(queryParamsText);
      } catch {
        setFormError("Query Parametreleri geçerli bir JSON olmalıdır.");
        return;
      }

      const res = await api.previewTemplate(
        {
          name,
          method,
          url,
          headers: parsedHeaders,
          body_type: bodyType,
          body,
          query_params: parsedParams,
          timeout_seconds: timeoutSeconds,
          is_active: isActive,
          group_name: groupName,
          order_index: orderIndex,
        },
        testInputValue
      );
      setPreviewData(res);
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Önizleme oluşturulamadı.");
    }
  };

  const handleTest = async () => {
    try {
      setFormError(null);
      setTestLoading(true);
      setTestResult(null);

      if (isEdit && initialData?.id) {
        // Direct test via saved ID
        const res = await api.testTemplate(initialData.id, testInputValue);
        setTestResult(res);
      } else {
        // For new templates, save first or test directly via preview payload
        setFormError("Şablonu test etmek için lütfen önce kaydedin veya Önizleme yapın.");
      }
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Test sırasında hata oluştu.");
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    let parsedHeaders = {};
    let parsedParams = {};

    try {
      parsedHeaders = JSON.parse(headersText);
    } catch {
      setFormError("Headers geçerli bir JSON olmalıdır.");
      setSaving(false);
      return;
    }

    try {
      parsedParams = JSON.parse(queryParamsText);
    } catch {
      setFormError("Query Parametreleri geçerli bir JSON olmalıdır.");
      setSaving(false);
      return;
    }

    const payload: TemplateCreateInput = {
      name,
      description,
      method,
      url,
      headers: parsedHeaders,
      body_type: bodyType,
      body,
      query_params: parsedParams,
      timeout_seconds: Number(timeoutSeconds),
      is_active: isActive,
      group_name: groupName,
      order_index: Number(orderIndex),
    };

    try {
      if (isEdit && initialData?.id) {
        await api.updateTemplate(initialData.id, payload);
      } else {
        await api.createTemplate(payload);
      }
      router.push("/templates");
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Şablon kaydedilirken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const availablePlaceholders = [
    { label: "{{qr_data}}", desc: "Taranan QR / Metin" },
    { label: "{{timestamp}}", desc: "Unix Epoch Saniyesi" },
    { label: "{{iso_timestamp}}", desc: "ISO UTC Zamanı" },
    { label: "{{uuid}}", desc: "Benzersiz UUIDv4" },
    { label: "{{random_int:100:999}}", desc: "Rastgele Sayı" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/templates"
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {isEdit ? "Şablonu Düzenle" : "Yeni İstek Şablonu Tanımla"}
          </h2>
        </div>
      </div>

      {formError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center space-x-3 text-rose-700 dark:text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Grid: Form (Left) & Preview/Test (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Fields */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
            {/* General Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Şablon Adı *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="örn: Bilet Doğrulama Servisi"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Grup / Kategori
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="default"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Açıklama (Opsiyonel)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Bu şablon bilet okutulduğunda yetkilendirme API'sine POST isteği atar..."
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* HTTP Method & URL */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                HTTP İstek Hedefi *
              </label>
              <div className="flex gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-28 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.example.com/v1/scan/{{qr_data}}"
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Variable Insertion Chips */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Dinamik Değişken Ekle (İmleç / Sona Ekle)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availablePlaceholders.map((ph) => (
                  <button
                    key={ph.label}
                    type="button"
                    onClick={() => insertVariable(ph.label, "body")}
                    title={ph.desc}
                    className="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition"
                  >
                    + {ph.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Request Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Request Body (İstek Gövdesi)
                </label>
                <select
                  value={bodyType}
                  onChange={(e) => setBodyType(e.target.value)}
                  className="text-xs border border-zinc-300 dark:border-zinc-700 rounded px-2 py-0.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
                >
                  <option value="json">JSON</option>
                  <option value="text">Raw Text</option>
                  <option value="x-www-form-urlencoded">x-www-form-urlencoded</option>
                </select>
              </div>
              <textarea
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{\n  "code": "{{qr_data}}"\n}'
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Headers & Query Params (Collapsible or 2-columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Headers (JSON)
                </label>
                <textarea
                  rows={4}
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Query Parametreleri (JSON)
                </label>
                <textarea
                  rows={4}
                  value={queryParamsText}
                  onChange={(e) => setQueryParamsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Execution Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Timeout (Saniye)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Sıralama İndeksi
                </label>
                <input
                  type="number"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-3 pt-6">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-zinc-300"
                />
                <label
                  htmlFor="isActiveToggle"
                  className="text-sm font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer"
                >
                  Şablon Aktif
                </label>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="pt-4 flex items-center justify-end space-x-3">
              <Link
                href="/templates"
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                İptal
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow transition flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Kaydediliyor..." : isEdit ? "Güncellemeleri Kaydet" : "Şablonu Oluştur"}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Right Column: Live Preview & Testing */}
        <div className="space-y-6">
          {/* Test Sandbox Card */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-zinc-900 dark:text-zinc-100 font-bold text-sm">
              <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Canlı Test ve Değişken Önizleme</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Örnek Giriş Değeri (QR / Metin)
              </label>
              <input
                type="text"
                value={testInputValue}
                onChange={(e) => setTestInputValue(e.target.value)}
                placeholder="QR_12345"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePreview}
                className="flex-1 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center justify-center space-x-1 transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Değişkenleri Çöz</span>
              </button>

              {isEdit && initialData?.id && (
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testLoading}
                  className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center space-x-1 shadow transition disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{testLoading ? "Gönderiliyor..." : "İsteği Test Et"}</span>
                </button>
              )}
            </div>

            {/* Preview Output */}
            {previewData && (
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-2 text-xs font-mono">
                <div className="text-zinc-400 font-semibold border-b border-zinc-800 pb-1">
                  Çözümlenmiş İstek Önizlemesi:
                </div>
                <div>
                  <span className="text-amber-400 font-bold">{previewData.method}</span>{" "}
                  <span className="text-zinc-300 break-all">{previewData.url}</span>
                </div>
                {previewData.body && (
                  <div>
                    <span className="text-zinc-500">Payload:</span>
                    <pre className="text-zinc-200 whitespace-pre-wrap break-all mt-1 max-h-40 overflow-y-auto">
                      {previewData.body}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Test Result Output */}
            {testResult && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <StatusBadge statusCode={testResult.response_status_code} />
                    <span className="text-xs font-mono text-zinc-500">
                      {testResult.response_time_ms} ms
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectorLog(testResult)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    Detaylı İncele
                  </button>
                </div>
                {testResult.error_message && (
                  <p className="text-xs text-rose-500 font-mono break-all">
                    {testResult.error_message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Log Inspector Modal */}
      {inspectorLog && (
        <ResponseInspectorModal log={inspectorLog} onClose={() => setInspectorLog(null)} />
      )}
    </div>
  );
};
