"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TemplateForm } from "@/components/TemplateForm";
import { AdminGate } from "@/components/AdminGate";
import { api } from "@/lib/api";
import { RequestTemplate } from "@/lib/types";

function NewTemplateContent() {
  const searchParams = useSearchParams();
  const cloneId = searchParams.get("clone");
  const [cloneSource, setCloneSource] = useState<RequestTemplate | null>(null);
  const [loadingClone, setLoadingClone] = useState(!!cloneId);

  useEffect(() => {
    if (!cloneId) return;
    let cancelled = false;
    const loadClone = async () => {
      try {
        const tpl = await api.getTemplate(cloneId);
        if (cancelled) return;
        // Klonlanan profilin adına "(kopya)" ekle; kullanıcı Authorization/X-Device-Uuid gibi alanları değiştirip kaydedecek.
        setCloneSource({ ...tpl, name: `${tpl.name} (kopya)` });
      } catch {
        // Kaynak bulunamadıysa boş form aç
      } finally {
        if (!cancelled) setLoadingClone(false);
      }
    };
    loadClone();
    return () => {
      cancelled = true;
    };
  }, [cloneId]);

  return (
    <AdminGate>
      {loadingClone ? (
        <div className="py-20 text-center text-sm text-zinc-400">
          Klonlanacak profil yükleniyor...
        </div>
      ) : (
        <TemplateForm key={cloneId || "new"} initialData={cloneSource || undefined} isEdit={false} />
      )}
    </AdminGate>
  );
}

export default function NewTemplatePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-zinc-400">Yükleniyor...</div>}>
      <NewTemplateContent />
    </Suspense>
  );
}