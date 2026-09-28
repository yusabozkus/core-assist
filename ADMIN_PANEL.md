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
| E-posta | `/admin/emails` | Gönderim geçmişi, teslimat takibi, hata sayaçları ve yapılandırma durumu |
| E-posta detayı | `/admin/emails/[emailId]` | Deneme zamanları, hata nedeni ve doğrulanmış teslimat olayları |
| Duyurular | `/admin/announcements` | Rollere göre toplu panel bildirimi ve isteğe bağlı e-posta gönderimi |
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

## E-posta takibi

- E-posta listesi alıcı, konu, Resend mesaj kimliği, müşteri ve mağaza adıyla aranabilir.
  Gönderim durumu, teslimat durumu ve oluşturulma tarih aralığıyla filtrelenir.
  Tarihler arayüzde Türkiye saatine göre gösterilir; bitiş günü dahil edilir.
- Müşteri detayında o hesaba bağlı son beş gönderim gösterilir. İlişki açık
  `workspaceId` veya mağazanın hesabından kurulur; aynı alıcının başka hesaba ait
  e-postaları bu listeye taşınmaz. Bağlamı bilinmeyen eski kayıtlar genel listede kalır.
- `SENT`, gönderimin Resend tarafından kabul edildiğini belirtir. Alıcı posta
  sunucusuna teslim bilgisi ayrı webhook olaylarıyla doğrulanır; okunma ölçülmez.
- Son 24 saat sayaçları kabul, mevcut teslimat sonucu ve hata zamanlarına bakar.
  Bekleyen ve inceleme gerektiren sayaçlar tüm açık kayıtları kapsar. Liste
  filtreleri sayaçları değiştirmez; müşteri veya mağaza kapsamı değiştirir.
- Yapılandırma kartları anahtar ve gönderici adresinin tanımlı olduğunu gösterir;
  domain doğrulaması veya sağlayıcının erişilebilirliği için başarı iddiasında bulunmaz.
  Son doğrulanmış webhook zamanı ve beş dakikadan fazla geciken denemeler gösterilir.
- Ham HTML, davet token'ları, idempotency anahtarları ve gizli API anahtarları
  admin yanıtlarına eklenmez. İlk sürümde bu ekranlar salt okunurdur.
- Geçici gönderim hataları mevcut otomatik deneme akışında kalır. Sonucu belirsiz
  `REVIEW_REQUIRED` kayıtları Resend tarafında incelenmelidir.

Kurulum ve doğrulama: [E-posta teslimat takibi](backend/docs/admin-emails.md).

## Toplu duyurular

Admin, duyuru başlığını ve mesajını yazar; hesap sahibi, hesap yöneticisi, mağaza
yöneticisi, temsilci ve görüntüleyici rollerinden birini veya birkaçını seçer.
“Hepsi” tüm rolleri işaretler. Rol eşleşmesi ekip ekranındaki erişim düzeyiyle
aynıdır. Birden fazla mağazası olan kullanıcıya bir bildirim gider; platform
adminleri alıcı listesine dahil edilmez.

“E-posta da gönder” anahtarı yalnızca Resend, gönderici adresi ve uygulama adresi
tanımlıysa kullanılabilir. E-posta adresini doğrulamamış kişiler panel bildirimi
alır, e-posta listesine eklenmez. Önizleme ekranında bildirim ve e-posta alıcı
sayıları, atlanan adres sayısı ve örnek alıcılar gösterilir. Önizleme 10 dakika
geçerlidir; bu sürede alıcı veya rol bilgisi değişirse yeni önizleme gerekir.

Onay, bildirimleri ve e-posta gönderim kayıtlarını aynı veritabanı işleminde
oluşturur. E-postalar mevcut otomatik gönderim akışında işlenir; gerçek gönderim
ve teslimat durumları `/admin/emails` ekranından izlenir. Aynı onay isteğinin
tekrarı ikinci gönderim oluşturmaz. Son 30 duyuru geçmişte gösterilir ve işlem
denetim kaydına yazılır. Müşteri listesi için 10.000 kullanıcı sınırı vardır.

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
- Feature flag, bağımsız toplu e-posta kampanyası veya yardım içeriği yönetimi

Bu özellikler gerçek ihtiyaç oluştuğunda ayrıca yetki, audit ve güvenlik
değerlendirmesiyle tasarlanmalıdır.

Production öncesi harici servis kabulü [staging kabul kaydında](deploy/STAGING_ACCEPTANCE.md), bildirim ve e-posta politikası [bildirim rehberinde](backend/docs/notifications.md) takip edilir.
