# Yetkili Üniversite Yoklama Sistemi - API Sözleşmesi (API Contract & Specification)

Bu doküman, sistemin tüm RESTful ve SSE (Server-Sent Events) API uç noktalarını, veri modellerini, hata durumlarını, yetkilendirme kurallarını ve denetim (audit) davranışlarını tanımlar.

---

## Genel Kurallar ve Standartlar

- **Protokol:** Yalnızca HTTPS (Port 443) / WSS
- **Veri Formatı:** JSON (`application/json; charset=utf-8`)
- **Tarih & Saat Formatı:** ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`)
- **Oturum Yönetimi:** `session_token` isimli şifrelenmiş, `httpOnly`, `Secure`, `SameSite=Lax` nitelikli HTTP çerezi (cookie).
- **Hassas Veri Maskeleme:** Hata mesajlarında ve yanıtlarda asla açık bilet, token, parola veya sunucu iç hata izi (stack trace) döndürülmez.

---

## Standart Hata Yanıt Modeli

Tüm başarısız API çağrıları standart hata şemasını izler:

```json
{
  "success": false,
  "error_code": "STRING_ERROR_CODE",
  "message": "Kullanıcıya gösterilecek anlaşılır hata mesajı.",
  "details": {}
}
```

---

## Uç Nokta Spesifikasyonları

---

### 1. CAS Giriş Başlatma (CAS Start)
- **Metot & Yol:** `GET /api/v1/auth/cas/start`
- **Açıklama:** Kullanıcıyı resmi Fırat Üniversitesi CAS giriş sayfasına yönlendirir (`302 Found`).
- **Request Modeli:** Yok (Query: `return_url` isteğe bağlı, yalnızca izin verilen domainler kabul edilir).
- **Response Modeli:** `302 Redirect -> https://jasig.firat.edu.tr/cas/login?service=https://qr.firat.edu.tr/api/auth/cas/callback`
- **Hata Kodları:** `400 INVALID_RETURN_URL`
- **Authentication:** Gerekmez (Public).
- **Authorization:** Gerekmez.
- **Rate Limit:** 30 istek / dakika / IP.
- **Audit Davranışı:** Loglanmaz (Anonim).

---

### 2. CAS Geri Çağırma & Bilet Değişimi (CAS Callback)
- **Metot & Yol:** `GET /api/v1/auth/cas/callback`
- **Açıklama:** CAS sunucusunun tek kullanımlık `ticket` parametresi ile yönlendirdiği uç noktadır. Arka planda bilet doğrulanır, kullanıcı profili eşitlenir ve istemciye güvenli `httpOnly` çerezi yazılır.
- **Request Modeli (Query):**
  - `ticket` (string, zorunlu): CAS Service Ticket (Örn: `ST-12345-abcdef`).
