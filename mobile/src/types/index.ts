export interface StudentAccount {
  id: string;
  student_no: string;
  full_name: string;
  device_uuid: string;
  token: string;
  is_active: boolean;
  created_at: string;
}

export interface VerifyResult {
  student_no: string;
  full_name: string;
  device_uuid: string;
  success: boolean;
  status_code: number;
  message: string;
  response_data?: any;
  duration_ms: number;
}

export interface FıratUser {
  id?: number | string;
  name?: string;
  username?: string;
  email?: string;
  student_no?: string;
  department?: string;
  faculty?: string;
}

export interface AttendanceShowResult {
  status: boolean;
  data?: any;
  message?: string;
}
