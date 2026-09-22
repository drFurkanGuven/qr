import axios from "axios";
import {
  UserMeResponse,
  Course,
  CourseSession,
  RotatingQrData,
  VerifyAttendanceResponse,
  AttendanceShowResponse,
  MyAttendanceRecord,
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
  withCredentials: true, // httpOnly Secure çerezlerin taşınması için zorunlu
  timeout: 30000,
});

export const api = {
  // Kimlik Doğrulama
  getMe: async (): Promise<UserMeResponse> => {
    const res = await apiClient.get<UserMeResponse>("/auth/me");
    return res.data;
  },

  loginWithCasTicket: async (ticket: string) => {
    const res = await apiClient.get(`/auth/cas/callback`, {
      params: { ticket },
    });
    return res.data;
  },

  logout: async () => {
    const res = await apiClient.post("/auth/logout");
    return res.data;
  },

  // Dersler
  getCourses: async (): Promise<Course[]> => {
    const res = await apiClient.get<Course[]>("/courses");
    return res.data;
  },

  // Yoklama İşlemleri (Öğretim Görevlisi)
  createSession: async (courseId: string, durationMinutes: number): Promise<CourseSession> => {
    const res = await apiClient.post<CourseSession>("/attendance/sessions", {
      course_id: courseId,
      duration_minutes: durationMinutes,
    });
    return res.data;
  },

  getRotatingQr: async (sessionId: string): Promise<RotatingQrData> => {
    const res = await apiClient.get<RotatingQrData>(`/attendance/sessions/${sessionId}/qr`);
    return res.data;
  },

  closeSession: async (sessionId: string) => {
    const res = await apiClient.post(`/attendance/sessions/${sessionId}/close`);
    return res.data;
  },

  getSessionRecords: async (sessionId: string): Promise<AttendanceShowResponse> => {
    const res = await apiClient.get<AttendanceShowResponse>(`/attendance/sessions/${sessionId}/records`);
    return res.data;
  },

  // Yoklama Doğrulama (Öğrenci)
  verifyAttendance: async (
    qrToken: string,
    idempotencyKey?: string
  ): Promise<VerifyAttendanceResponse> => {
    const res = await apiClient.post<VerifyAttendanceResponse>("/attendance/verify", {
      qr_token: qrToken,
      idempotency_key: idempotencyKey,
    });
    return res.data;
  },

  getMyRecords: async (): Promise<{ success: boolean; records: MyAttendanceRecord[] }> => {
    const res = await apiClient.get<{ success: boolean; records: MyAttendanceRecord[] }>("/attendance/my-records");
    return res.data;
  },
};
