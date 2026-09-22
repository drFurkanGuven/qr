"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Edit2,
  Key,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { StudentProfile, StudentProfileCreateInput } from "@/lib/types";

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<StudentProfileCreateInput>({
    student_no: "",
    password: "",
    device_uuid: "",
    full_name: "",
    group_tag: "tubitak_ekip",
    is_active: true,
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ id: string; msg: string; success: boolean } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      const data = await api.getProfiles(selectedGroup);
      setProfiles(data);
    } catch {
      setErrorMsg("Profiller yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      student_no: "",
      password: "",
      device_uuid: crypto.randomUUID ? crypto.randomUUID() : "e1c2d3a4-0000-4a5b-8c9d-000000000000",
      full_name: "",
      group_tag: "tubitak_ekip",
      is_active: true,
    });
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: StudentProfile) => {
    setEditingId(p.id);
    setFormData({
      student_no: p.student_no,
      password: "", // Şifre boş bırakılırsa değişmez
      device_uuid: p.device_uuid,
      full_name: p.full_name,
      group_tag: p.group_tag,
      is_active: p.is_active,
    });
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      if (editingId) {
        await api.updateProfile(editingId, formData);
      } else {
        await api.createProfile(formData);
      }
      setModalOpen(false);
      await fetchProfiles();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Kayıt işlemi başarısız.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${name} profilini silmek istediğinize emin misiniz?`)) return;
    try {
      await api.deleteProfile(id);
      await fetchProfiles();
    } catch {
      alert("Silme işlemi başarısız.");
    }
  };

  const handleTestAuth = async (id: string) => {
    setTestingId(id);
    setTestStatus(null);
    try {
      const res = await api.testProfileAuth(id);
      setTestStatus({ id, msg: res.message, success: res.success });
      await fetchProfiles();
    } catch (err: any) {
      setTestStatus({
        id,
        msg: err.response?.data?.detail || "Bağlantı hatası",
        success: false,
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-rose-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Öğrenci Profilleri Yönetimi
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Tek bir QR taraması ile aynı anda yoklaması gönderilecek TÜBİTAK ve dekanlık ekibi öğrenci bilgileri.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Yeni Öğrenci Ekle</span>
        </button>
      </div>

      {/* Global Status Message */}
      {testStatus && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            testStatus.success
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          {testStatus.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{testStatus.msg}</span>
        </div>
      )}

      {/* Table Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Kayıtlı Öğrenci Listesi ({profiles.length})
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            Aktif: {profiles.filter((p) => p.is_active).length} kişi
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <RefreshCw className="w-6 h-6 animate-spin text-rose-600" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            Henüz öğrenci profili eklenmemiş. Yukarıdaki &quot;Yeni Öğrenci Ekle&quot; butonuyla ekleyebilirsiniz.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Öğrenci No</th>
                  <th className="py-2.5 px-3">Adı Soyadı</th>
                  <th className="py-2.5 px-3">Device UUID</th>
                  <th className="py-2.5 px-3">Grup</th>
                  <th className="py-2.5 px-3">Durum</th>
                  <th className="py-2.5 px-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono">
                {profiles.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="py-3 px-3 text-zinc-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-bold text-zinc-900 dark:text-zinc-100">
                      {p.student_no}
                    </td>
                    <td className="py-3 px-3 font-sans font-medium text-zinc-800 dark:text-zinc-200">
                      {p.full_name}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-zinc-500 max-w-[180px] truncate" title={p.device_uuid}>
                      {p.device_uuid}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {p.group_tag}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {p.is_active ? (
                        <span className="text-emerald-600 font-sans font-semibold">● Aktif</span>
                      ) : (
                        <span className="text-zinc-400 font-sans">○ Pasif</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5 font-sans">
                      <button
                        onClick={() => handleTestAuth(p.id)}
                        disabled={testingId === p.id}
                        className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors"
                        title="Fırat CAS girişini test et"
                      >
                        {testingId === p.id ? "Test..." : "Giriş Testi"}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        title="Düzenle"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.full_name)}
                        className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                {editingId ? "Öğrenci Profilini Düzenle" : "Yeni Öğrenci Profili Ekle"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900">
                {errorMsg}
              </p>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Öğrenci Numarası (Kullanıcı Adı)
                </label>
                <input
                  type="text"
                  required
                  value={formData.student_no}
                  onChange={(e) => setFormData({ ...formData, student_no: e.target.value })}
                  placeholder="Örn: 210101001"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Fırat CAS Parolası {editingId && "(Değiştirmek istemiyorsanız boş bırakın)"}
                </label>
                <input
                  type="password"
                  required={!editingId}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingId ? "••••••••" : "CAS Giriş Parolası"}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Telefon Device UUID (X-Device-UUID)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.device_uuid}
                    onChange={(e) => setFormData({ ...formData, device_uuid: e.target.value })}
                    placeholder="Örn: e1c2d3a4-1234-4a5b-8c9d-..."
                    className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        device_uuid: crypto.randomUUID ? crypto.randomUUID() : "e1c2d3a4-0000-4a5b-8c9d-000000000000",
                      })
                    }
                    className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-lg text-[10px] font-semibold"
                    title="Rastgele UUID üret"
                  >
                    Üret
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Adı Soyadı (Etiket)
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Örn: Ahmet Yılmaz (TÜBİTAK 1)"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Grup Etiketi
                </label>
                <input
                  type="text"
                  value={formData.group_tag}
                  onChange={(e) => setFormData({ ...formData, group_tag: e.target.value })}
                  placeholder="Örn: tubitak_ekip"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="is_active" className="text-zinc-700 dark:text-zinc-300 font-medium">
                  Yoklama gönderiminde aktif olsun
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
