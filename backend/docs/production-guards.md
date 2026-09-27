# Push, AI taslak ve log korumaları

Production incelemesinin 3. adımı: PUSH-01, AI-01, LOG-01. Kod ve yerel testler tamamlandı; gerçek tarayıcı/HTTPS staging kabulü ayrıca yapılmalı.

## Push abonelikleri

Kayıtta ve her gönderimde endpoint ve anahtarlar doğrulanır. HTTPS/443 dışında protokol/port, kullanıcı bilgisi, fragment, IP adresi ve izinli servisleri taklit eden domainler reddedilir. `p256dh` geçerli bir P-256 açık anahtarı, `auth` 16 baytlık base64url veri olmalıdır.

İzinli hostlar:

- `fcm.googleapis.com` — [Chrome push servisi](https://developer.chrome.com/blog/push-notifications-on-the-open-web).
- `updates.push.services.mozilla.com` — [Mozilla Autopush](https://mozilla-services.github.io/autopush-rs/http.html).
- Tek alt domainli `*.push.apple.com` — [WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- Tek alt domainli `*.notify.windows.com` — [Microsoft push servis adresleri](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/firewall-allowlist-config).

Endpoint yolları sağlayıcıya ait opak değerlerdir; WNS'nin kök yol + query biçimi de kabul edilir. Yeni bir servis adresi gerekirse gerçek tarayıcının ürettiği adres doğrulanıp liste ve testler güncellenmeli; genel wildcard açılmamalı.

DNS kontrolü doğrudan HTTPS socket resolver'ında yapılır. Yanıtın herhangi bir adresi özel, loopback, link-local veya engellenen ayrılmış aralıkta ise gönderim reddedilir. Doğrulanan adresler doğrudan socket'e verilir; ayrı bir ikinci DNS çözümlemesi yapılmaz. TLS sertifika doğrulaması korunur. Redirect/proxy takibi yoktur; DNS/bağlantı/yanıt dahil toplam süre 10 saniye, yanıt gövdesi 64 KiB ile sınırlıdır. `web-push` şifrelemesi ve VAPID kullanımı korunur. 404/410 abonelik temizliği mevcut akışta devam eder.

Kullanıcı başına en fazla **10 abonelik** kaydedilebilir; eşzamanlı kayıtlar kullanıcı satırı kilidiyle sınırlandırılır. Mevcut abonelik güncellenebilir. Başka kullanıcının aboneliği devralınamaz; ortak tarayıcıda hesap değiştirirken önce eski abonelik kaldırılmalıdır. Eski geçersiz kayıtlar gönderimde de reddedilir; bu değişiklik veri silme migration'ı çalıştırmaz. Gönderim sorgusu da kullanıcı başına 10 kayıtla sınırlıdır.

## AI taslak üretimi

Manuel ve otomatik üretim aynı PostgreSQL `ai_draft_lease` kaydını kullanır. **Hesap/workspace başına aynı anda 1 üretim**, üretim başlangıçları arasında **en az 5 saniye** vardır. Hesabın farklı mağazaları da aynı sınırı paylaşır; farklı hesaplar bu kilitle birbirini engellemez. Bu seçim aynı soru tekrarlarını ve farklı soruların son kota hakkı için yarışını önler.

Manuel istekte kapasite doluysa `429`, `AI_RATE_LIMITED` ve `retryAfterSeconds: 5` döner; mevcut panel bekleme davranışı kullanılır. Otomatik job 5 saniye ertelenir, kapasite beklemesi başarısız deneme hakkını tüketmez. Bu sınır provider'ın kendi rate limitinden ayrıdır.

Lease 5 dakika geçerlidir; 30 saniyede bir yenilenir. 10 dakikayı geçen üretim için yeni yenileme kabul edilmez. Son yenilemenin süresi dolana kadar kilit kalabileceği için bu, 10 dakikalık kesin işlem iptali değildir. Normal tamamlanma/hata kilidi bırakır; process kaybında süresi dolan kilidi yeni iş devralabilir. Eski sahibin token'ı yeni işi serbest bırakamaz. Dış AI çağrısından önce sahiplik doğrulanır; taslak/kota transaction'ı içinde yeniden doğrulanıp satır kilitlenir.

Başarısız veya sahipliğini kaybetmiş üretim taslak kaydetmez ve müşteri kotasını tüketmez. Üretim sırasında cevap gönderim kuyruğuna alınmışsa geç kalan taslak commit edilmez. Mevcut ücretsiz yeniden üretim kuralları korunur. **Daha önce sağlayıcıya gönderilmiş isteğin maliyeti geri alınmaz**; süreç kaybında eski dış çağrı iptal edilmiş sayılmaz. Stok doğrulaması gerektiren mevcut akış tek mantıksal üretimde iki model çağrısı yapabilir. Dolayısıyla bu koruma mutlak parasal bütçe limiti değildir.

## Davet logları

Backend HTTP loglarında query/fragment kullanılmaz; `/workspace-invitations/<token>` ve `/invite/<token>` yollarındaki token bölümü `[REDACTED]` olur. Encoded request path, tamamlanmış/yarıda kesilmiş istek, hata stack'i, iç içe metadata ve logger context'i de kapsanır. Normal rota, durum kodu ve süre gibi tanı alanları korunur.

Bu işlem eski log dosyalarını veya reverse proxy/CDN loglarını değiştirmez. Docker/proxy adımında davet URL'lerinin proxy erişim loglarına açık yazılmaması ayrıca sağlanmalı; HTTPS staging'de tüm log katmanları kontrol edilmelidir.

## Geçiş ve doğrulama

Yeni migration: `20260927060000_add_ai_draft_lease`. Gerçek uygulama veritabanına bu çalışma sırasında uygulanmadı. Yeni kod bu tabloyu gerektirir; eski sürümde AI kilidi olmadığı için eski/yeni backend karışık çalıştırılmamalı.

1. Önce [cevap teslimatı geçiş rehberindeki](question-delivery-recovery.md) eski worker durdurma sırasını uygula. Uygun yedeği al.
2. Backend bağımlılıklarını kur; `npm run db:generate` ve `npm run build` ile yeni client/build üret. Hedef DB'ye `npm run db:migrate:deploy` uygula.
3. Yalnızca yeni backend/worker sürümünü başlat. Yeni env değişkeni gerekmiyor. VAPID ayarları mevcut bildirim yapılandırmasından gelir.
4. Staging'de Chrome/Firefox/Edge ve desteklenen Apple cihazında abonelik kaydı ve gerçek bildirim alımını doğrula. Geçersiz/sona ermiş aboneliğin kalan alıcıları engellemediğini kontrol et.
5. İki sekmeden aynı/farklı soruya taslak isteği, otomasyonla yarış, 429 sonrası tekrar deneme ve mevcut ücretsiz yeniden üretim davranışını panelden kontrol et.
6. Sahte davet token'ıyla başarılı/hatalı istek gönder; backend ve proxy loglarında token bulunmadığını doğrula.

Yerel komutlar (`backend` dizininde):

```sh
npm run test:production-guards
npm run test:production-guards:integration
npm run build
```

Entegrasyon testi yalnızca localhost PostgreSQL/Redis kabul eder. `TEST_DATABASE_URL`/`TEST_REDIS_URL` verilmezse mevcut bağlantı ayarlarını kullanır; PostgreSQL'de rastgele isimli ayrı DB oluşturup tüm migration'ları uygular ve yalnızca kendi DB'sini kaldırır. DB oluşturma yetkisi gerekir. BullMQ rastgele test prefix'inde çalışır; uygulama kuyruğunu temizlemez. AI ve dış push çağrıları taklit edilir; gerçek müşteri bildirimi, ücretli model isteği veya pazaryeri cevabı gönderilmez.
