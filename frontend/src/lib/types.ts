export interface StudentProfile {
  id: string;
  student_no: string;
  full_name: string;
  device_uuid: string;
  group_tag: string;
  is_active: boolean;
  has_valid_token: boolean;
  cached_token?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentProfileCreateInput {
  student_no: string;
  password?: string;
  device_uuid: string;
  full_name: string;
  group_tag?: string;
  is_active?: boolean;
  cached_token?: string;
}

export interface StudentVerifyResult {
  profile_id: string;
  student_no: string;
  full_name: string;
  device_uuid: string;
  status_code: number;
  success: boolean;
  message: string;
  response_data?: any;
  response_time_ms: number;
}

export interface BatchDispatchResponse {
  success: boolean;
  batch_job_id: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  results: StudentVerifyResult[];
}

export interface BatchHistoryItem {
  id: string;
  qr_token_preview: string;
  group_tag: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  created_at: string;
  results?: StudentVerifyResult[];
}
