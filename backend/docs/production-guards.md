# Push, AI taslak ve log korumaları

Push, AI taslak ve davet logu korumaları aşağıda açıklanır. Güncel otomatik test kapsamı [kalite kontrol rehberinde](quality-checks.md), gerçek tarayıcı/HTTPS staging kabulü [kabul kaydında](../../deploy/STAGING_ACCEPTANCE.md) izlenir.

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

### Arşivlenmiş mağazalarda üretimi durdurma

Mağaza arşivlendiğinde `INACTIVE` olur. Aboneliğin hâlâ geçerli olması bu mağazada AI üretimine izin vermez. Worker, bekleyen üretim ve hazır yanıt işlerini model veya cevap gönderimi yapmadan atlar. Yeni taslak kuyruğu kaydı da yalnızca aktif mağaza için oluşturulur. Arşivleme transaction'ı mağazanın taslak işaretlerini temizler; mevcut cevapları ve taslak geçmişini silmez.

Arşivleme aynı transaction'da yalnızca o mağazanın devam eden üretim token'ını değiştirir. Mağaza hemen geri açılsa bile eski model sonucu kaydedilemez. Aynı workspace'teki başka mağazanın üretimi ve hesap cooldown'ı korunur. Arşivleme veya audit yazımı başarısız olursa mağaza durumu, işaretler ve token değişikliği birlikte geri alınır.

Manuel ve otomatik üretim ortak lease akışında mağaza aktifliğini kontrol eder. Stok/model çağrısı öncesinde kontrol tekrarlanır; taslak ve kota transaction'ı, arşivlemeyle aynı mağaza satırını kilitler. Arşivleme önce tamamlandıysa taslak/deneme ve kota kaydı oluşmaz. Taslak transaction'ı önce tamamlandıysa arşivlemeden önceki başarılı üretim korunur. Arşivleme sebebiyle iptal edilen iş için AI hatası veya kota uyarısı üretilmez. Başlamış dış model çağrısının sağlayıcı maliyeti geri alınamaz; geç gelen sonuç müşteri kotasına yazılmaz.

Bu değişiklik yeni migration veya env ayarı gerektirmez; mevcut mağaza ve `ai_draft_lease` tablolarını kullanır. Eski worker sürümleri bu kontrolü uygulamadığından arşivleme davranışı, yalnızca güncel backend/worker sürümüyle kullanılmalıdır.

### Kesintiye uğrayan taslak işlerini kurtarma

Mevcut taslak toparlama scheduler'ı **5 dakikada bir**, `PENDING` soruların **6 dakikadan eski `PROCESSING`** kayıtlarını da tarar. Bu süre tek başına yeniden üretim izni değildir: BullMQ işi bekliyor/çalışıyor/ertelenmişse veya aynı sorunun PostgreSQL lease'i hâlâ geçerliyse kayıt korunur. Redis durumunun okunamaması da yeniden üretim başlatmaz. Başlangıç tarihi olmayan eski kayıtlarda kuyruk tarihi, o da yoksa son güncelleme tarihi kullanılır.

İş Redis'te yoksa veya tamamlanmış/başarısız/sahipsiz durumdaysa, lease edinme ve kurtarma aynı workspace satır kilidiyle sıralanır. Transaction sorunun hâlâ aynı üretim denemesine ait olduğunu, mağaza/bağlantı/otomasyon ve cevap teslimatı durumunun değişmediğini kontrol eder. Uygun iş önce DB'de `QUEUED` yapılır, sonra aynı BullMQ kimliğiyle kuyruğa alınır. Redis gönderimi başarısız olursa DB kaydı kalıcı gönderim niyeti olarak kalır ve sonraki tarama tekrar dener. Saklanan `KNOWLEDGE_RESOLVED` işi, talepte bulunan kullanıcı bilgisiyle korunur; Redis'te bu niyet kaybolmuş ve otomasyon kapalıysa manuel üretim varsayılmaz.

