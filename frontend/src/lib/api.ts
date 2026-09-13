import axios from "axios";
import {
  AdminLoginResponse,
  AdminVerifyResponse,
  BatchExecutionPayload,
  BatchExecutionResponse,
  BatchRun,
  DashboardStats,
  RequestLog,
  RequestTemplate,
  TemplateCreateInput,
  TemplatePreviewResponse,
} from "./types";
import { getAdminToken } from "./admin";

// Base API URL: In browser, uses NEXT_PUBLIC_API_URL or defaults to relative /api/v1 (routed via Next.js rewrite or direct)
const API_BASE_URL =
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "/api/v1";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
});

// Attach admin token to every request when present
apiClient.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers["X-Admin-Token"] = token;
  }
  return config;
});

export const api = {
  // Admin Auth
  adminLogin: async (password: string): Promise<AdminLoginResponse> => {
    const res = await apiClient.post<AdminLoginResponse>("/auth/login", { password });
    return res.data;
  },

  adminVerify: async (): Promise<AdminVerifyResponse> => {
    const res = await apiClient.get<AdminVerifyResponse>("/auth/verify");
    return res.data;
  },

  // Stats
  getStats: async (): Promise<DashboardStats> => {
    const res = await apiClient.get<DashboardStats>("/stats");
    return res.data;
  },

  // Templates
  getTemplates: async (params?: { group?: string; is_active?: boolean }): Promise<RequestTemplate[]> => {
    const res = await apiClient.get<RequestTemplate[]>("/templates", { params });
    return res.data;
  },

  getTemplate: async (id: string): Promise<RequestTemplate> => {
    const res = await apiClient.get<RequestTemplate>(`/templates/${id}`);
    return res.data;
  },

  createTemplate: async (data: TemplateCreateInput): Promise<RequestTemplate> => {
    const res = await apiClient.post<RequestTemplate>("/templates", data);
    return res.data;
  },

  updateTemplate: async (id: string, data: Partial<TemplateCreateInput>): Promise<RequestTemplate> => {
    const res = await apiClient.put<RequestTemplate>(`/templates/${id}`, data);
    return res.data;
  },

  deleteTemplate: async (id: string): Promise<void> => {
    await apiClient.delete(`/templates/${id}`);
  },

  testTemplate: async (
    id: string,
    inputValue: string,
    customVariables?: Record<string, string>
  ): Promise<RequestLog> => {
    const res = await apiClient.post<RequestLog>(`/templates/${id}/test`, {
      input_value: inputValue,
      custom_variables: customVariables || {},
    });
    return res.data;
  },

  previewTemplate: async (
    template: any,
    inputValue: string,
    customVariables?: Record<string, string>
  ): Promise<TemplatePreviewResponse> => {
    const res = await apiClient.post<TemplatePreviewResponse>("/templates/preview", {
      template,
      input_value: inputValue,
      custom_variables: customVariables || {},
    });
    return res.data;
  },

  // Batch
  runBatch: async (payload: BatchExecutionPayload): Promise<BatchExecutionResponse> => {
    const res = await apiClient.post<BatchExecutionResponse>("/batch/run", payload);
    return res.data;
  },

  // History & Executions
  getExecutions: async (params?: { limit?: number; offset?: number; status?: string }): Promise<BatchRun[]> => {
    const res = await apiClient.get<BatchRun[]>("/executions", { params });
    return res.data;
  },

  getExecutionDetail: async (id: string): Promise<BatchRun> => {
    const res = await apiClient.get<BatchRun>(`/executions/${id}`);
    return res.data;
  },

  deleteExecution: async (id: string): Promise<void> => {
    await apiClient.delete(`/executions/${id}`);
  },
};
