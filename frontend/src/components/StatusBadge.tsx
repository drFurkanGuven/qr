import React from "react";

interface StatusBadgeProps {
  statusCode?: number | null;
  isSuccess?: boolean;
  statusText?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  statusCode,
  isSuccess,
  statusText,
  className = "",
}) => {
  if (statusText) {
    let color = "bg-gray-100 text-gray-800 border-gray-200";
    if (statusText === "completed") {
      color = "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else if (statusText === "partial_failure") {
      color = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (statusText === "failed") {
      color = "bg-rose-50 text-rose-700 border-rose-200";
    } else if (statusText === "running") {
      color = "bg-blue-50 text-blue-700 border-blue-200 animate-pulse";
    }

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color} ${className}`}
      >
        {statusText.toUpperCase().replace("_", " ")}
      </span>
    );
  }

  if (statusCode === null || statusCode === undefined) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 ${className}`}
      >
        ERR
      </span>
    );
  }

  let colorClass = "bg-gray-100 text-gray-700 border-gray-300";
  if (statusCode >= 200 && statusCode < 300) {
    colorClass = "bg-emerald-50 text-emerald-700 border-emerald-300";
  } else if (statusCode >= 300 && statusCode < 400) {
    colorClass = "bg-blue-50 text-blue-700 border-blue-300";
  } else if (statusCode >= 400 && statusCode < 500) {
    colorClass = "bg-amber-50 text-amber-700 border-amber-300";
  } else if (statusCode >= 500) {
    colorClass = "bg-rose-50 text-rose-700 border-rose-300";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${colorClass} ${className}`}
    >
      {statusCode}
    </span>
  );
};
