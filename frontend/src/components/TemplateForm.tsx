"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Play,
  Eye,
  Clock,
  ArrowLeft,
  AlertCircle,
  Dices,
  FileCode,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { RequestLog, RequestTemplate, TemplateCreateInput } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponseInspectorModal } from "@/components/ResponseInspectorModal";
import { RawHttpImportModal } from "./RawHttpImportModal";
import { ParsedTemplateFields } from "@/lib/httpParser";
import {
  DEFAULT_BODY,
  DEFAULT_USER_AGENT,
  buildRequestUrl,
  composeRequestHeaders,
  extractRequestFields,
} from "@/lib/requestFields";

interface TemplateFormProps {
  initialData?: RequestTemplate;
  isEdit?: boolean;
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none";
const monoClass = `${inputClass} font-mono text-xs`;

export const TemplateForm: React.FC<TemplateFormProps> = ({ initialData, isEdit = false }) => {
  const router = useRouter();
  const initialFields = useMemo(
    () => extractRequestFields(initialData?.url, initialData?.headers),
    [initialData]
  );

  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [method, setMethod] = useState(initialData?.method || "POST");
  const [host, setHost] = useState(initialFields.host);
  const [path, setPath] = useState(initialFields.path);
  const [accept, setAccept] = useState(initialFields.accept);
  const [contentType, setContentType] = useState(initialFields.contentType);
  const [authorization, setAuthorization] = useState(initialFields.authorization);
  const [deviceUuid, setDeviceUuid] = useState(initialFields.deviceUuid);
  const [userAgent, setUserAgent] = useState(initialFields.userAgent || DEFAULT_USER_AGENT);
  const [acceptLanguage, setAcceptLanguage] = useState(initialFields.acceptLanguage);
  const [extraHeadersText, setExtraHeadersText] = useState(
    Object.keys(initialFields.extraHeaders).length
      ? JSON.stringify(initialFields.extraHeaders, null, 2)
      : "{}"
  );
  const [body, setBody] = useState(initialData?.body || DEFAULT_BODY);
  const [timeoutSeconds, setTimeoutSeconds] = useState(initialData?.timeout_seconds || 10.0);
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [groupName, setGroupName] = useState(initialData?.group_name || "lab");
  const [orderIndex, setOrderIndex] = useState(initialData?.order_index || 0);

  const [testInputValue, setTestInputValue] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<RequestLog | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [inspectorLog, setInspectorLog] = useState<RequestLog | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleApplyRaw = (parsed: ParsedTemplateFields) => {
    if (parsed.host) setHost(parsed.host);
    if (parsed.path) setPath(parsed.path);
    if (parsed.method) setMethod(parsed.method);
    if (parsed.accept) setAccept(parsed.accept);
    if (parsed.contentType) setContentType(parsed.contentType);
    if (parsed.authorization) setAuthorization(parsed.authorization);
    if (parsed.deviceUuid) setDeviceUuid(parsed.deviceUuid);
    if (parsed.userAgent) setUserAgent(parsed.userAgent);
    if (parsed.acceptLanguage) setAcceptLanguage(parsed.acceptLanguage);
    if (parsed.body) setBody(parsed.body);
    if (parsed.extraHeaders && Object.keys(parsed.extraHeaders).length > 0) {
      setExtraHeadersText(JSON.stringify(parsed.extraHeaders, null, 2));
    }
    if (!name.trim()) {
      setName(parsed.host ? `${parsed.host} (${parsed.path})` : "Yoklama Doğrulama İsteği");
    }
  };

  const generateRandomUuid = () => {
    try {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        setDeviceUuid(crypto.randomUUID());
        return;
      }
    } catch {
      // fallback
    }
    setDeviceUuid("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }));
  };

  const parseExtraHeaders = (): Record<string, string> => {
    if (!extraHeadersText.trim()) return {};
    const parsed = JSON.parse(extraHeadersText);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Ek header alanı geçerli bir JSON nesnesi olmalıdır.");
    }
    return parsed;
  };

  const buildPayload = (): TemplateCreateInput => {
    const extraHeaders = parseExtraHeaders();
    const url = buildRequestUrl(host, path);
    const headers = composeRequestHeaders({
      method,
      host,
      path,
      accept,
      contentType,
      authorization,
      deviceUuid,
      userAgent,
      acceptLanguage,
      extraHeaders,
    });

    return {
      name,
      description,
      method,
      url,
      headers,
      body_type: "json",
      body: body.trim() ? body : DEFAULT_BODY,
      query_params: {},
      timeout_seconds: Number(timeoutSeconds),
      is_active: isActive,
      group_name: groupName,
      order_index: Number(orderIndex),
    };
  };

  const handlePreview = async () => {
    try {
      setFormError(null);
      const payload = buildPayload();
      const res = await api.previewTemplate(payload, testInputValue || "ORNEK_QR_TOKEN");
      setPreviewData(res);
    } catch (err: any) {
      setFormError(err.message || err.response?.data?.detail || "Önizleme oluşturulamadı.");
    }
  };

