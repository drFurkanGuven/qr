# Yetkili Üniversite Yoklama Sistemi - Sistem Mimarisi (Architecture Specification)

Bu doküman, Fırat Üniversitesi CAS (Central Authentication Service) altyapısıyla entegre, yüksek güvenlikli, öğretim görevlisi ve öğrenci rollerini kesin sınırlarla ayıran yeni nesil yoklama sisteminin uçtan uca mimarisini açıklar.

---

## 1. Mimari Hedefler ve Temel İlkeler

1. **Sıfır Güven (Zero-Trust) İstemci Modeli:**
   - İstemci tarafı (tarayıcı, mobil web) daima potansiyel olarak güvensiz kabul edilir.
   - İstemci cihazın gönderdiği zaman damgaları (timestamp), IP adresleri veya yetki iddiaları asla güvenilir kabul edilmez; tüm doğrulama kararları backend sunucu saati ve veri tabanı kısıtları üzerinden yürütülür.

2. **Gizlilik ve Token Hijyeni:**
   - CAS Service Ticket (ST) veya Bearer Token'lar asla istemci JavaScript'ine (`localStorage`, `sessionStorage`, global window nesnesi) açılmaz.
   - Tüm oturumlar şifrelenmiş, `httpOnly`, `Secure`, `SameSite=Lax` niteliğindeki HTTP çerezleri (cookies) ile yürütülür.
   - Loglara, URL parametrelerine veya hata mesajlarına kimlik doğrulama belirteçleri yazılmaz.

3. **Tam Rol Ayrımı (Role-Based Access Control - RBAC):**
   - **Öğretim Görevlisi (Instructor):** Yalnızca yetkili olduğu derslerde yoklama oturumu başlatabilir, oturum süresini yönetebilir, canlı dinamik QR kod üretebilir, canlı katılım akışını izleyebilir ve oturumu sonlandırabilir. Öğretim görevlisi öğrenci adına yoklama gönderemez.
   - **Öğrenci (Student):** Yalnızca kendi CAS oturumu ile giriş yapabilir, derse kayıtlıysa tahtadaki kısa ömürlü QR kodu tarayarak yalnızca kendi adına tek bir yoklama kaydı oluşturabilir. Başka öğrenci adına işlem yapamaz.

4. **Kısa Ömürlü ve Dönen Dinamik QR:**
   - Tahtada gösterilen QR kod statik değildir. Her 30 saniyede bir kriptografik HMAC-SHA256 imzalı yeni bir oturum belirteci (nonce) ile otomatik olarak yenilenir.
   - Fotoğraf/ekran görüntüsü çekilip sınıf dışına gönderilen QR kodlar, 30 saniyelik tolerans penceresi aşıldığında sistem tarafından otomatik olarak reddedilir.

5. **Yüksek Eşzamanlılık ve Yarış Koşulu (Race Condition) Koruması:**
   - Amfi ortamında aynı anda 100-500 öğrencinin aynı saniyede yoklama göndermesi durumunda dahi veritabanı seviyesindeki `UNIQUE(course_session_id, student_id)` kısıtlaması ve ACID transaction garantisi ile mükerrer kayıt oluşumu %100 engellenir.

---

## 2. Sistem Bileşenleri ve Katmanlar

```
+-----------------------------------------------------------------------------------+
|                                 İSTEMCİ KATMANI                                   |
|                                                                                   |
|  [ Öğretim Görevlisi Web Paneli ]                [ Öğrenci Mobil / Web Paneli ]  |
|  - Ders Seçimi & Oturum Başlatma                - CAS ile Tek Tık Giriş (SSO)    |
|  - 30s Dönen Projeksiyon QR Ekranı              - Kamera & BarcodeDetector/ZXing  |
|  - SSE ile Anlık Canlı Katılım İzleme           - Fotoğraf Yükleme Yedeği         |
|  - Oturum Kapatma & Denetim Raporu              - 8 Durumlu Net Bildirim Motoru   |
+------------------------------------------+----------------------------------------+
                                           |
                              HTTPS / WSS  | (httpOnly Secure Cookies)
                                           v
+-----------------------------------------------------------------------------------+
|                        GÜVENLİK VE TERS PROXY (NGINX)                             |
|  - TLS 1.3 Sonlandırma                                                            |
|  - Rate Limiting (IP, Yol ve Kullanıcı Başına İstek Sınırlama)                    |
|  - Güvenlik Başlıkları (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)       |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                         BACKEND SERVİSİ (FASTAPI)                                 |
|                                                                                   |
|  [ Auth & CAS Modülü ]     [ Oturum & QR Motoru ]    [ Yoklama & Doğrulama ]      |
|  - CAS Ticket Exchange     - HMAC-SHA256 İmzası      - Derse Kayıt Kontrolü       |
|  - JWT Session Çerezleri   - Nonce Üretimi (30s)     - Idempotency & Unique Lock  |
|  - Resmi API Entegrasyonu  - Zaman Aşımı Yönetimi    - SSE Event Stream           |
|                                                                                   |
|  [ Denetim (Audit) & Güvenlik Katmanı ]                                           |
|  - SHA-256 Hash'li Cihaz/IP/UA Denetimi, Hassas Veri Filtreleme, Replay Guard    |
+----------------------+------------------------------------+-----------------------+
                       |                                    |
          PostgreSQL   |                         HTTPS REST | (Resmi Entegrasyon)
                       v                                    v
+----------------------------------+   +--------------------------------------------+
|     VERİTABANI (POSTGRESQL 16)   |   |     FIRAT ÜNİVERSİTESİ RESMİ SERVİSLERİ    |
|  - users                         |   |  - CAS: https://jasig.firat.edu.tr/cas     |
|  - courses & course_enrollments  |   |  - Service: https://qr.firat.edu.tr        |
|  - course_sessions               |   |  - API Base: https://qr.firat.edu.tr/api/  |
|  - attendance_records (UNIQUE)   |   |  - CAS Exchange: /api/auth/cas/token       |
|  - audit_logs                    |   |  - Attendance Verify: /api/attendance/verify
+----------------------------------+   +--------------------------------------------+
```

