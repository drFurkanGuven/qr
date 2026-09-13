"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { RequestTemplate } from "@/lib/types";
import { TemplateForm } from "@/components/TemplateForm";
import { AdminGate } from "@/components/AdminGate";

export default function EditTemplatePage() {
  const params = useParams();
  const id = params?.id as string;

  const [template, setTemplate] = useState<RequestTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await api.getTemplate(id);
        setTemplate(data);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Şablon bulunamadı.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  return (
    <AdminGate>
      {loading ? (
        <div className="py-20 text-center text-sm text-zinc-400">Şablon yükleniyor...</div>
      ) : error || !template ? (
        <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-xl border border-rose-200 text-rose-600 text-sm">
          {error || "Şablon bulunamadı"}
        </div>
      ) : (
        <TemplateForm initialData={template} isEdit={true} />
      )}
    </AdminGate>
  );
}