- **Response Modeli (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "id": "usr_9f8e7d...",
      "university_student_id": "210101001",
      "full_name": "Furkan Güven",
      "role": "student"
    }
  }
  ```
  *(Set-Cookie: session_token=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400)*
- **Hata Kodları:**
  - `400 TICKET_MISSING`: Bilet parametresi eksik.
  - `401 TICKET_INVALID_OR_EXPIRED`: CAS bileti geçersiz, süresi dolmuş veya daha önce kullanılmış.
  - `502 CAS_UPSTREAM_ERROR`: CAS sunucusuna ulaşılamadı.
- **Authentication:** Gerekmez (Ticket ile yetkilendirilir).
- **Authorization:** Gerekmez.
- **Rate Limit:** 10 istek / dakika / IP.
- **Audit Davranışı:** Başarılı/Başarısız giriş denemesi `audit_logs` tablosuna `actor_user_id`, `action=CAS_LOGIN`, `result=SUCCESS/FAILED`, `ip_hash` ile yazılır.

---

### 3. Doğrudan Bilet Değişimi (Direct CAS Token Exchange)
- **Metot & Yol:** `POST /api/v1/auth/cas/token`
- **Açıklama:** Resmi API sözleşmesine uygun olarak ticket, service ve device_uuid ile doğrudan token/oturum alma ucu.
- **Request Modeli (Body):**
  ```json
  {
    "ticket": "ST-998877-xyz",
    "service": "https://qr.firat.edu.tr",
    "device_uuid": "d1c2-3b4a-5f6e"
  }
  ```
- **Response Modeli (200 OK):**
  ```json
  {
    "success": true,
    "access_token": "app_token_...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "id": "usr_9f8e7d...",
      "university_student_id": "210101001",
      "role": "student"
    }
  }
  ```
- **Hata Kodları:** `400 INVALID_TICKET`, `401 TICKET_EXPIRED`, `422 UNPROCESSABLE_ENTITY`
- **Authentication:** Gerekmez.
- **Authorization:** Gerekmez.
- **Rate Limit:** 10 istek / dakika / IP.
- **Audit Davranışı:** `action=TOKEN_EXCHANGE`, `result=SUCCESS/FAILED`.

---

### 4. Mevcut Kullanıcı Bilgisi (Current User Me)
- **Metot & Yol:** `GET /api/v1/auth/me` (ve `GET /api/v1/user`)
- **Açıklama:** Oturum açmış kullanıcının kimlik, numara ve rol bilgilerini döndürür.
- **Request Modeli:** Yok (Oturum çerezi veya Bearer token).
- **Response Modeli (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "id": "usr_9f8e7d...",
      "university_student_id": "210101001",
      "cas_subject": "fguven",
      "email": "fguven@firat.edu.tr",
      "full_name": "Furkan Güven",
      "role": "student",
      "enrolled_courses": [
        {
          "course_id": "crs_101",
          "course_code": "BLM301",
          "name": "Yazılım Mühendisliği"
        }
      ]
    }
  }
  ```
- **Hata Kodları:** `401 UNAUTHORIZED`
- **Authentication:** Zorunlu (Oturum çerezi veya Bearer).
- **Authorization:** Herhangi bir aktif kullanıcı.
- **Rate Limit:** 60 istek / dakika / kullanıcı.
- **Audit Davranışı:** Loglanmaz.

---

### 5. Oturum Kapatma (Logout)
- **Metot & Yol:** `POST /api/v1/auth/logout`
- **Açıklama:** Kullanıcı oturum çerezini geçersiz kılar (`Max-Age=0`).
- **Request Modeli:** Boş.
- **Response Modeli (200 OK):** `{"success": true, "message": "Oturum kapatıldı."}`
- **Hata Kodları:** `401 UNAUTHORIZED`
- **Authentication:** Zorunlu.
- **Authorization:** Aktif kullanıcı.
- **Rate Limit:** 20 istek / dakika / IP.
- **Audit Davranışı:** `action=LOGOUT`.

---

### 6. Yoklama Oturumu Başlatma (Create Attendance Session)
- **Metot & Yol:** `POST /api/v1/attendance/sessions`
- **Açıklama:** Yalnızca öğretim görevlileri tarafından ders yoklama oturumu başlatır.
- **Request Modeli (Body):**
  ```json
  {
    "course_id": "crs_101",
    "duration_minutes": 15
  }
  ```
- **Response Modeli (201 Created):**
  ```json
  {
    "success": true,
    "session": {
      "id": "ses_4b3a2c...",
      "course_id": "crs_101",
      "course_code": "BLM301",
      "course_name": "Yazılım Mühendisliği",
      "started_at": "2026-09-22T08:00:00Z",
      "expires_at": "2026-09-22T08:15:00Z",
      "status": "active"
    }
  }
  ```
- **Hata Kodları:**
  - `400 ACTIVE_SESSION_EXISTS`: Bu ders için hâlihazırda açık bir yoklama oturumu var.
  - `403 FORBIDDEN`: Kullanıcı öğretim görevlisi değil veya bu dersin sorumlusu değil.
  - `404 COURSE_NOT_FOUND`: Ders bulunamadı.
- **Authentication:** Zorunlu.
- **Authorization:** `role == 'instructor' AND user_id == course.instructor_id`
- **Rate Limit:** 5 istek / dakika / kullanıcı.
- **Audit Davranışı:** `action=CREATE_SESSION`, `course_session_id=...`, `result=SUCCESS`.

---