Kota veya abonelik engeli varsa ilgili bekleme durumu kaydedilir. Arşivlenmiş mağaza, kopmuş bağlantı, eşleşmeyen ürün, kapalı otomasyon veya başlamış/belirsiz cevap teslimatı nedeniyle uygun olmayan sahipsiz iş `FAILED` yapılır ve açıklaması kaydedilir. Kurtarma doğrudan model veya pazaryeri çağrısı yapmaz; normal worker üretim öncesindeki kontrollerini yeniden uygular.

Worker'ın son hata ve kapasite erteleme işlemleri yalnızca kendi başlangıç/kuyruk tarihleriyle eşleşen denemeyi değiştirebilir. Eski worker'ın gecikmiş sonucu kurtarılan veya yeni başlamış işi bozamaz. Kurtarma, aynı sorunun süresi dolmuş lease token'ını da değiştirir; lease dolmadan başlamış ama satır kilidinde bekleyen eski transaction bile sonradan taslak commit edemez. Başka sorunun geçerli lease'i korunur. **Cevap gönderiminin `PROCESSING` kaydı bu kuralla tekrar gönderilmez**; belirsiz pazaryeri teslimatları için [ayrı teslimat rehberi](question-delivery-recovery.md) geçerlidir.

Bu kurtarma değişikliği yeni migration veya env ayarı gerektirmez; mevcut `ai_draft_lease` tablosunu kullanır. Redis bütünüyle silinmişse scheduler da kaybolur: Redis geri geldikten sonra backend yeniden başlatılmalı; başlangıç scheduler'ı yeniden kurar.

## İletişim ve destek görseli limitleri

İletişim formunda kayan bir saat içinde normalize edilmiş e-posta başına **3**, IP fingerprint'i başına **5** mesaj kabul edilir. İki limitin kilidi aynı PostgreSQL transaction'ında, sabit sırayla alınır; sayım ve kayıt kilitler bırakılmadan tamamlanır. Paralel backend süreçleri de aynı kilitleri paylaşır. Başarısız kayıt veya limit reddi hak tüketmez; honeypot alanı doluysa mevcut sessiz kabul davranışı korunur. Kilit kimlikleri hash'lenir, e-posta/IP açık olarak kullanılmaz.

Mesajlara bağlı destek görsellerinin toplamı hesap/workspace başına **512 MiB** ile sınırlıdır. Müşteri yanıtları, admin yanıtları ve dahili not görselleri aynı toplamı paylaşır. Görselli mesaj transaction'ı önce ilgili kullanıcıları sabit sırayla `FOR KEY SHARE`, sonra workspace'i `FOR NO KEY UPDATE` ve talebi kilitler; güncel toplam kontrolü ve görselleri mesaja bağlama aynı işlemde yapılır. Kullanıcı kilitleri, eşzamanlı hesap silmede mesaj/bildirim foreign key'lerinin ters kilit sırasına girmesini önler. Sıra hesap silmenin kullanıcı → workspace → talep sırasıyla uyumludur. Görselsiz mesajlar depolama kotasını veya workspace kilidini gerektirmez.

B2 yükleme kilidin dışında yapılır. Kota veya mesaj kaydı reddedilirse mesaja bağlanmamış dosyalar mevcut kalıcı temizleme akışına bırakılır; bağlı görseller silinmez. Başarısız mesaj/bildirim/audit işlemi, görsel kaydını ve kota kullanımını birlikte geri alır. İki kontrol `READ COMMITTED` kullanır; kilit bekledikten sonraki sayım, önceki başarılı işlemin kaydını görür. Bu düzeltme yeni migration veya env ayarı gerektirmez.

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
npm run check
```

Mevcut AI lease/kurtarma testleri bellek içi PostgreSQL ve taklit kuyruklarla çalışır. Eski push/log ve harici servis entegrasyon test dosyaları kaynakta bulunmuyor; `check` bunların geçtiği anlamına gelmez. Yukarıdaki HTTPS, push ve log senaryoları staging'de ayrıca doğrulanmalıdır.
