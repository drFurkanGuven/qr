# Yetkili Üniversite Yoklama Sistemi - Tehdit Modeli (Threat Model & Security Analysis)

Bu doküman, sistemin güvenlik sınırlarını, potansiyel saldırı vektörlerini ve STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) metodolojisine göre uygulanan savunma mekanizmalarını açıklar.

---

## 1. Güvenlik Sınırları ve Varlıklar (Trust Boundaries & Assets)

### Korunan Varlıklar
1. **Yoklama Kayıtlarının Bütünlüğü:** Sınıfta fiziksel olarak bulunmayan hiçbir öğrencinin yoklama kaydı alamaması.
2. **Kullanıcı Kimlikleri ve Oturumları:** Öğrenci ve öğretim üyesi oturum anahtarlarının çalınmaması.
3. **Kişisel Veriler (KVKK/GDPR Uyumu):** Öğrenci numarası, IP adresi, cihaz parmak izi gibi bilgilerin açık metin saklanmaması ve loglara düşürülmemesi.
4. **Denetim (Audit) Kayıtlarının Değiştirilemezliği:** Yoklama ve oturum hareketlerinin geriye dönük silinememesi veya manipüle edilememesi.

---

## 2. STRIDE Tehdit Analizi ve Karşı Tedbirler

| Tehdit Kategorisi (STRIDE) | Tehdit Senaryosu | Etki Seviyesi | Uygulanan Güvenlik Önlemi & Mimari Çözüm |
| :--- | :--- | :--- | :--- |
| **Spoofing (Kimlik Sahteciliği)** | Bir öğrencinin başka bir öğrencinin hesabıyla yoklama göndermesi. | KRİTİK | **Öğrenci Başına Tekil CAS Oturumu:** Her öğrenci yalnızca kendi üniversite CAS kimliği ile oturum açabilir. Backend oturumu httpOnly çerezde tutulur ve token paylaşımına izin verilmez. |
| **Spoofing (Kimlik Sahteciliği)** | Öğretim görevlisi yetkilerinin taklit edilmesi veya öğrencinin ders oturumu açması. | YÜKSEK | **Katı RBAC Denetimi:** `/attendance/sessions` ve yönetim uç noktaları yalnızca `role == 'instructor'` olan ve dersin resmi sorumlusu olan kullanıcıya açıktır. |
| **Tampering (Veri Tahrifatı)** | QR kod içeriğinin değiştirilerek başka bir derse yoklama gönderilmesi. | KRİTİK | **Kriptografik HMAC-SHA256 İmzası:** QR kod; `session_id`, `nonce`, ve `expires_at` alanlarının sunucu gizli anahtarı ile imzalanmasını içerir. İmza uyuşmazlığında anında reddedilir. |
| **Tampering (Veri Tahrifatı)** | İstemci cihazın saatini geri alarak süresi geçmiş QR kodunu okutması. | ORTA | **Mutlak Sunucu Saati Esası:** İstemci saatine asla güvenilmez. QR geçerliliği tamamen PostgreSQL ve backend sunucusunun UTC saati üzerinden hesaplanır. |
| **Repudiation (İnkar Edilebilirlik)** | Bir öğrencinin "Ben sınıftaydım ama yoklamam yazılmadı" veya "Ben yoklama göndermedim" iddiası. | ORTA | **Kapsamlı ve Hash'lenmiş Audit Logları:** Her doğrulama denemesinde `ip_hash`, `device_uuid_hash`, `user_agent_hash`, oturum kimliği ve zaman damgası tahrif edilemez biçimde `audit_logs` tablosuna yazılır. |
| **Information Disclosure (Bilgi İfşası)** | CAS ticket veya Bearer token'ların URL, frontend JS veya sunucu loglarında görünmesi. | KRİTİK | **Token Hijyeni ve httpOnly Cookie:** Token'lar asla URL query parametresi olarak taşınmaz. İstemci koduna veya `localStorage`'a aktarılmaz. Log kütüphanesine hassas anahtar filtreleme filtresi uygulanır. |
| **Information Disclosure (Bilgi İfşası)** | Cihaz UUID ve IP adreslerinin açıkça sızması. | DÜŞÜK | **SHA-256 Tuzlu Özet (Salted Hash):** IP ve Cihaz UUID değerleri veritabanına doğrudan yazılmaz; `sha256(ip + salt)` formatında hash'lenerek saklanır. |
| **Denial of Service (Servis Dışı Bırakma)** | Amfideki yüzlerce öğrencinin yoklama açıldığı anda sunucuya aşırı yük bindirmesi veya bot saldırısı. | YÜKSEK | **Katı Hız Sınırlaması (Rate Limiting) & Bağlantı Havuzu:** Nginx ve FastAPI katmanında IP başına 10 req/s, kullanıcı başına 5 req/s kısıtlaması uygulanır. Asyncpg bağlantı havuzu kullanılır. |
| **Denial of Service (Servis Dışı Bırakma)** | Aynı öğrencinin butona art arda 50 kez basması sonucu yarış koşulu yaratılması. | YÜKSEK | **Idempotency Key & Veritabanı Kilidi:** `idempotency_key` kontrolü ve veritabanı seviyesinde `UNIQUE(course_session_id, student_id)` kuralı ile yarış koşulları sıfırlanır. |
| **Elevation of Privilege (Yetki Yükseltme)** | Öğrencinin öğretim görevlisi panelini açarak yoklama kapatması veya öğrenci yoklaması oluşturması. | KRİTİK | **Sunucu Tarafı Yetki Doğrulaması:** Frontend arayüzü gizlense dahi backend'deki her API çağrısında `get_current_instructor` dependency'si çalıştırılır. |

