export interface RequestTemplate {
  id: string;
  name: string;
  description?: string | null;
  method: string;
  url: string;
  headers: Record<string, any>;
  body_type: string;
  body?: string | null;
  query_params: Record<string, any>;
  timeout_seconds: number;
  is_active: boolean;
  group_name: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateCreateInput {
  name: string;
  description?: string;
  method: string;
  url: string;
  headers: Record<string, any>;
  body_type: string;
  body?: string;
  query_params: Record<string, any>;
  timeout_seconds: number;
  is_active: boolean;
  group_name: string;
  order_index: number;
}

export interface RequestLog {
  id: string;
  batch_run_id: string;
  template_id?: string | null;
  template_name: string;
  request_url: string;
  request_method: string;
  request_headers: Record<string, any>;
  request_body?: string | null;
  response_status_code?: number | null;
  response_headers?: Record<string, any> | null;
  response_body?: string | null;
  response_time_ms: number;
  is_success: boolean;
  error_message?: string | null;
  created_at: string;
}

export interface BatchRun {
  id: string;
  input_value: string;
  input_type: string;
  execution_mode: "concurrent" | "sequential";
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_duration_ms: number;
  status: "running" | "completed" | "partial_failure" | "failed";
  created_at: string;
  logs?: RequestLog[];
}

export interface BatchExecutionPayload {
  input_value: string;
  input_type?: string;
  execution_mode: "concurrent" | "sequential";
  template_ids?: string[];
  custom_variables?: Record<string, string>;
  delay_ms_between_requests?: number;
}

export interface BatchExecutionResponse {
  batch_run_id: string;
  input_value: string;
  execution_mode: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_duration_ms: number;
  status: string;
  results: RequestLog[];
}

export interface DashboardStats {
  total_batch_runs: number;
  total_requests_executed: number;
  successful_requests: number;
  failed_requests: number;
  overall_success_rate_pct: number;
  average_latency_ms: number;
  total_templates: number;
  active_templates: number;
}

export interface TemplatePreviewResponse {
  url: string;
  method: string;
  headers: Record<string, any>;
  body?: string | null;
  query_params: Record<string, any>;
}

export interface AdminLoginResponse {
  token: string;
  token_type: string;
  expires_in: number;
}

export interface AdminVerifyResponse {
  valid: boolean;
  is_admin: boolean;
}
