export type UserRole = "student" | "instructor" | "admin";

export interface User {
  id: string;
  university_student_id?: string;
  cas_subject: string;
  email: string;
  full_name: string;
  role: UserRole;
}

export interface EnrolledCourse {
  course_id: string;
  course_code: string;
  name: string;
}

export interface UserMeResponse {
  success: boolean;
  user: User;
  enrolled_courses: EnrolledCourse[];
}

export interface Course {
  id: string;
  course_code: string;
  name: string;
  academic_semester: string;
  instructor_name?: string;
}

export interface CourseSession {
  id: string;
  course_id: string;
  course_code?: string;
  course_name?: string;
  started_at: string;
  expires_at: string;
  status: "active" | "closed" | "expired";
}

export interface RotatingQrData {
  success: boolean;
  session_id: string;
  qr_token: string;
  raw_data: {
    session_id: string;
    nonce: string;
    expires_at: number;
    signature: string;
  };
  seconds_remaining: number;
}

export interface AttendanceVerifiedRecord {
  id: string;
  course_code: string;
  course_name: string;
  verified_at: string;
}

export interface VerifyAttendanceResponse {
  success: boolean;
  status: "VERIFIED" | "ALREADY_VERIFIED" | "REJECTED";
  message: string;
  record?: AttendanceVerifiedRecord;
}

export interface AttendanceRecordItem {
  id: string;
  university_student_id?: string;
  full_name: string;
  verified_at: string;
}

export interface AttendanceShowResponse {
  success: boolean;
  session_id: string;
  course_code: string;
  total_count: number;
  records: AttendanceRecordItem[];
}

export interface MyAttendanceRecord {
  id: string;
  course_code: string;
  course_name: string;
  verified_at: string;
  status: string;
}

// 8 Belirlenmiş Kullanıcı Durumu
export type VerificationStatus =
  | "IDLE"
  | "SCANNING"
  | "VERIFYING"
  | "VERIFIED"
  | "QR_EXPIRED"
  | "NOT_ENROLLED"
  | "DUPLICATE"
  | "UNAUTHORIZED_DEVICE"
  | "SERVER_ERROR";
