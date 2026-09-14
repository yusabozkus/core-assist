# Bildirim sistemi kurulumu

Core Asistan bildirimleri varsayılan olarak uygulama içinde ve canlı SSE akışıyla
çalışır. Tarayıcı ve e-posta teslimatı isteğe bağlıdır; gerekli ortam değişkenleri
tanımlanmadığında ayar ekranındaki ilgili seçenekler pasif görünür.

## Alıcı ve tercih politikası

- AI inceleme ve yanıt hataları mağaza yöneticileriyle temsilcilere gider.
- Senkronizasyon, kanal ve stok sorunları mağaza yöneticilerine gider.
- Finans ve kota olayları yalnızca hesap sahibiyle hesap yöneticilerine gider.
- Ekip erişimi ve hesap güvenliği olayları doğrudan ilgili kullanıcıya gider.
- Viewer rolü operasyonel bildirim almaz.

AI, senkronizasyon, kanal ve stok bildirimleri mağaza bazında kapatılabilir.
Finans, ekip erişimi ve hesap güvenliği bildirimleri zorunludur. Başarılı rutin
senkronizasyonlar, her yeni soru ve kullanıcının kendi başlattığı davet
oluşturma/iptal işlemleri bildirim üretmez.

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

## Sessiz saatler

Kullanıcı sessiz saatleri açtığında bu aralıkta tarayıcı ve e-posta teslimatı
yapılmaz. Bildirim uygulama içinde kaydedilmeye ve okunmamış sayacında görünmeye
devam eder. Saat hesabı mağazanın saat dilimiyle yapılır.

## Saklama ve canlı akış

```env
NOTIFICATION_RETENTION_DAYS="90"
NOTIFICATION_CLEANUP_INTERVAL_MS="86400000"
REDIS_URL="redis://localhost:6379"
```

Yalnızca okunmuş ve saklama süresini aşmış bildirimler temizlenir. Okunmamış
bildirimler otomatik silinmez. Redis Pub/Sub, birden fazla backend instance'ında
oluşan değişikliklerin tüm açık SSE bağlantılarına ulaşmasını sağlar.
