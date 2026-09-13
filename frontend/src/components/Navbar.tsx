"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  PlayCircle,
  FileCode2,
  History,
  Activity,
  Server,
} from "lucide-react";
import axios from "axios";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    // Check backend health periodically
    const checkHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
        await axios.get(`${apiUrl}/health`, { timeout: 3000 });
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 20000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { label: "Dashboard", href: "/", icon: Activity },
    { label: "Şablon Yönetimi", href: "/templates", icon: FileCode2 },
    { label: "Toplu Çalıştırıcı & QR", href: "/runner", icon: PlayCircle },
    { label: "Geçmiş & Loglar", href: "/history", icon: History },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo / Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <Link href="/" className="font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-1.5">
              <span>API Automation</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono font-medium">
                v1.0
              </span>
            </Link>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Backend Status Badge */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 text-xs font-medium bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
            <Server className="w-3.5 h-3.5" />
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline === true
                  ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                  : backendOnline === false
                  ? "bg-rose-500 ring-2 ring-rose-500/20"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="hidden sm:inline font-mono">
              {backendOnline === true ? "Online" : backendOnline === false ? "Offline" : "Connecting"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