### 7. Dinamik QR Kodu Üretme (Get Rotating QR)
- **Metot & Yol:** `GET /api/v1/attendance/sessions/{id}/qr`
- **Açıklama:** Tahtaya yansıtılmak üzere her 30 saniyede bir yenilenen HMAC-SHA256 imzalı QR payload'ını döndürür.
- **Request Modeli (Path):** `id` (UUID, oturum kimliği).
- **Response Modeli (200 OK):**
  ```json
  {
    "success": true,
    "session_id": "ses_4b3a2c...",
    "qr_token": "eyJzZXNzaW9uX2lkIjogInNlc180YjNhMmMiLCAibm9uY2UiOiAiZGY4OWFiYyIsICJleHBpcmVzX2F0IjogMTcyNzAzODgzMCwgInNpZ25hdHVyZSI6ICJjM2E0YjUuLi4ifQ==",
    "raw_data": {
      "session_id": "ses_4b3a2c...",
      "nonce": "df89abc...",
      "expires_at": 1727038830,
      "signature": "c3a4b5..."
    },
    "seconds_remaining": 30
  }
  ```
- **Hata Kodları:**
  - `403 FORBIDDEN`: Yalnızca dersin öğretim görevlisi erişebilir.
  - `404 SESSION_NOT_FOUND`: Oturum yok.
  - `410 SESSION_CLOSED`: Oturum süresi dolmuş veya kapatılmış.
- **Authentication:** Zorunlu.
- **Authorization:** `role == 'instructor' AND user_id == course.instructor_id`
- **Rate Limit:** 120 istek / dakika (Sayfa 1-2 saniyede bir sorgulayabilir veya SSE dinler).
- **Audit Davranışı:** Loglanmaz (Sık döngü).

---

### 8. Canlı Katılım Yayını (Live Attendance SSE Stream)
- **Metot & Yol:** `GET /api/v1/attendance/sessions/{id}/stream`
- **Açıklama:** Öğretim görevlisinin tahtadaki ekranında yoklaması onaylanan öğrencilerin anlık listesini akıtan Server-Sent Events (SSE) bağlantısı.
- **Request Headers:** `Accept: text/event-stream`
- **Response Stream Event:**
  ```text
  event: student_verified
  data: {"student_id": "usr_...", "university_student_id": "210101001", "full_name": "Ali Veli", "verified_at": "2026-09-22T08:02:15Z"}

  event: student_rejected
  data: {"reason": "NOT_ENROLLED", "timestamp": "2026-09-22T08:02:18Z"}
  ```
- **Hata Kodları:** `403 FORBIDDEN`, `404 SESSION_NOT_FOUND`
- **Authentication:** Zorunlu (Çerez tabanlı).
- **Authorization:** Yalnızca dersin öğretim üyesi.
- **Rate Limit:** Oturum başına en fazla 3 eşzamanlı SSE bağlantısı.
- **Audit Davranışı:** Bağlantı açılışı `action=SSE_STREAM_CONNECT` olarak loglanır.

---

### 9. Yoklama Doğrulama (Student Attendance Verify)
- **Metot & Yol:** `POST /api/v1/attendance/verify`
- **Açıklama:** Öğrencinin kamerasıyla okuttuğu QR kodunu kendi adına onaylatan ana uç nokta.
- **Request Headers:**
  - `Content-Type: application/json`
  - `X-Device-UUID` (İsteğe bağlı, cihaz tespiti için)
  - `Idempotency-Key` (İsteğe bağlı UUID)
- **Request Modeli (Body):**
  ```json
  {
    "qr_token": "kameradan_okunan_string_veya_base64_payload",
    "idempotency_key": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
  ```
- **Response Modeli (200 OK):**
  ```json
  {
    "success": true,
    "status": "VERIFIED",
    "message": "Yoklamanız başarıyla kaydedildi.",
    "record": {
      "id": "rec_7a8b9c...",
      "course_code": "BLM301",
      "course_name": "Yazılım Mühendisliği",
      "verified_at": "2026-09-22T08:03:45Z"
    }
  }
  ```