  const handleTest = async () => {
    try {
      setFormError(null);
      setTestLoading(true);
      setTestResult(null);
      if (!isEdit || !initialData?.id) {
        setFormError("Canlı test için önce bu isteği kaydedin.");
        return;
      }
      if (!testInputValue.trim()) {
        setFormError("Test için bir QR token girin.");
        return;
      }
      const res = await api.testTemplate(initialData.id, testInputValue.trim());
      setTestResult(res);
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

    try {
      const payload = buildPayload();
      if (isEdit && initialData?.id) {
        await api.updateTemplate(initialData.id, payload);
      } else {
        await api.createTemplate(payload);
      }
      router.push("/templates");
    } catch (err: any) {
      setFormError(
        err.message || err.response?.data?.detail || "İstek kaydedilirken bir hata oluştu."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/templates"
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {isEdit ? "Lab isteğini düzenle" : "Yeni lab isteği"}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Her kayıt bir cihaz/istek. QR okutulunca aynı token tüm aktif isteklere gider.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-semibold text-xs border border-blue-200 dark:border-blue-900 transition flex items-center space-x-1.5 shadow-sm"
          >
            <FileCode className="w-4 h-4" />
            <span>Raw HTTP / cURL İçe Aktar</span>
          </button>
        </div>
      </div>

      {formError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center space-x-3 text-rose-700 dark:text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  İstek adı *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="örn: iPhone lab cihaz 1"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Grup
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="lab"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Not (opsiyonel)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Bu cihazın User-Agent ve UUID değerleri"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Method + Host + Path *
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full sm:w-28 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="Host (ör. lab-api.example.com)"
                  className={monoClass}
                />
                <input
                  type="text"
                  required
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/api/attendance/verify"
                  className={monoClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Authorization *
                </label>
                <input
                  type="text"
                  required
                  value={authorization}
                  onChange={(e) => setAuthorization(e.target.value)}
                  placeholder="Bearer eyJhbGciOi..."
                  className={monoClass}
                />
                <p className="text-[11px] text-zinc-400 mt-1">Sadece token yazarsanız başına Bearer eklenir.</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    X-Device-Uuid *
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomUuid}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1 font-medium"
                    title="Yeni benzersiz UUID4 üret"
                  >
                    <Dices className="w-3 h-3" />
                    <span>Rastgele Üret</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={deviceUuid}
                  onChange={(e) => setDeviceUuid(e.target.value)}
                  placeholder="cihaz UUID"
                  className={monoClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                User-Agent *
              </label>
              <input
                type="text"
                required
                value={userAgent}
                onChange={(e) => setUserAgent(e.target.value)}
                placeholder={DEFAULT_USER_AGENT}
                className={monoClass}
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Lab farklı cihazlarda farklı üretir; her istek kaydına o cihazın değerini yazın. API en azından denemeapp/2 bekler.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Accept
                </label>
                <input type="text" value={accept} onChange={(e) => setAccept(e.target.value)} className={monoClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Content-Type
                </label>
                <input
                  type="text"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className={monoClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Accept-Language
                </label>
                <input
                  type="text"
                  value={acceptLanguage}
                  onChange={(e) => setAcceptLanguage(e.target.value)}
                  className={monoClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Body (qr_token tarama anında doldurulur)
              </label>
              <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} className={`${monoClass} bg-zinc-950 text-zinc-100`} />
              <p className="text-[11px] text-zinc-400 mt-1">
                Gönderimde body her zaman taranan QR ile <code className="font-mono">{"{"}&quot;qr_token&quot;:&quot;...&quot;{"}"}</code> alır. Content-Length otomatik hesaplanır.
              </p>
            </div>

            <details className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <summary className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 cursor-pointer">
                Ek header JSON (opsiyonel)
              </summary>
              <textarea
                rows={4}
                value={extraHeadersText}
                onChange={(e) => setExtraHeadersText(e.target.value)}
                className={`${monoClass} mt-2 bg-zinc-950 text-zinc-100`}
              />
            </details>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Timeout (sn)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Sıra
                </label>
                <input
                  type="number"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                  className={inputClass}
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
                <label htmlFor="isActiveToggle" className="text-sm font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  QR taramasında gönder
                </label>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end space-x-3">
              <Link href="/templates" className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                İptal
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow transition flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Kaydediliyor..." : isEdit ? "Güncelle" : "İsteği kaydet"}</span>
              </button>
            </div>
          </div>
        </form>

        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-zinc-900 dark:text-zinc-100 font-bold text-sm">
              <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Bu isteği dene</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Örnek qr_token
              </label>
              <input
                type="text"
                value={testInputValue}
                onChange={(e) => setTestInputValue(e.target.value)}
                placeholder="Lab QR içeriği"
                className={monoClass}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePreview}
                className="flex-1 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center justify-center space-x-1 transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Önizle</span>
              </button>
              {isEdit && initialData?.id && (
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testLoading}
                  className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center space-x-1 shadow transition disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{testLoading ? "Gönderiliyor..." : "Gönder"}</span>
                </button>
              )}
            </div>
            {previewData && (
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-2 text-xs font-mono">
                <div>
                  <span className="text-amber-400 font-bold">{previewData.method}</span>{" "}
                  <span className="text-zinc-300 break-all">{previewData.url}</span>
                </div>
                {previewData.body && (
                  <pre className="text-zinc-200 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                    {previewData.body}
                  </pre>
                )}
              </div>
            )}
            {testResult && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <StatusBadge statusCode={testResult.response_status_code} />
                    <span className="text-xs font-mono text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {testResult.response_time_ms} ms
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectorLog(testResult)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    Detay
                  </button>
                </div>
                {testResult.error_message && (
                  <p className="text-xs text-rose-500 font-mono break-all">{testResult.error_message}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {inspectorLog && <ResponseInspectorModal log={inspectorLog} onClose={() => setInspectorLog(null)} />}

      <RawHttpImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onApply={handleApplyRaw}
      />
    </div>
  );
};
