# Yetkili Üniversite Yoklama Sistemi - Sıralama Diyagramları (Sequence Diagrams)

Bu doküman, sistemin temel kullanım senaryolarının katmanlar arasındaki mesajlaşma ve veri akışlarını Mermaid sıralama diyagramları ile modeller.

---

## 1. CAS Kimlik Doğrulama ve Güvenli Oturum Akışı (CAS Authentication Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Student as Öğrenci (Tarayıcı)
    participant Backend as Backend API (FastAPI)
    participant CAS as Fırat CAS Sunucusu
    participant DB as PostgreSQL

    Student->>Backend: GET /api/v1/auth/cas/start
    Backend-->>Student: 302 Redirect -> https://jasig.firat.edu.tr/cas/login?service=...
    Student->>CAS: Kullanıcı Adı & Parola ile Giriş
    CAS-->>Student: 302 Redirect -> /api/auth/cas/callback?ticket=ST-12345
    Student->>Backend: GET /api/v1/auth/cas/callback?ticket=ST-12345
    
    Note over Backend,CAS: Backend arka planda bileti doğrular (Tek Kullanımlık)
    Backend->>CAS: POST /serviceValidate?ticket=ST-12345&service=...
    CAS-->>Backend: 200 OK (XML/JSON: Valid, User: 210101001, Role: student)
    
    Backend->>DB: Kullanıcıyı Bul veya Oluştur (users)
    DB-->>Backend: Kullanıcı Kaydı Onaylandı
    Backend->>DB: Audit Log Yaz (action: CAS_LOGIN, result: SUCCESS)
    
    Note over Backend,Student: Token asla JS'e verilmez; httpOnly çerez yazılır
    Backend-->>Student: 200 OK (Set-Cookie: session_token=...; HttpOnly; Secure; SameSite=Lax)
```

---

## 2. Öğretim Görevlisi Oturum Başlatma ve Dinamik QR Rotasyonu

```mermaid
sequenceDiagram
    autonumber
    actor Instructor as Öğretim Görevlisi
    participant Panel as Web Paneli (Projeksiyon)
    participant Backend as Backend API
    participant DB as PostgreSQL

    Instructor->>Panel: "Yoklama Başlat" (Ders: BLM301, Süre: 15 dk)
    Panel->>Backend: POST /api/v1/attendance/sessions (Cookie: session_token)
    Backend->>DB: Sorumlu öğretim üyesi mi kontrol et
    Backend->>DB: INSERT INTO course_sessions (expires_at, session_secret)
    DB-->>Backend: Oturum Açıldı (id: ses_4b3a)
    Backend-->>Panel: 201 Created (session_id: ses_4b3a)

    loop Her 30 Saniyede Bir Otomatik QR Yenileme
        Panel->>Backend: GET /api/v1/attendance/sessions/ses_4b3a/qr
        Backend->>Backend: Yeni Nonce üret (nonce: 7f8b9c)
        Backend->>Backend: HMAC-SHA256(ses_4b3a + nonce + expires_at, secret)
        Backend-->>Panel: 200 OK (qr_token, seconds_remaining: 30)
        Panel->>Panel: Projeksiyonda Yüksek Çözünürlüklü QR Kodunu Güncelle
    end
```

---

## 3. Öğrenci QR Tarama ve Uçtan Uca Doğrulama Akışı

```mermaid
sequenceDiagram
    autonumber
    actor Student as Öğrenci
    participant Scanner as Mobil Kamera / ZXing
    participant Backend as Backend API
    participant DB as PostgreSQL
    participant Panel as Öğretim Üyesi Canlı Ekranı (SSE)

    Student->>Scanner: Tahtadaki QR Kodu Tara
    Scanner->>Scanner: QR İçeriğini Çöz (session_id, nonce, signature)
    Scanner->>Backend: POST /api/v1/attendance/verify (Cookie, qr_token, idempotency_key)
    
    Backend->>Backend: 1. Kullanıcı oturumunu doğrula (Öğrenci mi?)
    Backend->>Backend: 2. QR HMAC imzasını doğrula
    Backend->>Backend: 3. QR zaman aşımı kontrolü (Şimdiki zaman <= expires_at + 10s)
    
    Backend->>DB: 4. Ders oturumu aktif mi? (status == 'active')
    DB-->>Backend: Oturum Aktif
    
    Backend->>DB: 5. Öğrenci bu derse kayıtlı mı? (course_enrollments)
    DB-->>Backend: Öğrenci Kayıtlı
    
    Backend->>DB: 6. Transaction Başlat: INSERT INTO attendance_records
    Note over Backend,DB: UNIQUE(course_session_id, student_id) kısıtlaması devrede
    DB-->>Backend: Kayıt Eklendi (id: rec_7a8b)
    
    Backend->>DB: 7. Audit Log Ekle (action: ATTENDANCE_VERIFY, result: SUCCESS)
    
    par Öğrenciye Başarı Bildirimi
        Backend-->>Student: 200 OK {"success": true, "status": "VERIFIED"}
        Student->>Student: Yeşil Onay Ekranı & Haptic Titreşim
    and Öğretim Üyesine Anlık Canlı Akış
        Backend->>Panel: SSE Event: student_verified {"student_id": "...", "name": "Ali Veli"}
        Panel->>Panel: Tabloya Canlı Satır Ekle & Sayacı 1 Artır
    end
```

---

## 4. 100+ Eşzamanlı İstek ve Yarış Koşulu (Race Condition) Önleme

```mermaid
sequenceDiagram
    autonumber
    actor Student1 as Öğrenci A (İstek 1 - 08:05:00.100)
    actor Student1_Repeat as Öğrenci A (İstek 2 - 08:05:00.102)
    participant Backend as FastAPI Worker Pool
    participant DB as PostgreSQL Transaction Engine

    par Eşzamanlı İstek 1
        Student1->>Backend: POST /verify (student_id: 101, session_id: S1)
        Backend->>DB: BEGIN TRANSACTION
        Backend->>DB: INSERT INTO attendance_records (S1, 101)
        DB-->>Backend: INSERT SUCCESS (İlk Gelen Kazanır)
        Backend->>DB: COMMIT
        Backend-->>Student1: 200 OK (VERIFIED)
    and Eşzamanlı İstek 2 (2 milisaniye sonra)
        Student1_Repeat->>Backend: POST /verify (student_id: 101, session_id: S1)
        Backend->>DB: BEGIN TRANSACTION
        Backend->>DB: INSERT INTO attendance_records (S1, 101)
        Note over DB: HATA: duplicate key value violates unique constraint "uq_session_student"
        DB-->>Backend: IntegrityError (UniqueViolation)
        Backend->>DB: ROLLBACK
        Backend-->>Student1_Repeat: 409 Conflict {"error_code": "DUPLICATE_ATTENDANCE"}
    end
```