- **Hata Kodları ve Anlamları:**
  - `400 QR_INVALID_FORMAT`: QR içeriği çözülemedi veya geçerli bir yoklama formatında değil.
  - `400 QR_SIGNATURE_MISMATCH`: QR imzası geçersiz veya değiştirilmiş.
  - `400 QR_EXPIRED`: QR kodun süresi dolmuş (30 saniye geçmiş), tahtadaki güncel kodu okutun.
  - `403 NOT_ENROLLED`: Öğrenci bu dersin öğrenci listesinde kayıtlı değil.
  - `404 SESSION_NOT_FOUND_OR_CLOSED`: Yoklama oturumu bulunamadı veya süresi dolduğu için kapatılmış.
  - `409 DUPLICATE_ATTENDANCE`: Bu ders oturumunda yoklamanız daha önce alınmış.
  - `429 TOO_MANY_REQUESTS`: Çok fazla hatalı deneme yapıldı.
- **Authentication:** Zorunlu (Öğrenci oturumu).
- **Authorization:** `role == 'student'`
- **Rate Limit:** 5 istek / 10 saniye / kullanıcı.
- **Audit Davranışı:** Her doğrulama girişimi (başarılı veya başarısız) `audit_logs` tablosuna `actor_user_id`, `course_session_id`, `action=ATTENDANCE_VERIFY`, `result=SUCCESS/FAILED_EXPIRED/FAILED_NOT_ENROLLED/FAILED_DUPLICATE`, `ip_hash`, `device_uuid_hash` alanlarıyla eksiksiz yazılır.

---

### 10. Oturumu Kapatma (Close Attendance Session)
- **Metot & Yol:** `POST /api/v1/attendance/sessions/{id}/close`
- **Açıklama:** Öğretim görevlisinin yoklama oturumunu süresinden önce manuel olarak kapatmasını sağlar.
- **Request Modeli (Path):** `id` (UUID).
- **Response Modeli (200 OK):**
  ```json
  {
    "success": true,
    "message": "Yoklama oturumu kapatıldı.",
    "total_verified": 42
  }
  ```
- **Hata Kodları:** `403 FORBIDDEN`, `404 SESSION_NOT_FOUND`
- **Authentication:** Zorunlu.
- **Authorization:** `role == 'instructor' AND user_id == course.instructor_id`
- **Rate Limit:** 10 istek / dakika.
- **Audit Davranışı:** `action=CLOSE_SESSION`.

---

### 11. Canlı Yoklama Listesi ve Rapor (Show Attendance Records)
- **Metot & Yol:** `GET /api/v1/attendance/sessions/{id}/records` (ve `GET /api/v1/attendance/show`)
- **Açıklama:** Oturuma katılan öğrencilerin tam listesini döndürür.
- **Request Modeli (Path):** `id` (UUID).
- **Response Modeli (200 OK):**
  ```json
  {
    "success": true,
    "session_id": "ses_4b3a2c...",
    "course_code": "BLM301",
    "total_count": 42,
    "records": [
      {
        "id": "rec_1",
        "university_student_id": "210101001",
        "full_name": "Ali Veli",
        "verified_at": "2026-09-22T08:02:15Z"
      }
    ]
  }
  ```
- **Hata Kodları:** `403 FORBIDDEN`, `404 SESSION_NOT_FOUND`
- **Authentication:** Zorunlu.
- **Authorization:** `role == 'instructor'`
- **Rate Limit:** 30 istek / dakika.
- **Audit Davranışı:** `action=VIEW_RECORDS`.

---

### 12. Cihaz Kaydı (Device Register)
- **Metot & Yol:** `POST /api/v1/device/register`
- **Açıklama:** Resmi API sözleşmesine uygun cihaz / tarayıcı parmak izi eşleme.
- **Request Modeli (Body):**
  ```json
  {
    "device_uuid": "d1c2-3b4a-5f6e",
    "device_name": "Chrome Mobile (Android)"
  }
  ```
- **Response Modeli (200 OK):**
  ```json
  {
    "success": true,
    "registered": true,
    "device_uuid_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
  ```
- **Authentication:** Zorunlu.
- **Rate Limit:** 5 istek / saat / kullanıcı.
- **Audit Davranışı:** `action=REGISTER_DEVICE`.
