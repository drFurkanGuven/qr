"use client";

import React, { useState } from "react";
import { X, Copy, Check, Terminal, ArrowUpRight, ArrowDownLeft, AlertCircle } from "lucide-react";
import { RequestLog } from "../lib/types";
import { StatusBadge } from "./StatusBadge";

interface ResponseInspectorModalProps {
  log: RequestLog | null;
  onClose: () => void;
}

export const ResponseInspectorModal: React.FC<ResponseInspectorModalProps> = ({
  log,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"response_body" | "response_headers" | "request_body" | "request_headers">("response_body");
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  const formatJsonOrText = (content: any): string => {
    if (!content) return "";
    if (typeof content === "object") {
      try {
        return JSON.stringify(content, null, 2);
      } catch {
        return String(content);
      }
    }
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return String(content);
    }
  };

  const handleCopy = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let currentContent = "";
  if (activeTab === "response_body") {
    currentContent = formatJsonOrText(log.response_body);
  } else if (activeTab === "response_headers") {
    currentContent = formatJsonOrText(log.response_headers);
  } else if (activeTab === "request_body") {
    currentContent = formatJsonOrText(log.request_body);
  } else if (activeTab === "request_headers") {
    currentContent = formatJsonOrText(log.request_headers);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-bold rounded">
              {log.request_method}
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {log.template_name}
            </span>
            <StatusBadge statusCode={log.response_status_code} />
            <span className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
              {log.response_time_ms} ms
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* URL Bar */}
        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-600 dark:text-zinc-300">
          <span className="truncate mr-2">{log.request_url}</span>
          <button
            onClick={() => handleCopy(log.request_url)}
            title="Copy URL"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Error Notice if any */}
        {log.error_message && (
          <div className="mx-4 mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg flex items-start space-x-2 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold">Execution Error: </span>
              {log.error_message}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-4 mt-2 space-x-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab("response_body")}
            className={`py-2 border-b-2 flex items-center space-x-1.5 ${
              activeTab === "response_body"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Response Body</span>
          </button>
          <button
            onClick={() => setActiveTab("response_headers")}
            className={`py-2 border-b-2 flex items-center space-x-1.5 ${
              activeTab === "response_headers"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span>Response Headers</span>
          </button>
          <button
            onClick={() => setActiveTab("request_body")}
            className={`py-2 border-b-2 flex items-center space-x-1.5 ${
              activeTab === "request_body"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Sent Request Body</span>
          </button>
          <button
            onClick={() => setActiveTab("request_headers")}
            className={`py-2 border-b-2 flex items-center space-x-1.5 ${
              activeTab === "request_headers"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span>Sent Request Headers</span>
          </button>
        </div>

        {/* Content Viewer */}
        <div className="p-4 flex-1 overflow-auto bg-zinc-900 text-zinc-100 rounded-b-xl relative font-mono text-xs leading-relaxed">
          <button
            onClick={() => handleCopy(currentContent)}
            className="absolute top-3 right-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded text-xs flex items-center space-x-1 border border-zinc-700 transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
          {currentContent ? (
            <pre className="whitespace-pre-wrap break-all pt-6">{currentContent}</pre>
          ) : (
            <div className="text-zinc-500 italic pt-6">No data / Empty payload</div>
          )}
        </div>
      </div>
    </div>
  );
};
