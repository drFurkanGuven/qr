import axios from "axios";
import {
  StudentProfile,
  StudentProfileCreateInput,
  BatchDispatchResponse,
  BatchHistoryItem,
} from "./types";

const API_BASE_URL =
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  timeout: 45000,
});

export const api = {
  // Toplu Yoklama Gönderimi
  dispatchBatch: async (
    qrToken: string,
    groupTag?: string
  ): Promise<BatchDispatchResponse> => {
    const res = await apiClient.post<BatchDispatchResponse>("/batch/dispatch", {
      qr_token: qrToken,
      group_tag: groupTag || undefined,
    });
    return res.data;
  },

  getBatchHistory: async (): Promise<BatchHistoryItem[]> => {
    const res = await apiClient.get<BatchHistoryItem[]>("/batch/history");
    return res.data;
  },

  // Öğrenci Profil Yönetimi
  getProfiles: async (groupTag?: string): Promise<StudentProfile[]> => {
    const res = await apiClient.get<StudentProfile[]>("/profiles", {
      params: groupTag ? { group_tag: groupTag } : undefined,
    });
    return res.data;
  },

  createProfile: async (data: StudentProfileCreateInput): Promise<StudentProfile> => {
    const res = await apiClient.post<StudentProfile>("/profiles", data);
    return res.data;
  },

  updateProfile: async (
    id: string,
    data: Partial<StudentProfileCreateInput>
  ): Promise<StudentProfile> => {
    const res = await apiClient.put<StudentProfile>(`/profiles/${id}`, data);
    return res.data;
  },

  deleteProfile: async (id: string): Promise<void> => {
    await apiClient.delete(`/profiles/${id}`);
  },

  testProfileAuth: async (id: string): Promise<{ success: boolean; message: string; student_no: string }> => {
    const res = await apiClient.post(`/profiles/${id}/test-auth`);
    return res.data;
  },
};
