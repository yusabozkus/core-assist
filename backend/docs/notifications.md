# Bildirim sistemi kurulumu

Core Asistan bildirimleri varsayılan olarak uygulama içinde ve canlı SSE akışıyla
çalışır. Operasyon e-postaları tercih kaydı olmayan kullanıcılar için varsayılan
açıktır ve kapatılabilir; mevcut kapatma tercihleri korunur. Tarayıcı teslimatı
isteğe bağlıdır. Gerekli ortam değişkenleri tanımlanmadığında ayar ekranındaki
ilgili seçenekler pasif görünür.

## Alıcı ve tercih politikası

- AI inceleme ve yanıt hataları mağaza yöneticileriyle temsilcilere gider.
- Senkronizasyon, kanal ve stok sorunları mağaza yöneticilerine gider.
- Finans ve kota olayları yalnızca hesap sahibiyle hesap yöneticilerine gider.
- Ekip erişimi ve hesap güvenliği olayları doğrudan ilgili kullanıcıya gider.
- Viewer rolü operasyonel bildirim almaz.

AI, senkronizasyon, kanal ve stok bildirimleri mağaza bazında kapatılabilir.
Finans, ekip erişimi ve hesap güvenliği bildirimleri zorunludur. Başarılı rutin
senkronizasyonlar, her yeni soru ve kullanıcının kendi başlattığı davet
oluşturma/iptal işlemleri başlatan kişiye ayrıca panel bildirimi üretmez;
davet edilene gönderilen davet e-postası ayrı akıştır.

## Tarayıcı bildirimleri

VAPID anahtarlarını bir kez üretin:

```bash
npx web-push generate-vapid-keys
```

Oluşan değerleri yalnızca backend ortamına ekleyin:

```env
WEB_PUSH_VAPID_PUBLIC_KEY=""
WEB_PUSH_VAPID_PRIVATE_KEY=""
WEB_PUSH_VAPID_SUBJECT="mailto:support@example.com"
```

Push bildirimleri geliştirme ortamında `localhost` üzerinde, canlı ortamda ise
HTTPS üzerinden çalışır. Kullanıcı Bildirimler > Tercihler ekranından izin
verdiğinde service worker ve cihaz aboneliği otomatik oluşturulur.

## E-posta bildirimleri

E-posta teslimatı Resend HTTP API üzerinden yapılır. Resend panelinde gönderici
alan adını doğruladıktan sonra aşağıdaki değerleri ekleyin:

```env
RESEND_API_KEY=""
NOTIFICATION_EMAIL_FROM="Core Asistan <notifications@coreasistan.com>"
```

Ekip daveti oluşturulduğunda Resend e-postasında hesap, rol, erişilen mağazalar, son kullanma tarihi ve `FRONTEND_URL` üzerinden kurulan kabul bağlantısı bulunur. Davet token'ı veritabanında hash, bekleyen e-posta içeriğinde şifreli saklanır; loglanmaz. Gönderim idempotent kaydedilir, geçici hata tekrar denenir; başarısızlık daveti silmez ve ekip ekranında yeniden gönderme sunulur.

### Rol bazlı e-posta hedef politikası

Bu tablo, önemli veya işlem gerektiren olaylar için hedef alıcı ve gönderim şeklini tanımlar; her satırın uçtan uca uygulanmış olduğu anlamına gelmez. Gerçek sağlayıcı ve rol kabulü [staging kaydında](../../deploy/STAGING_ACCEPTANCE.md) yapılır.

| Olay | Hedef alıcı | Gönderim |
| --- | --- | --- |
| Davet oluşturuldu | Davet edilen kişi | Anında, zorunlu |
| Davet kabul edildi | Hesap sahibi ve daveti oluşturan yönetici | Anında |
| Rol/mağaza erişimi değişti veya üyelik kaldırıldı | Yetkisi değişen kullanıcı | Anında, zorunlu |
| Ödeme başarısızlığı, abonelik/plan değişimi, fatura/iade | Hesap sahibi ve hesap yöneticileri | Anında |
| AI kotası %80 | Hesap sahibi ve hesap yöneticileri | E-posta tercihine bağlı; dönem başına bir kez |
| AI kotası %90/%100 | Hesap sahibi ve hesap yöneticileri | Zorunlu; ortak kota dönemi başına her eşikte bir kez |
| Kanal kopması, tekrarlı senkronizasyon hatası | İlgili mağaza ve hesap yöneticileri | Olay veya eşik anında |
| Otomatik yanıt hatası veya otomasyon durması | İlgili mağaza yöneticileri ve temsilciler | Anında |
| İnceleme bekleyen sorular, düşük/tükenen stok | İlgili mağaza yöneticileri ve temsilciler | Günlük veya tercihe bağlı özet |
| Yeni cihaz/giriş sağlayıcısı değişikliği | İlgili kullanıcı | Anında, zorunlu |
| Hesap silme talebi | İlgili kullanıcı ve hesap sahibi | Anında, zorunlu |

%90 ve %100 kota e-postaları genel e-posta tercihini ve sessiz saatleri dikkate
almadan doğrulanmış e-posta adresine gönderilir. Alıcılar yalnızca hesap sahibi
ve hesap yöneticileridir. Pazaryerleri ve mağazalar aynı kota dönemini
paylaştığında bildirim ve e-posta kimlikleri ortaktır; tekrarlar yeni e-posta
oluşturmaz. Kota nedeniyle duraklama için ayrıca operasyon e-postası gönderilmez.
%80 uyarısı genel e-posta tercihine ve sessiz saatlere tabidir.

İlk mağaza bildirimi oluşturulurken alıcıların eksik teslimat tercihleri
varsayılan açık olarak kaydedilir; var olan tercihler değiştirilmez. Böylece
kullanıcı tercihler sayfasını açmadan da özetleri alabilir. AI incelemeleri soru
başına e-posta göndermez; varsayılan sekiz saatlik aralıkta yeni incelemeler toplu
olarak bildirilir. Stok uyarıları da toplulaştırılır; kritik stok özetleri en az
24 saat arayla gönderilir.

## Sessiz saatler

Kullanıcı sessiz saatleri açtığında bu aralıkta tarayıcı ve e-posta teslimatı
yapılmaz. Kritik kota (%90/%100), ödeme, abonelik ve güvenlik e-postaları bu
tercihten bağımsızdır. Bildirim uygulama içinde kaydedilmeye ve okunmamış sayacında
görünmeye devam eder. Saat hesabı mağazanın saat dilimiyle yapılır.

## Saklama ve canlı akış

```env
NOTIFICATION_RETENTION_DAYS="90"
NOTIFICATION_CLEANUP_INTERVAL_MS="86400000"
REDIS_URL="redis://localhost:6379"
```

Yalnızca okunmuş ve saklama süresini aşmış bildirimler temizlenir. Okunmamış
bildirimler otomatik silinmez. Redis Pub/Sub, birden fazla backend instance'ında
oluşan değişikliklerin tüm açık SSE bağlantılarına ulaşmasını sağlar.
