"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Camera,
  AlertCircle,
  RefreshCw,
  Flashlight,
  FlashlightOff,
  ImageUp,
  Aperture,
  ZoomIn,
} from "lucide-react";
import { decodeQrFromBlob, decodeQrFromVideo } from "@/lib/qrDecode";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const rafRef = useRef<number>(0);
  const busyRef = useRef(false);
  const lastAttemptRef = useRef(0);
  const onSuccessRef = useRef(onScanSuccess);
  const onCloseRef = useRef(onClose);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [statusText, setStatusText] = useState("Kamera açılıyor…");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [capturing, setCapturing] = useState(false);

  onSuccessRef.current = onScanSuccess;
  onCloseRef.current = onClose;

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    trackRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleDecoded = useCallback((text: string) => {
    if (!text) return;
    if (navigator.vibrate) {
      navigator.vibrate(80);
    }
    stopCamera();
    onSuccessRef.current(text);
    onCloseRef.current();
  }, [stopCamera]);

  const applyZoom = useCallback(async (value: number) => {
    const track = trackRef.current;
    if (!track || !zoomRange) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] });
      setZoom(value);
    } catch {
      // zoom not actually writable on this device
    }
  }, [zoomRange]);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  const snapshotDecode = useCallback(async () => {
    const video = videoRef.current;
    const track = trackRef.current;
    if (!video) return;
    setCapturing(true);
    setStatusText("Yüksek çözünürlükte okunuyor…");
    setErrorMsg(null);
    try {
      // 1. Try ImageCapture for full sensor resolution (e.g. 12MP/48MP camera photo)
      if (typeof window !== "undefined" && "ImageCapture" in window && track) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const imageCapture = new (window as any).ImageCapture(track);
          const photoBlob: Blob = await imageCapture.takePhoto();
          const text = await decodeQrFromBlob(photoBlob);
          if (text) {
            handleDecoded(text);
            return;
          }
        } catch {
          // Fallback to video frame if takePhoto not supported on this track
        }
      }

      // 2. Video frame high-res decode
      const text = await decodeQrFromVideo(video, true);
      if (text) {
        handleDecoded(text);
        return;
      }
      setErrorMsg("Bu karede kod çözülemedi. Yaklaşın, zoom kullanın veya net bir fotoğraf seçin.");
      setStatusText("Tahtayı kadraja alın — canlı tarama devam ediyor");
    } catch {
      setErrorMsg("Görüntü işlenirken bir hata oluştu.");
    } finally {
      setCapturing(false);
    }
  }, [handleDecoded]);

  const onFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setCapturing(true);
    setStatusText("Fotoğraf çözülüyor…");
    setErrorMsg(null);
    try {
      const text = await decodeQrFromBlob(file);
      if (text) {
        handleDecoded(text);
        return;
      }
      setErrorMsg("Fotoğrafta QR bulunamadı. Tahtayı daha yakından, düz ve parlamasız çekmeyi deneyin.");
      setStatusText("Tekrar deneyin veya kamerayla tarayın");
    } catch {
      setErrorMsg("Fotoğraf okunamadı.");
    } finally {
      setCapturing(false);
    }
  }, [handleDecoded]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let cancelled = false;
    setIsStarting(true);
    setErrorMsg(null);
    setTorchOn(false);
    setStatusText("Kamera açılıyor…");

    const start = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: "environment" } },
          });
        }
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const track = stream.getVideoTracks()[0] || null;
        trackRef.current = track;

        if (track) {
          const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number; step?: number } };
          setTorchSupported(Boolean(caps.torch));
          if (caps.zoom && caps.zoom.max > caps.zoom.min) {
            setZoomRange({
              min: caps.zoom.min,
              max: caps.zoom.max,
              step: caps.zoom.step || 0.1,
            });
            const mid = Math.min(caps.zoom.max, Math.max(caps.zoom.min, caps.zoom.min + (caps.zoom.max - caps.zoom.min) * 0.25));
            await track.applyConstraints({ advanced: [{ zoom: mid } as MediaTrackConstraintSet] }).catch(() => undefined);
            setZoom(mid);
          } else {
            setZoomRange(null);
          }

          try {
            await track.applyConstraints({
              advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
            });
          } catch {
            // not all browsers expose focusMode
          }
        }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setIsStarting(false);
        setStatusText("Tahtadaki QR’ı kadraja alın");

        const loop = async (now: number) => {
          if (cancelled) return;
          rafRef.current = requestAnimationFrame(loop);
          if (busyRef.current) return;
          if (now - lastAttemptRef.current < 140) return;
          lastAttemptRef.current = now;
          const currentVideo = videoRef.current;
          if (!currentVideo || currentVideo.readyState < 2) return;

          busyRef.current = true;
          try {
            const text = await decodeQrFromVideo(currentVideo, false);
            if (text && !cancelled) {
              handleDecoded(text);
            }
          } catch {
            // keep scanning
          } finally {
            busyRef.current = false;
          }
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        console.error("Camera access error:", err);
        setIsStarting(false);
        setErrorMsg("Kamera erişimi başlatılamadı. İzin verin veya aşağıdan fotoğraf seçin.");
        setStatusText("Kamerasız da fotoğraftan okuyabilirsiniz");
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, handleDecoded, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Tahta QR Tarayıcı
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col bg-zinc-950 overflow-y-auto">
          <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-[3/4] sm:aspect-video">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <div className="pointer-events-none absolute inset-6 border-2 border-blue-400/70 rounded-lg shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.12)]" />
            {isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 text-sm bg-black/40">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                <span>Kamera başlatılıyor...</span>
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-300 mt-3 text-center">{statusText}</p>
          <p className="text-[11px] text-zinc-500 mt-1 text-center leading-relaxed">
            Yoğun ders QR’ları için kodu kadrajın büyük kısmına alın. Canlı okumazsa
            “Anlık oku” veya galeriden net bir fotoğraf kullanın.
          </p>

          {zoomRange && (
            <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
              <ZoomIn className="w-4 h-4 shrink-0" />
              <span>Zoom</span>
              <input
                type="range"
                min={zoomRange.min}
                max={zoomRange.max}
                step={zoomRange.step}
                value={zoom}
                onChange={(e) => void applyZoom(Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
            </label>
          )}

          {errorMsg && (
            <div className="mt-3 w-full p-3 bg-rose-950/60 border border-rose-900 rounded-lg flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void snapshotDecode()}
              disabled={capturing || isStarting}
              className="col-span-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {capturing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Aperture className="w-4 h-4" />}
              Anlık Çek ve Oku (HD)
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={capturing}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <ImageUp className="w-4 h-4" />
              Fotoğraf / Galeri
            </button>
            <button
              type="button"
              onClick={() => void toggleTorch()}
              disabled={!torchSupported}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {torchOn ? <Flashlight className="w-4 h-4 text-amber-300" /> : <FlashlightOff className="w-4 h-4" />}
              {torchOn ? "Flaş Açık" : "Flaş"}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFileSelected(e)}
          />
        </div>

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
