"use client";

import React, { useEffect, useState } from "react";
import {
  Camera,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Sparkles,
  Sliders,
  Download,
  Eye,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { BatchExecutionResponse, RequestLog, RequestTemplate } from "@/lib/types";
import { QrScannerModal } from "@/components/QrScannerModal";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponseInspectorModal } from "@/components/ResponseInspectorModal";

export default function RunnerPage() {
  const [templates, setTemplates] = useState<RequestTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Input & execution controls
  const [inputValue, setInputValue] = useState("");
  const [inputType, setInputType] = useState<"qr_camera" | "manual_text">("manual_text");
  const [executionMode, setExecutionMode] = useState<"concurrent" | "sequential">("concurrent");
  const [delayMs, setDelayMs] = useState<number>(0);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [showAdvancedVars, setShowAdvancedVars] = useState(false);
  const [customVars, setCustomVars] = useState<Array<{ key: string; value: string }>>([]);

  // Modals & execution state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastBatchResult, setLastBatchResult] = useState<BatchExecutionResponse | null>(null);
  const [inspectorLog, setInspectorLog] = useState<RequestLog | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Load active templates on mount
  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const data = await api.getTemplates({ is_active: true });
      setTemplates(data);
      // Select all by default
      setSelectedTemplateIds(data.map((t) => t.id));
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const [autoSendOnScan, setAutoSendOnScan] = useState(true);

  const playChime = (isSuccess: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      if (isSuccess) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
      }
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // ignore
    }
  };

  const getResponseSnippet = (bodyStr?: string | null): string | null => {
    if (!bodyStr) return null;
    try {
      const parsed = JSON.parse(bodyStr);
      if (parsed.message) return String(parsed.message);
      if (parsed.detail) return String(parsed.detail);
      if (parsed.error) return String(parsed.error);
      if (parsed.status) return `Durum: ${parsed.status}`;
      return JSON.stringify(parsed);
    } catch {
      return bodyStr.length > 50 ? `${bodyStr.substring(0, 50)}...` : bodyStr;
    }
  };

  const handleSelectAll = () => {
    setSelectedTemplateIds(templates.map((t) => t.id));
  };

  const handleClearSelection = () => {
    setSelectedTemplateIds([]);
  };

  const toggleTemplateSelection = (id: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addCustomVar = () => {
    setCustomVars((prev) => [...prev, { key: "", value: "" }]);
  };

  const updateCustomVar = (index: number, field: "key" | "value", val: string) => {
    setCustomVars((prev) => {
      const copy = [...prev];
      copy[index][field] = val;
      return copy;
    });
  };

  const removeCustomVar = (index: number) => {
    setCustomVars((prev) => prev.filter((_, i) => i !== index));
  };

  const triggerBatch = async (
    targetValue?: string,
    targetType?: "qr_camera" | "manual_text"
  ) => {
    const val = (targetValue !== undefined ? targetValue : inputValue).trim();
    const typ = targetType || inputType;

    if (!val) {
      setErrorBanner("Lütfen bir QR kodu okutun veya metin girdisi yazın.");
      return;
    }
    if (selectedTemplateIds.length === 0) {
      setErrorBanner("Lütfen çalıştırılacak en az bir şablon seçin.");
      return;
    }

    setErrorBanner(null);
    setIsRunning(true);
    setLastBatchResult(null);

    // Prepare custom variables object
    const variablesObj: Record<string, string> = {};
    customVars.forEach((v) => {
      if (v.key.trim()) {
        variablesObj[v.key.trim()] = v.value;
      }
    });

    try {
      const response = await api.runBatch({
        input_value: val,
        input_type: typ,
        execution_mode: executionMode,
        template_ids: selectedTemplateIds,
        custom_variables: variablesObj,
        delay_ms_between_requests: executionMode === "sequential" ? delayMs : 0,
      });
      setLastBatchResult(response);
      playChime(response.successful_requests > 0);
    } catch (err: any) {
      setErrorBanner(err.response?.data?.detail || "Toplu çalıştırma sırasında bir hata oluştu.");
      playChime(false);
    } finally {
      setIsRunning(false);
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    setInputValue(decodedText);
    setInputType("qr_camera");
    if (autoSendOnScan) {
      triggerBatch(decodedText, "qr_camera");
    }
  };

  const handleRunBatch = () => {
    triggerBatch();
  };

  const handleExportJson = () => {
    if (!lastBatchResult) return;
    const blob = new Blob([JSON.stringify(lastBatchResult, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-run-${lastBatchResult.batch_run_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <Play className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Toplu İstek İşleyici & QR Girişi</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            QR okutulunca aynı qr_token, seçili tüm lab isteklerine (farklı cihaz UUID / User-Agent / Bearer) gider.
          </p>
        </div>
      </div>

      {errorBanner && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center space-x-3 text-rose-700 dark:text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Main Grid: Input & Config (Left) vs Results (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Input and Template Selection (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Input Mechanism */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Girdi (aynı qr_token tüm isteklere) *
              </label>
              <span className="text-xs text-zinc-400 font-mono">
                {inputType === "qr_camera" ? "Kamera Girişi" : "Manuel Giriş"}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setInputType("manual_text");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isRunning) {
                    handleRunBatch();
                  }
                }}
                placeholder="QR kodunu okutun veya buraya yapıştırın..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-1.5 shadow transition text-sm font-semibold flex-shrink-0"
                title="Kamerayı Aç"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Kamera</span>
              </button>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="autoSendScanToggle"
                checked={autoSendOnScan}
                onChange={(e) => setAutoSendOnScan(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700"
              />
              <label
                htmlFor="autoSendScanToggle"
                className="text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer font-medium flex items-center space-x-1"
              >
                <span>⚡ QR kamerada okununca otomatik tüm isteklere gönder</span>
              </label>
            </div>

            {/* Advanced Custom Variables Toggle */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAdvancedVars(!showAdvancedVars)}
                className="flex items-center justify-between w-full text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                <span className="flex items-center space-x-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
                  <span>Özel Değişkenler ({customVars.length})</span>
                </span>
                {showAdvancedVars ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdvancedVars && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] text-zinc-400">
                    Şablonlardaki ek yer tutucuları (örn: {`{{token}}`}) ezmek veya doldurmak için anahtar-değer ekleyin:
                  </p>
                  {customVars.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Anahtar (key)"
                        value={item.key}
                        onChange={(e) => updateCustomVar(idx, "key", e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                      />
                      <input
                        type="text"
                        placeholder="Değer (value)"
                        value={item.value}
                        onChange={(e) => updateCustomVar(idx, "value", e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                      />
                      <button
                        type="button"
                        onClick={() => removeCustomVar(idx)}
                        className="text-rose-500 hover:text-rose-700 text-xs px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addCustomVar}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    + Değişken Ekle
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Execution Mode Settings */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
              Çalıştırma Modu
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExecutionMode("concurrent")}
                className={`p-3 rounded-xl border text-left transition ${
                  executionMode === "concurrent"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <p className="text-xs font-bold">Eşzamanlı (Concurrent)</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Tüm istekler paralel gönderilir.</p>
              </button>

              <button
                type="button"
                onClick={() => setExecutionMode("sequential")}
                className={`p-3 rounded-xl border text-left transition ${
                  executionMode === "sequential"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <p className="text-xs font-bold">Sıralı (Sequential)</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Sıra indeksine göre tek tek.</p>
              </button>
            </div>

            {executionMode === "sequential" && (
              <div className="pt-2">
                <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                  <span>İstekler Arası Gecikme:</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{delayMs} ms</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="50"
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Card 3: Template Selector */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Çalıştırılacak Şablonlar ({selectedTemplateIds.length}/{templates.length})
              </label>
              <div className="flex space-x-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Tümü
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-zinc-400 hover:text-zinc-600 hover:underline"
                >
                  Temizle
                </button>
              </div>
            </div>

            {loadingTemplates ? (
              <div className="py-6 text-center text-xs text-zinc-400">Şablonlar yükleniyor...</div>
            ) : templates.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                Aktif şablon bulunamadı. Şablonlar sayfasından şablon ekleyin.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {templates.map((tpl) => {
                  const isSelected = selectedTemplateIds.includes(tpl.id);
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => toggleTemplateSelection(tpl.id)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition ${
                        isSelected
                          ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 text-zinc-900 dark:text-zinc-100"
                          : "border-zinc-200 dark:border-zinc-800/80 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                      }`}
                    >
                      <div className="flex items-center space-x-2 overflow-hidden">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-zinc-300 dark:border-zinc-700"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {tpl.method}
                        </span>
                        <span className="font-medium truncate">{tpl.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 flex-shrink-0 ml-2">
                        {tpl.group_name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Trigger Button */}
          <button
            type="button"
            onClick={handleRunBatch}
            disabled={isRunning || templates.length === 0}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>İstekler Gönderiliyor...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Toplu İstekleri Çalıştır ({selectedTemplateIds.length})</span>
              </>
            )}
          </button>
        </div>

        {/* Right Results: Live Telemetry & Table (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 flex flex-col min-h-[520px]">
            {/* Header / Stats of Execution */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                  Canlı Çalıştırma Sonuçları
                </h3>
              </div>

              {lastBatchResult && (
                <div className="flex items-center space-x-2">
                  <StatusBadge statusText={lastBatchResult.status} />
                  <button
                    onClick={handleExportJson}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs flex items-center space-x-1"
                    title="Sonuçları JSON Olarak İndir"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON İndir</span>
                  </button>
                </div>
              )}
            </div>

            {/* Telemetry Summary Bar */}
            {lastBatchResult && (
              <div className="grid grid-cols-4 gap-2 my-4 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800/80 text-center">
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-medium">Toplam İstek</p>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                    {lastBatchResult.total_requests}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-medium">Başarılı</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    {lastBatchResult.successful_requests}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-medium">Başarısız</p>
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                    {lastBatchResult.failed_requests}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-medium">Toplam Süre</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    {lastBatchResult.total_duration_ms} ms
                  </p>
                </div>
              </div>
            )}

            {/* Results Table */}
            {isRunning ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-zinc-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm font-medium">Seçilen API uç noktalarına istekler iletiliyor...</p>
                <p className="text-xs text-zinc-500">Girdi: {inputValue}</p>
              </div>
            ) : !lastBatchResult ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-zinc-400 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 text-zinc-500">
                  <Play className="w-5 h-5 ml-0.5" />
                </div>
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Henüz İstek Gönderilmedi
                </h4>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  Sol panelden bir QR kodu okutun veya metin girin, ardından "Toplu İstekleri Çalıştır" butonuna tıklayın.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 uppercase font-medium">
                      <th className="pb-2.5">Şablon</th>
                      <th className="pb-2.5">Hedef URL</th>
                      <th className="pb-2.5">Durum</th>
                      <th className="pb-2.5">Gecikme</th>
                      <th className="pb-2.5">Yanıt / Sonuç</th>
                      <th className="pb-2.5 text-right">Eylem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                    {lastBatchResult.results.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition"
                      >
                        <td className="py-3 font-sans font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[130px]">
                          {log.template_name}
                        </td>
                        <td className="py-3 text-zinc-500 text-[11px] truncate max-w-[180px]">
                          {log.request_url}
                        </td>
                        <td className="py-3">
                          <StatusBadge statusCode={log.response_status_code} />
                        </td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-300">
                          {log.response_time_ms} ms
                        </td>
                        <td className="py-3 max-w-[200px]">
                          {log.error_message ? (
                            <span className="text-rose-500 font-mono text-[11px] truncate block" title={log.error_message}>
                              {log.error_message}
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-mono truncate block ${
                                log.is_success
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-amber-600 dark:text-amber-400"
                              }`}
                              title={log.response_body || ""}
                            >
                              {getResponseSnippet(log.response_body) || (log.is_success ? "OK" : "-")}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right font-sans">
                          <button
                            onClick={() => setInspectorLog(log)}
                            className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-blue-600 dark:text-blue-400 font-semibold text-xs transition"
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
        </div>
      </div>

      {/* QR Camera Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      {/* Response / Request Inspector Modal */}
      {inspectorLog && (
        <ResponseInspectorModal
          log={inspectorLog}
          onClose={() => setInspectorLog(null)}
        />
      )}
    </div>
  );
}
