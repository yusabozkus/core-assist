# Core Asistan Admin Paneli

Bu doküman, Core Asistan'ın yalnızca iç ekip tarafından kullanılacak admin
panelinin yetkilendirme modelini, sayfa kapsamını ve geliştirme sırasını tanımlar.

## 1. Admin nasıl tanınır?

İlk sürümde admin hesapları backend ortam değişkenindeki doğrulanmış e-posta
listesiyle tanınır:

```ini
ADMIN_EMAILS="admin1@example.com,admin2@example.com"
```

Kurallar:

- Liste yalnızca backend'de bulunur; `NEXT_PUBLIC_` değişkeni olarak yayınlanmaz.
- Karşılaştırma boşluklardan arındırılmış ve küçük harfe çevrilmiş tam e-posta
  eşleşmesiyle yapılır.
- Kullanıcının oturumu geçerli ve e-posta adresi doğrulanmış olmalıdır.
- Frontend kontrolü yalnızca yönlendirme ve görünürlük içindir. `/admin/*`
  endpointlerinin asıl yetkilendirmesi backend'deki `AdminGuard` tarafından
  yapılır.
- Yapılandırma boşsa sistem güvenli biçimde kapalı kalır; hiçbir kullanıcı admin
  kabul edilmez.
- Ekip büyürse allowlist, veritabanındaki `SystemRole` ve izin modeline taşınır.

## 2. Giriş ve erişim akışı

```text
Google / Microsoft ile giriş
          ↓
Geçerli Better Auth oturumu
          ↓
Backend admin e-posta ve doğrulama kontrolü
          ↓
Admin                         Normal kullanıcı
  ↓                                 ↓
/admin                         /dashboard
```

Admin hesapları yalnızca yönetim panelini kullanır; bu hesaplar için mağaza,
workspace üyeliği veya onboarding kaydı oluşturulması gerekmez. Giriş sonrası
doğrudan `/admin` açılır ve admin arayüzü mağaza dashboard'una bağlantı vermez.

## 3. Güvenlik ilkeleri

- Tüm admin API'leri `/admin` namespace'i altında tutulur.
- Her endpoint `AuthGuard` ve `AdminGuard` ile korunur.
- Listeleme endpointleri yalnızca ekranda gereken DTO alanlarını döndürür.
- Silme, abonelik müdahalesi, yeniden deneme ve benzeri kritik mutasyonlar
  ayrıca doğrulama ister.
- Kritik admin işlemleri audit log'a yazılır.
- Paddle aboneliği veya transaction durumu yalnızca yerel veritabanı alanı
  değiştirilerek yönetilmez; Paddle sonucu doğrulanır.
- Admin yetkisi istemci tarafından gönderilen e-posta, rol veya custom data ile
  belirlenmez.
- Kod, route ve veri alanları İngilizce; kullanıcıya gösterilen metinler Türkçe
  olur.

## 4. Sayfalar

### Genel Bakış — `/admin`

- Toplam kullanıcı ve çalışma alanı
- Aktif, deneme, ödeme gecikmiş ve iptal edilmiş abonelikler
- Aylık AI soru kullanımı
- Açık destek talepleri
- Başarısız senkronizasyonlar
- Ödeme problemi yaşayan hesaplar
- Son önemli operasyon olayları

### Müşteriler — `/admin/customers`

- Kullanıcı, workspace, onboarding ve son giriş bilgileri
- Plan, kota, mağaza, ekip üyesi ve ürün sayıları
- Hesap ve abonelik durumuna göre filtreleme
- Workspace detayında ekip, mağaza, kanal, kullanım, faturalama ve destek
  geçmişi

### Destek Talepleri — `/admin/support`

- Açık, bekleyen ve çözülen talepler
- Kategori, öncelik, kullanıcı ve workspace filtreleri
- Admin atama, kullanıcıyla sohbet, dahili not ve durum yönetimi
- Ticket yaşam döngüsü ve yanıt geçmişi

### Abonelikler — `/admin/billing`

- Abonelik, checkout, plan değişikliği ve transaction durumları
- Ödeme problemi ve reconciliation hataları
- Paddle kaydına güvenli yönlendirme
- Yetkili yeniden kontrol ve toparlama işlemleri

### Operasyonlar — `/admin/operations`

- Ürün, stok ve soru senkronizasyonları
- Kuyrukta, çalışan, başarısız ve takılmış işler
- Trendyol ve Hepsiburada bağlantı sağlığı
- Güvenli yeniden deneme işlemleri

### AI ve Kullanım — `/admin/ai-usage`

- Taslak, otomatik gönderim ve inceleme oranları
- AI hata oranları ve ortalama güven
- Workspace bazında kota ve aşırı kullanım
- Eksik ürün bilgisi nedeniyle bekleyen sorular

### Sistem Sağlığı — `/admin/system`

- API, worker, PostgreSQL ve Redis durumu
- BullMQ kuyruk derinlikleri
- Paddle webhook ve reconciliation sağlığı
- Pazaryeri API sorunları ve son kritik hatalar

### Denetim Kayıtları — `/admin/audit-logs`

- İşlemi yapan admin
- Etkilenen kullanıcı veya workspace
- İşlem türü, tarih, IP ve sonuç
- Güvenli önceki/sonraki durum özeti

## 5. Geliştirme sırası

- [x] Faz 1 — Admin allowlist, backend guard, giriş yönlendirmesi ve korumalı
  admin layout iskeleti
- [x] Faz 2 — Destek talepleri listesi ve admin ticket konuşması
- [ ] Faz 3 — Müşteriler listesi ve workspace detay sayfası
- [ ] Faz 4 — Abonelik ve ödeme operasyonları
- [ ] Faz 5 — Senkronizasyon ve kuyruk operasyonları
- [ ] Faz 6 — Gerçek verilerle admin genel bakış
- [ ] Faz 7 — AI/kullanım ve sistem sağlığı
- [ ] Faz 8 — Audit log modeli ve kritik admin mutasyonlarının tamamı

## 6. İlk sürüm dışında kalanlar

- Adminleri panelden ekleme veya kaldırma
- Ayrıntılı admin rol ve izin matrisi
- Kullanıcı hesabına gizli biçimde giriş yapma
- Yardım merkezi içerik yönetimi
- Sistem duyurusu ve toplu e-posta gönderimi
- Feature flag yönetimi

Bu özellikler gerçek ihtiyaç oluştuğunda ayrı güvenlik değerlendirmesiyle
eklenmelidir.
