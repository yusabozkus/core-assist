# Core Asistan Admin Paneli

Bu doküman, yalnızca Core Asistan iç ekibinin kullandığı admin panelinin güncel
erişim modelini, kapsamını ve güvenlik sınırlarını tanımlar. Geçmiş geliştirme
fazları veya tamamlanmış inceleme maddeleri burada takip edilmez.

## Erişim modeli

İlk sürümde admin hesapları backend ortam değişkenindeki doğrulanmış e-posta
allowlist'i ile tanınır:

```ini
ADMIN_EMAILS="admin1@example.com,admin2@example.com"
```

- Liste yalnızca backend'de bulunur ve `NEXT_PUBLIC_` değişkeni olarak
  yayımlanmaz.
- E-posta adresi boşluklardan arındırılmış, küçük harfe çevrilmiş ve tam
  eşleşmeyle kontrol edilir.
- Oturum geçerli, kullanıcının e-posta adresi doğrulanmış olmalıdır.
- Yapılandırma boşsa hiçbir kullanıcı admin kabul edilmez.
- Frontend kontrolü yalnızca yönlendirme ve görünürlük içindir. Asıl yetki
  kontrolü backend'deki `AuthGuard` ve `AdminGuard` tarafından yapılır.
- Admin hesapları müşteri hesabı, mağaza veya onboarding kaydı gerektirmez.
  Başarılı girişten sonra doğrudan `/admin` alanına yönlendirilir.

Ekip büyür ve farklı admin yetkileri gerekirse allowlist yaklaşımı veritabanı
tabanlı sistem rolleri ve izin matrisiyle değiştirilmelidir.

## Mevcut sayfalar

| Alan | Rota | Amaç |
| --- | --- | --- |
| Genel Bakış | `/admin` | Müşteri, abonelik, destek ve operasyon özetleri |
| Müşteriler | `/admin/customers` | Müşteri hesapları, kullanıcılar, mağazalar ve kullanım bilgileri |
| Müşteri detayı | `/admin/customers/[workspaceId]` | Tek hesabın ekip, mağaza, kanal, destek ve faturalama bağlamı |
| Abonelikler | `/admin/billing` | Abonelik, ödeme, checkout ve plan değişikliği takibi |
| Abonelik detayı | `/admin/billing/[workspaceId]` | Paddle kimlikleri, dönemler, kullanım ve reconciliation durumu |
| Destek talepleri | `/admin/support` | Talep filtreleme, SLA ve sorumlu takibi |
| Destek konuşması | `/admin/support/[ticketId]` | Müşteri konuşması, dahili not, atama ve durum yönetimi |
| İletişim mesajları | `/admin/contact-messages` | Landing sayfasından gönderilen iletişim formları |
| Operasyonlar | `/admin/operations` | Katalog ve soru senkronizasyonları ile bağlantı sorunları |
| Kuyruk detayı | `/admin/operations/queues/[queueKey]` | Zamanlanmış, gecikmiş ve başarısız worker işleri |
| AI ve Kullanım | `/admin/ai-usage` | Taslak performansı, kotalar ve güncel işlem engelleri |
| AI engel detayı | `/admin/ai-usage/blockers/[type]` | Hata veya bekleme nedenine göre ilgili kayıtlar |
| Sistem Sağlığı | `/admin/system` | API, PostgreSQL, Redis, kuyruk, Paddle ve kanal sağlığı |
| Denetim Kayıtları | `/admin/audit-logs` | Kritik işlemler, aktör snapshot'ı ve sonuç bilgileri |
| Hesap ve Güvenlik | `/admin/account` | Admin profili, sağlayıcılar ve oturum yönetimi |

Header araması müşteri e-postası ve hesabı, mağaza, ticket numarası,
senkronizasyon kimliği ve Paddle customer/subscription/transaction kimliklerini
arayabilir.

## Güvenlik ilkeleri

- Admin API'leri `/admin` namespace'i altında tutulur.
- Tüm admin endpointleri oturum ve admin yetkisi doğrulamasından geçer.
- Durum değiştiren finansal ve operasyonel endpointlerde Origin kontrolü
  uygulanır.
- Kritik admin mutasyonları audit log'a yazılır. Aktör adı ve e-postası işlem
  anındaki snapshot olarak korunur.
- İstemciden gönderilen e-posta, rol, workspace veya custom data admin yetkisi
  için güven kaynağı değildir.
- Paddle durumu yalnızca yerel veritabanı alanı değiştirilerek yönetilmez;
  Paddle sonucu ve güvenilir yerel eşleştirme doğrulanır.
- Liste endpointleri yalnızca arayüzün ihtiyaç duyduğu alanları döndürür;
  kimlik bilgileri, ödeme bilgileri ve ham webhook içerikleri gösterilmez.
- Admin panelindeki bir hata müşteri verisi üzerinde sessiz bir değişiklik veya
  otomatik tekrar başlatmamalıdır.

## Operasyonel davranış

- Redis veya bir kuyruk yanıt vermediğinde PostgreSQL'den gelen diğer admin
  verileri kullanılabilir kalır; erişilemeyen bölüm açıkça bilinmiyor olarak
  gösterilir.
- Kuyruk sağlığı yalnızca iş adedine değil worker varlığına, en eski bekleme
  süresine, aktif iş süresine, ilerlemeye ve yakın tarihli hatalara bakar.
- Başarısız operasyonların detayları özet sayaçlardan ayrı sayfalarda
  incelenebilir.
- Destek mesajları ve admin bildirimleri canlı olaylar, odak yenilemesi ve
  kontrollü güvenlik polling'i ile güncellenir.
- Kullanıcıya gösterilmeyen `Workspace` teknik hiyerarşisi admin arayüzünde
  “Müşteri hesabı” olarak adlandırılır. Kod ve veritabanında `workspaceId`
  kullanılmaya devam eder.
- Veri saklama ve temizleme süreleri [DATA_RETENTION.md](DATA_RETENTION.md)
  dokümanında tanımlanır.

## Bilinçli sınırlar

İlk sürümde aşağıdaki yetkiler admin paneline eklenmez:

- Panelden admin ekleme veya kaldırma
- Ayrıntılı admin rol ve izin matrisi
- Müşteri hesabına gizli biçimde giriş yapma
- Keyfî kota veya veritabanı kaydı düzenleme
- Doğrudan iade veya tahsilat başlatma
- Feature flag, toplu e-posta veya yardım içeriği yönetimi

Bu özellikler gerçek ihtiyaç oluştuğunda ayrıca yetki, audit ve güvenlik
değerlendirmesiyle tasarlanmalıdır.

Production öncesi harici servis ve e-posta işleri
[PRODUCTION_NOTES.md](PRODUCTION_NOTES.md) dosyasında takip edilir.
