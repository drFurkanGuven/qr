"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Camera, AlertCircle, RefreshCw } from "lucide-react";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    let html5QrCode: any = null;

    if (isOpen) {
      setIsStarting(true);
      setErrorMsg(null);

      // Dynamically import html5-qrcode to avoid SSR window is undefined
      import("html5-qrcode").then(({ Html5Qrcode }) => {
        try {
          const qrElementId = "interactive-qr-reader";
          html5QrCode = new Html5Qrcode(qrElementId);
          scannerRef.current = html5QrCode;

          const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          };

          html5QrCode
            .start(
              { facingMode: "environment" },
              config,
              (decodedText: string) => {
                // Audio beep or haptic if supported
                if (navigator.vibrate) {
                  navigator.vibrate(100);
                }
                onScanSuccess(decodedText);
                onClose();
              },
              (errorMessage: string) => {
                // frame scan error (normal while searching for QR)
              }
            )
            .then(() => {
              setIsStarting(false);
            })
            .catch((err: any) => {
              console.error("Camera access error:", err);
              setErrorMsg("Kamera erişimi başlatılamadı veya izin verilmedi.");
              setIsStarting(false);
            });
        } catch (err: any) {
          setErrorMsg("QR tarayıcı başlatılamadı.");
          setIsStarting(false);
        }
      });
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current
            .stop()
            .then(() => {
              scannerRef.current?.clear();
              scannerRef.current = null;
            })
            .catch(() => {
              scannerRef.current?.clear();
              scannerRef.current = null;
            });
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Kamera ile QR Tara
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Scanner Container */}
        <div className="p-4 flex flex-col items-center justify-center bg-zinc-950">
          <div
            id="interactive-qr-reader"
            className="w-full max-w-sm rounded-xl overflow-hidden shadow-inner aspect-square bg-black flex items-center justify-center relative"
          >
            {isStarting && (
              <div className="text-zinc-400 flex flex-col items-center space-y-2 text-sm z-10">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                <span>Kamera başlatılıyor...</span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="mt-3 w-full p-3 bg-rose-950/60 border border-rose-900 rounded-lg flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <p className="text-xs text-zinc-400 mt-3 text-center">
            QR kodunu veya barkodu kameranın hizasına getirin. Kod okunduğunda otomatik olarak forma aktarılacaktır.
          </p>
        </div>

        {/* Footer */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
