-- ==============================================================================
-- Yetkili Üniversite Yoklama Sistemi - Veritabanı Şeması (PostgreSQL 16)
-- Dosya Adı: docs/database-schema.sql
-- ==============================================================================

-- UUID uzantısını etkinleştir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. KULLANICILAR (users)
-- Öğrenci, öğretim görevlisi ve sistem yöneticilerini tutar.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_student_id VARCHAR(32) UNIQUE NULL, -- Öğrenci numarası veya personel sicil no
    cas_subject VARCHAR(128) UNIQUE NOT NULL,      -- CAS sunucusundan dönen benzersiz subject/username
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('student', 'instructor', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_cas_subject ON users(cas_subject);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(university_student_id);

-- ------------------------------------------------------------------------------
-- 2. DERSLER (courses)
-- Üniversite dersleri ve sorumlu öğretim üyesi bilgisi.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_code VARCHAR(32) NOT NULL,              -- Örn: BLM301
    name VARCHAR(255) NOT NULL,                    -- Örn: Yazılım Mühendisliği
    instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    academic_semester VARCHAR(32) NOT NULL,        -- Örn: 2026-Guz
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_course_code_semester UNIQUE (course_code, academic_semester)
);

CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id);

-- ------------------------------------------------------------------------------
-- 3. DERSE KAYITLI ÖĞRENCİLER (course_enrollments)
-- Yalnızca derse kayıtlı öğrencilerin yoklama alabilmesini garanti eder.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_course_student UNIQUE (course_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_course ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON course_enrollments(student_id);

-- ------------------------------------------------------------------------------
-- 4. DERS YOKLAMA OTURUMLARI (course_sessions)
-- Öğretim görevlisinin başlattığı süreli yoklama oturumları.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
    session_secret VARCHAR(128) NOT NULL,          -- QR HMAC-SHA256 imzası için benzersiz gizli anahtar
    qr_nonce_hash VARCHAR(64) NULL,                -- En son üretilen aktif QR nonce hash'i
    last_rotated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_course ON course_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON course_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON course_sessions(expires_at);

-- ------------------------------------------------------------------------------
-- 5. YOKLAMA KAYITLARI (attendance_records)
-- Öğrencinin onaylanan yoklama kaydı.
-- KESİN KURAL: UNIQUE(course_session_id, student_id)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_session_id UUID NOT NULL REFERENCES course_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    device_uuid_hash VARCHAR(64) NULL,             -- SHA-256(device_uuid + salt)
    ip_hash VARCHAR(64) NULL,                      -- SHA-256(ip_address + salt)
    user_agent_hash VARCHAR(64) NULL,              -- SHA-256(user_agent)
    verification_result VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    idempotency_key UUID NULL,
    
    -- MÜKERRER KAYDI VERİTABANI SEVİYESİNDE %100 ENGELLEYEN KISIT:
    CONSTRAINT uq_session_student UNIQUE (course_session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(course_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_verified_at ON attendance_records(verified_at);
CREATE INDEX IF NOT EXISTS idx_attendance_idempotency ON attendance_records(idempotency_key);

-- ------------------------------------------------------------------------------
-- 6. DENETİM LOGLARI (audit_logs)
-- Güvenlik, izleme, itiraz inceleme ve yasal denetim için tahrif edilemez loglar.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,                   -- CAS_LOGIN, CREATE_SESSION, ATTENDANCE_VERIFY vb.
    course_session_id UUID NULL REFERENCES course_sessions(id) ON DELETE SET NULL,
    result VARCHAR(32) NOT NULL,                   -- SUCCESS, FAILED_EXPIRED, FAILED_NOT_ENROLLED vb.
    metadata_json JSONB NULL,                      -- Ek bağlam (asla token/şifre içermez!)
    ip_hash VARCHAR(64) NULL,
    device_uuid_hash VARCHAR(64) NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_logs(course_session_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

-- ------------------------------------------------------------------------------
-- YARDIMCI GÜNCELLEME TRİGGER'I (updated_at)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();
