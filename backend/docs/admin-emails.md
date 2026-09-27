# Admin e-posta teslimat takibi

Admin panelinde `/admin/emails`, gönderim listesi ve `/admin/emails/:emailId`
detay ekranı bulunur. Müşteri detayları o hesaba bağlı son beş gönderimi gösterir.
Bu özellik e-posta göndermez; mevcut gönderim akışını gözlemler.

## Kurulum

1. Backend dizininde `npm run db:generate` ve `npm run db:migrate:deploy` çalıştırın.
2. Backend ortamında `RESEND_API_KEY` ve `NOTIFICATION_EMAIL_FROM` tanımlı olmalıdır.
   Resend panelinde gönderici domaininin doğrulanmış olduğunu kontrol edin.
3. Resend → Webhooks bölümüne webhook adresini ekleyin. Canlı ortamda backend'in
   erişilebilir adresini kullanın; örnek:
   `https://api.coreasistan.com/notifications/webhooks/resend`. Yerel geliştirmede
   aşağıdaki Hookdeck kurulumunun verdiği **Resend Source URL** adresini kullanın.
4. Şu olayları seçin: `email.sent`, `email.delivered`, `email.delivery_delayed`,
   `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`.
5. Webhook signing secret değerini backend ortamına `RESEND_WEBHOOK_SECRET`
   olarak ekleyin ve backend'i yeniden başlatın. Bu anahtar frontend'e aktarılmaz.
6. Yeni bir test e-postası göndererek imzalı bir olay üretin.
   E-posta ekranındaki son bildirim zamanı güncellenmelidir. Teslimat detayının
   bağlanması için olayın `data.email_id` değeri yerel gönderimin Resend kimliğiyle
   eşleşmelidir. Anahtarın tanımlı olması, webhook'un kurulduğunu tek başına kanıtlamaz.

### Yerel geliştirme: Hookdeck

Backend `localhost:4001` üzerinde çalışırken proje kökündeki
`start-development.bat` dosyası Paddle ve Resend için ayrı Hookdeck dinleyicileri
başlatır. Resend dinleyicisini tek başına da çalıştırabilirsiniz:

```bash
hookdeck listen 4001 resend --path /notifications/webhooks/resend
```

`hookdeck` komutu bulunamazsa Hookdeck CLI'yi `npm install -g hookdeck-cli`
ile kurun ve Paddle için kullandığınız Hookdeck hesabında oturum açın.

Hookdeck çıktısındaki **Resend Source** için `Requests to` adresini kopyalayıp
Resend → Webhooks → Add Webhook ekranındaki URL alanına yapıştırın. Bu adres
Hookdeck tarafından üretilir; `localhost` veya Paddle kaynağının adresi değildir.
Resend'e verilen Hookdeck adresinin sonuna yerel webhook yolunu eklemeyin.
Çıktıdaki `Forwards to` adresi
`http://localhost:4001/notifications/webhooks/resend` olmalıdır. Webhook'u
oluşturduktan sonra Resend'in verdiği signing secret değerini `backend/.env`
dosyasında `RESEND_WEBHOOK_SECRET` olarak kaydedip backend'i yeniden başlatın.
Resend kaynağında gövde veya `svix-*` başlıklarını değiştiren Hookdeck dönüşümleri
uygulamayın; backend gelen ham gövdenin imzasını doğrular.

Yerel dinleyici açık değilken gelen olaylar otomatik olarak daha sonra yerel
sunucuya iletilmez. Ayrıca beş dakikadan eski imzalı olayların Hookdeck üzerinden
tekrar gönderimi backend tarafından reddedilir; kontrol için yeni bir test olayı
oluşturun.

Mevcut gönderimler geçmişteki webhook olayları olmadan otomatik olarak
"teslim edildi" sayılmaz. Yapılandırma eksikliği e-posta listelemeyi engellemez.

## İşleyiş

- `EmailDeliveryRecord.status` mevcut gönderim sürecini tutar.
- `EmailProviderMessage.status` sağlayıcı teslimat sonucunu ayrı tutar.
- `EmailDeliveryEvent` yalnızca olay kimliği, Resend mesaj kimliği, olay türü ve
  zamanlarını saklar. Alıcı, konu, HTML veya ham webhook gövdesi kaydedilmez.
- İmza ham gövde üzerinden HMAC-SHA256 ile, sabit zamanlı karşılaştırma ve
  beş dakikalık timestamp toleransıyla doğrulanır. Yanlış imza 401, eksik anahtar
  503, bozuk desteklenen olay 400 döndürür; desteklenmeyen doğrulanmış olaylar 200 ile atlanır.
- `svix-id` benzersizdir; aynı olayın tekrarları ikinci kayıt oluşturmaz.
  Sağlayıcı mesajı gönderim yanıtından önce oluşturulabilir. Böylece erken
  gelen webhook sonradan gönderime bağlanır.
- Eşzamanlı olaylar aynı mesaj satırı üzerinde serileştirilir. Geç gelen
  gönderildi/gecikti olayları teslim veya kalıcı hata sonucunu geri almaz.
  Öncelik: bilinmiyor → gönderildi → gecikti → teslim → başarısız → engellendi
  → geri döndü → spam şikâyeti. Aynı sonuç için en yeni olay zamanı tutulur.
- Mevcut 90 günlük gönderim temizliği korunur. Hiçbir gönderime bağlı olmayan
  ve 90 gündür güncellenmeyen sağlayıcı mesajları olaylarıyla birlikte temizlenir.
- Eski mağaza gönderimleri, hâlâ mevcut davetler ve hesabı bilinen finans
  bildirimleri migration sırasında ilişkilendirilir. Bağlamı bulunamayan eski
  gönderimler e-posta adresinden tahmin edilerek bir müşteriye bağlanmaz.

## Kontroller

```bash
npm run test:admin-emails
npm run test:admin-emails:integration
npm run build
```

Entegrasyon testi yalnızca localhost PostgreSQL'e bağlanır. `TEST_DATABASE_URL`
veya `DATABASE_URL` bağlantısıyla `core_assist_email_test_` önekli geçici bir
veritabanı oluşturur, migration'ları uygular ve test sonunda kaldırır. Bağlantı
kullanıcısının veritabanı oluşturma yetkisi olmalıdır. Uygulama veritabanını
değiştirmez, dış API çağırmaz ve e-posta göndermez.

Kaynaklar:
- [Resend webhook olayları](https://resend.com/docs/webhooks/event-types)
- [Resend imza doğrulaması](https://resend.com/docs/webhooks/verify-webhooks-requests)
- [Svix imza formatı ve test vektörü](https://docs.svix.com/receiving/verifying-payloads/how-manual)
