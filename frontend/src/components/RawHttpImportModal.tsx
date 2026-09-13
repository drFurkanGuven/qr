"use client";

import React, { useState } from "react";
import { X, FileCode, Sparkles, Check, AlertCircle } from "lucide-react";
import { parseRawHttpOrCurl, ParsedTemplateFields } from "@/lib/httpParser";

interface RawHttpImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (fields: ParsedTemplateFields) => void;
}

const SAMPLE_ATTENDANCE_RAW = `POST /api/attendance/verify HTTP/1.1
Host: api.example.com
Accept: application/json
Content-Type: application/json
Authorization: Bearer sample_jwt_token_here
Content-Length: 32
Accept-Encoding: gzip, deflate, br
X-Device-Uuid: e3b0c442-98fc-1c14-9afb-4c8996fb9242
User-Agent: denemeapp/2 CFNetwork/3860.600.12 Darwin/25.5.0
Priority: u=3, i
Accept-Language: tr-TR,tr;q=0.9
Connection: keep-alive

{"qr_token":"sample_qr_token"}`;

export const RawHttpImportModal: React.FC<RawHttpImportModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!rawText.trim()) {
      setError("Lütfen bir HTTP isteği veya cURL komutu yapıştırın.");
      return;
    }
    try {
      const parsed = parseRawHttpOrCurl(rawText);
      onApply(parsed);
      onClose();
    } catch (err: any) {
      setError("İstek ayrıştırılamadı. Lütfen formatı kontrol edin.");
    }
  };

  const handleLoadSample = () => {
    setRawText(SAMPLE_ATTENDANCE_RAW);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
              Raw HTTP veya cURL İle Doldur
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              Charles, Proxyman, Burp Suite veya DevTools'tan kopyaladığınız isteği yapıştırın:
            </p>
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Örnek Yoklama İsteğini Yükle</span>
            </button>
          </div>

          <textarea
            rows={12}
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setError(null);
            }}
            placeholder={`POST /api/attendance/verify HTTP/1.1\nHost: api.example.com\nAuthorization: Bearer ...\nX-Device-Uuid: ...\n\n{"qr_token":"..."}`}
            className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-950 text-zinc-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center space-x-2 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-[11px] text-zinc-400 space-y-1 bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <p className="font-semibold text-zinc-600 dark:text-zinc-300">Otomatik Yapılacaklar:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Host ve path ayrıştırılıp birleştirilir.</li>
              <li>Authorization, X-Device-Uuid, User-Agent ve Accept alanları forma aktarılır.</li>
              <li>Hop-by-hop headerlar (Content-Length, Connection, Host vb.) temizlenir.</li>
              <li>JSON gövdesindeki qr_token değeri otomatik olarak <code className="text-blue-500">{`{{qr_token}}`}</code> yer tutucusuna dönüştürülür.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow flex items-center space-x-1.5 transition"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Forma Uygula</span>
          </button>
        </div>
      </div>
    </div>
  );
};