---

## 3. Veri Akışı ve Temel Süreçler

### 3.1. Kimlik Doğrulama (CAS SSO Flow)
1. Öğrenci veya Öğretim Görevlisi tarayıcıdan `/auth/cas/login` butonuna tıklar.
2. Backend, kullanıcıyı resmi Fırat CAS sunucusuna yönlendirir:
   `https://jasig.firat.edu.tr/cas/login?service=https://qr.firat.edu.tr/api/auth/cas/callback`
3. Kullanıcı üniversite kullanıcı adı ve şifresiyle CAS'a giriş yapar. CAS, tarayıcıyı tek kullanımlık bir `ticket` (örn: `ST-xxxxxx`) ile geri yönlendirir.
4. Backend, gelen bileti (ticket) arka planda CAS sunucusuna veya resmi API'ye (`POST https://qr.firat.edu.tr/api/auth/cas/token`) ileterek doğrular.
5. Ticket tek kullanımlıktır; doğrulandıktan sonra backend şifreli bir oturum oluşturur ve istemciye `httpOnly; Secure; SameSite=Lax` çerezi yazar. Ticket asla istemci JavaScript'ine iletilmez.

### 3.2. Yoklama Oturumu Başlatma ve Dinamik QR
1. Öğretim Görevlisi sisteme giriş yapar, sorumlu olduğu dersi seçer ve oturum süresini (örn: 15 dakika) belirleyerek oturumu başlatır.
2. Backend veritabanında `course_sessions` kaydı oluşturur ve bu oturuma özel bir kriptografik anahtar (session secret) üretir.
3. Öğretim görevlisi paneli, projeksiyon modunda büyük boyutta bir QR kod gösterir.
4. QR kodu içeriği şu formattadır:
   ```json
   {
     "session_id": "c6a2e4a1-...",
     "nonce": "7f8b9c...",
     "expires_at": 1727038830,
     "signature": "hmac_sha256(session_id + nonce + expires_at, secret)"
   }
   ```
5. Bu QR her 30 saniyede bir yeni bir `nonce` ve yeni bir `signature` ile yenilenir.

### 3.3. Öğrenci QR Tarama ve Doğrulama
1. Öğrenci mobil cihazından kamerayı açar.
2. Kamera veya fotoğraf seçimiyle QR kod çözülür.
3. İstemci, çözülen QR dizesini ve benzersiz bir `idempotency_key` değerini `POST /api/v1/attendance/verify` endpoint'ine gönderir. (Oturum çerezi otomatik olarak taşınır).
4. Backend şu kontrolleri katı bir sıra ile uygular:
   - **Kullanıcı Oturumu:** Geçerli bir öğrenci oturumu var mı?
   - **QR İmza Kontrolü:** Gönderilen QR'daki imza oturumun anahtarıyla eşleşiyor mu?
   - **QR Süre Kontrolü:** QR'ın `expires_at` zamanı backend saatine göre aşılmış mı? (Maksimum tolerans: 30 sn).
   - **Ders Oturumu:** Oturum aktif mi ve kapanış saati dolmamış mı?
   - **Derse Kayıt Kontrolü:** Öğrenci `course_enrollments` tablosunda bu derse kayıtlı mı?
   - **Tekrarlayan Yoklama:** Öğrencinin bu oturum için önceden onaylanmış bir kaydı var mı?
5. Tüm kontroller başarılıysa, veri tabanında bir transaction içinde `attendance_records` tablosuna kayıt yazılır.
6. SSE (Server-Sent Events) kanalı üzerinden öğretim görevlisinin canlı ekranına `"Ali Veli (210101001) katıldı"` bildirimi anında yansıtılır.
7. Öğrenciye anında yeşil onay ekranı gösterilir.

---

## 4. Eşzamanlılık ve Veri Bütünlüğü (Concurrency & Integrity)

- **Veritabanı Kısıtlaması:**
  `attendance_records` tablosunda `CONSTRAINT uq_session_student UNIQUE (course_session_id, student_id)` kuralı uygulanmıştır.
- **İşlem Yalıtımı (Transaction Isolation):**
  İstekler `READ COMMITTED` yalıtım seviyesinde çalışır. Aynı milisaniyede aynı öğrenci tarafından gönderilen paralel isteklerden yalnızca biri transaction'ı tamamlayabilir; diğeri `IntegrityError` (409 Conflict) yakalanarak kontrollü biçimde `"Yoklamanız zaten alınmış"` yanıtı döner.
- **Idempotency Key:**
  Zayıf internet bağlantısı nedeniyle öğrencinin telefonundan arka arkaya tetiklenen mükerrer HTTP istekleri `idempotency_key` kontrolü ile filtrelenir.
