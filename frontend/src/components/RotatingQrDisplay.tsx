"use client";

import React, { useEffect, useRef } from "react";
import { BrowserQRCodeSvgWriter } from "@zxing/library";

interface RotatingQrDisplayProps {
  qrToken: string;
  secondsRemaining: number;
  totalSeconds?: number;
  size?: number;
}

export const RotatingQrDisplay: React.FC<RotatingQrDisplayProps> = ({
  qrToken,
  secondsRemaining,
  totalSeconds = 30,
  size = 320,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !qrToken) return;

    try {
      containerRef.current.innerHTML = "";
      const writer = new BrowserQRCodeSvgWriter();
      const svg = writer.write(qrToken, size, size);
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("class", "w-full h-full rounded-xl bg-white p-2");
      containerRef.current.appendChild(svg);
    } catch (e) {
      console.error("SVG QR render error:", e);
    }
  }, [qrToken, size]);

  const percentage = Math.max(0, Math.min(100, (secondsRemaining / totalSeconds) * 100));

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-zinc-950 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-sm sm:max-w-md w-full mx-auto">
      {/* Dynamic QR Container */}
      <div
        ref={containerRef}
        style={{ width: size, height: size }}
        className="aspect-square w-full max-w-[340px] flex items-center justify-center bg-white rounded-xl shadow-inner overflow-hidden"
      />

      {/* Rotation Countdown Bar */}
      <div className="w-full mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Dinamik QR Kod (30s)</span>
          </span>
          <span className="font-mono text-rose-600 dark:text-rose-400">
            {secondsRemaining}s kaldı
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear rounded-full ${
              secondsRemaining <= 5
                ? "bg-rose-500"
                : secondsRemaining <= 10
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};