---

## 3. Sahaya Özgü Tehditler ve Savunmalar

### 3.1. "Sınıftan WhatsApp / Telegram Grubuyla QR Paylaşımı" Saldırısı
- **Saldırı Mekanizması:** Sınıftaki bir öğrenci projeksiyondaki QR kodun fotoğrafını çeker ve evdeki arkadaşlarına anında gönderir.
- **Savunma Mekanizması (Dönen Dinamik QR):**
  - QR kod her **30 saniyede bir** değişir.
  - Kodun ömrü `expires_at = now + 30s` olarak belirlenir. Ağ gecikmesi için yalnızca 10 saniyelik bir tolerans penceresi tanınır.
  - Fotoğraf çekme, mesajlaşma uygulamasına yükleme, karşı tarafın indirip kameraya okutması genellikle 30-40 saniyeden uzun sürer. Süresi dolan QR sistem tarafından anında reddedilir (`400 QR_EXPIRED`).

### 3.2. "Mükerrer İstek & Yarış Koşulu (Race Condition)" Saldırısı
- **Saldırı Mekanizması:** Bir öğrenci aynı anda birden fazla cihaz veya bot yazılımı kullanarak kendi adına tek bir derste birden fazla başarılı kayıt oluşturmaya veya veritabanını kilitlemeye çalışır.
- **Savunma Mekanizması:**
  - Veritabanı tablosunda tekil kısıt:
    ```sql
    CONSTRAINT uq_session_student UNIQUE (course_session_id, student_id);
    ```
  - FastAPI handler'ı transaction başlatır. İlk commit başarılı olurken, aynı anda gelen diğer 99 istek `asyncpg.exceptions.UniqueViolationError` hatası fırlatır ve sistem 409 Conflict döner. Veritabanında hiçbir zaman birden fazla kayıt oluşamaz.

### 3.3. "Sahte CAS Ticket (Ticket Forgery & Replay)" Saldırısı
- **Saldırı Mekanizması:** Daha önce kullanılmış bir CAS biletini (Service Ticket) tekrar göndererek yeni bir oturum elde etmeye çalışmak.
- **Savunma Mekanizması:**
  - Backend, bilet doğrulamasını doğrudan Fırat Üniversitesi CAS sunucusuna veya resmi token değişim uç noktasına yapar.
  - CAS protokolü gereği her bilet tek kullanımlıktır ve doğrulandıktan hemen sonra geçersizleşir.
  - Backend ayrıca bilet hash'ini kısa süreli önbellekte tutarak aynı biletin concurrent gönderilmesini engeller.
