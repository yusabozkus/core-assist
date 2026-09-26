# Admin e-posta teslimat takibi

Admin panelinde `/admin/emails`, gönderim listesi ve `/admin/emails/:emailId`
detay ekranı bulunur. Müşteri detayları o hesaba bağlı son beş gönderimi gösterir.
Bu özellik e-posta göndermez; mevcut gönderim akışını gözlemler.

## Kurulum

1. Backend dizininde `npm run db:generate` ve `npm run db:migrate:deploy` çalıştırın.
2. Backend ortamında `RESEND_API_KEY` ve `NOTIFICATION_EMAIL_FROM` tanımlı olmalıdır.
   Resend panelinde gönderici domaininin doğrulanmış olduğunu kontrol edin.
3. Resend → Webhooks bölümünde şu adresi ekleyin:
   `https://api.coreasistan.com/notifications/webhooks/resend`
4. Şu olayları seçin: `email.sent`, `email.delivered`, `email.delivery_delayed`,
   `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`.
5. Webhook signing secret değerini backend ortamına `RESEND_WEBHOOK_SECRET`
   olarak ekleyin ve backend'i yeniden başlatın. Bu anahtar frontend'e aktarılmaz.
6. Resend panelinin webhook test/replay özelliğiyle doğrulanmış bir olay gönderin.
   E-posta ekranındaki son bildirim zamanı güncellenmelidir. Teslimat detayının
   bağlanması için olayın `data.email_id` değeri yerel gönderimin Resend kimliğiyle
   eşleşmelidir. Anahtarın tanımlı olması, webhook'un kurulduğunu tek başına kanıtlamaz.

Yerel geliştirmede webhook için dışarıdan erişilebilir HTTPS adresi gerekir.
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
