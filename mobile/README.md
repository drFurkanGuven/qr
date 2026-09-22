# Fırat Üniversitesi Çoklu Yoklama & CAS Mobil Uygulaması

Bu mobil uygulama (iOS & Android); öğrencilerin doğrudan kendi telefonlarından **resmi Fırat CAS oturumunu açmalarını**, tahtadaki QR kodu **canlı kamera ile taramalarını** ve **kendi hesapları veya TÜBİTAK proje ekibi adına tek hamlede yoklama göndermelerini** sağlar.

---

## 🚀 Hızlı Başlangıç (Test Ekibi İçin)

### 1. Gereksinimler
- Bilgisayarınızda **Node.js (>= 18)** kurulu olmalıdır.
- Test edecek öğrencilerin telefonlarında (iPhone veya Android) ücretsiz **Expo Go** uygulaması yüklü olmalıdır:
  - [iOS İçin App Store'dan İndir](https://apps.apple.com/app/expo-go/id982107779)
  - [Android İçin Google Play'den İndir](https://play.google.com/store/apps/details?id=host.exp.exponent)

### 2. Uygulamayı Başlatma
Terminalde `mobile` klasörüne girip şu komutu çalıştırın:

```bash
cd mobile
npm install
npx expo start
```

Terminalde büyük bir **Karekod (QR Kod)** belirecektir:
* **iPhone İçin:** Telefonun standart Kamera uygulamasını açıp terminaldeki QR kodu tarayın; sarı renkli *"Expo Go ile Aç"* kutucuğuna tıklayın.
* **Android İçin:** Expo Go uygulamasını açıp *"Scan QR Code"* seçeneğiyle terminaldeki QR kodu tarayın.

Uygulama saniyeler içinde telefonunuzda canlı olarak açılacaktır!

---

## 📱 Temel Özellikler

1. **Resmi Fırat CAS Girişi:**
   - Uygulama içinde gömülü resmi CAS portalı açılır (`https://jasig.firat.edu.tr/cas/login`).
   - Giriş başarılı olunca bilet (`ST-...`) otomatik yakalanıp Fırat API'sinden Bearer Access Token elde edilir ve cihazın güvenli hafızasına (`SecureStore`) kaydedilir.
   - Alternatif olarak Burp veya mobilden yakalanan hazır token ile de anında giriş yapılabilir.

2. **Kamera & QR Tarayıcı:**
   - Yüksek hassasiyetli tahta QR okuyucu.
   - Flaş / Fener açma ve 1x, 2x, 3x yakınlaştırma (Zoom) kontrolleri.
   - QR algılandığı anda titreşimli onay ve otomatik Fırat API gönderimi.

3. **TÜBİTAK Ekip Yönetimi (Çoklu Gönderim):**
   - Tek bir cihazdan sınıfta QR okutulduğunda, kayıtlı tüm ekip arkadaşlarının yoklaması eşzamanlı olarak Fırat API'sine iletilir.
   - Her öğrencinin kendi bağımsız `X-Device-Uuid` ve `Bearer Token` bilgisi kullanılır.
   - Anlık milisaniye ve HTTP durum kodu (200, 409 vb.) sonuç tablosu.

4. **Profil & Yoklama Takibi:**
   - Kullanıcı adı, öğrenci numarası ve cihaz donanım kimliği görüntüleme.
   - *"Ders Yoklama Durumunu Sorgula"* butonu ile Fırat sistemindeki aktif ders ve yoklama kayıtlarını kontrol etme.
