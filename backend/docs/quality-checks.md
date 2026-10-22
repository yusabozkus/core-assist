# Kalite kontrolleri ve test kapsamı

Bu komutlar CI ile aynı lint, test ve build kontrollerini yerelde çalıştırır. Windows PowerShell script çalıştırma politikası `npm` komutunu engelliyorsa `npm.cmd` kullanın.

## Komutlar

Backend dizininde:

```sh
npm ci
npm run db:generate
npm run check
```

Frontend dizininde:

```sh
npm ci
npm run check
```

| Komut | Kapsam |
| --- | --- |
| Backend `npm test` | `src` altındaki bütün integration dışı `.test.ts` ve mevcut `.spec.ts` dosyaları otomatik keşfedilir. Yeni testler `.test.ts` olarak eklenir. |
| Backend `npm run check` | Kaynak değiştirmeyen lint, bütün unit testleri, Nest production build. |
| Frontend `npm test` | `scripts/*.test.mjs`: görsel güvenlik konfigürasyonu ve server API davranış regresyonları. |
| Frontend `npm run check` | Kaynak değiştirmeyen lint, bütün frontend testleri, Next production build/TypeScript kontrolü. |
| Backend `npm run lint:fix` | İsteğe bağlı yerel lint düzeltmesi; CI kullanmaz. |

Lint sıfır hata ve sıfır uyarı ister. Node test runner'ın hata kodu üst komuta taşınır; başarısız test veya kapanış hatası başarılı sayılmaz. `src/generated` test keşfinden hariçtir. CI her iki projede ayrıca `npm audit --omit=dev` çalıştırır; `check` komutu bu ağ bağımlı taramayı içermez. Güncellemeler ve geçici override gerekçeleri: [bağımlılık güvenliği](dependency-security.md).

## İzole yerel testler

Mevcut kaynakta ayrı PostgreSQL/Redis entegrasyon test dosyaları bulunmuyor. Olmayan dosyalara işaret eden hedefli test komutları, entegrasyon komutları ve kullanılmayan test DB yardımcısı kaldırıldı. Genel test runner'ı mevcut dosyaları keşfeder; hiç test bulunmaması veya bir testin başarısız olması hata koduyla sonuçlanır. CI yalnızca kaynakta bulunan testleri çalıştırır; harici servis entegrasyonunun geçtiği anlamına gelmez.

Destek görseli yaşam döngüsünün kontrolleri `npm test` içindedir. `support-image-lifecycle.test.ts`, gerçek görsel migration'ını bellek içi PGlite/PostgreSQL üzerinde çalıştırır; mevcut kayıtların korunmasını, hesap/talep silme zincirini, rollback'i ve temizliğe alınmış yüklemenin mesaja bağlanamamasını kontrol eder. `support-attachment.test.ts` B2 istemcisini taklit ederek yarım yükleme, hata/yeniden deneme, worker sahipliği ve tam anahtarın bütün sürümlerinin silinmesini kontrol eder. Bu kontroller `DATABASE_URL`, Redis, Docker veya gerçek B2 bağlantısı kullanmaz; tam uygulama ortamındaki E2E testinin yerine geçmez.

AI taslak kurtarma kontrolleri de `npm test` içindedir. `draft-execution.test.ts` mevcut lease migration'ını bellek içi PGlite üzerinde çalıştırır; geçerli sahipliğin korunmasını, eski token'ın commit/serbest bırakma engelini ve kurtarma rollback'ini doğrular. `question-draft-queue.test.ts` Redis iş durumlarını taklit ederek sahipsiz `PROCESSING`, kalıcı `QUEUED`, kota/abonelik, ayar değişimi ve sayfalama senaryolarını kontrol eder. `question-draft-worker.test.ts` eski worker callback'lerinin yeni denemeyi değiştiremediğini doğrular. Bu testler gerçek DB, Redis, AI, e-posta veya pazaryeri bağlantısı kullanmaz; fiziksel process-kill ve gerçek servis kabulünün yerine geçmez.

`store-ai-lifecycle.test.ts`, gerçek mağaza arşivleme/geri açma ve taslak üretim servislerini bellek içi PostgreSQL üzerinde çalıştırır; model ve bildirim servisleri taklit edilir. Arşivleme sırasında gelen model sonucunun taslak veya kota kaydı oluşturamadığını, geri açmanın eski sonucu canlandıramadığını, başarısız arşivlemenin rollback'ini ve aynı hesaptaki diğer mağazanın üretiminin korunduğunu doğrular. Worker testleri arşivlenmiş işlerde üretim, gönderim ve hata bildirimi yapılmadığını ayrıca kontrol eder.

## Kritik regresyonlar

`contact-rate-limit.test.ts` ve `support-image-quota.test.ts`, gerçek servisleri transaction kilitlerini taklit eden yerel kayıtlarla paralel çalıştırır. Bütün transaction'lar genel bir kuyrukta sıraya alınmaz; yalnızca kodun istediği e-posta/IP/workspace/talep kilitleri paylaşılır. Saatlik sınırlar, farklı talepler ve müşteri/admin/dahili not yarışı, rollback, yetki sınırı ve reddedilen yüklemenin temizliğe bırakılması doğrulanır. `atomic-limit-sql.test.ts` gerçek kilit SQL'ini ve bigint parametrelerini bellek içi PGlite'ta çalıştırır; commit/rollback sonrasında advisory kilitlerin kalmadığını doğrular. PGlite tek bağlantılıdır; bu SQL kontrolü gerçek çok süreçli PostgreSQL yük testinin yerine geçmez. Testler gerçek DB, B2, Redis veya e-posta bağlantısı açmaz.

- AI yanıtları: otomatik gönderim kararı, eksik bilgi, beden/ölçü ve ürün bağlamı; model yanıtları taklit edilir.
- Abonelik ve ödeme yöntemi: hesap yetkisi, Origin, abonelik/müşteri bağı, dönem sonu iptal, tekrar eden veya sonucu belirsiz işlemler; Paddle istemcisi taklit edilir.
- E-posta tercihleri: varsayılanlar, mevcut opt-out, kota eşikleri, rol/sessiz saat kontrolü, tekrarların engellenmesi ve digest; gerçek e-posta gönderilmez.
- AI analitiği ve kurulum rehberi: inceleme sayacı, dönem/pazaryeri ayrımı, detay sayfalama, üyelik kontrolü ve kullanıcı bazlı rehber ilerlemesi.

Mevcut testler bütün auth/tenant HTTP yollarını, Paddle/Resend webhook imzalarını, gerçek BullMQ yeniden başlatmayı veya pazaryeri cevap teslimatını uçtan uca doğrulamaz. Önceki koşuların kayıtları tarihsel kanıttır; kaldırılmış testlerin kapsamı güncel `check` sonucuna dahil değildir. Güncel kaynak kapsamı ve gerçek sağlayıcı kabulü ayrı değerlendirilmelidir.

Frontend server API testleri gerçek TypeScript istemcilerini çalıştırır; Next request headers ve fetch yerine yerel test doubles kullanır. Cookie ayrımı, public davete cookie gönderilmemesi, `no-store`, timeout, özel 404 sınıfları, onboarding hata sözleşmesi ve oturumsuz boş durumlar korunur. React cache bu testlerde passthrough'dur; Next'in gerçek SSR/cache ve tarayıcı davranışı staging kabulünde doğrulanmalıdır.

Frontend `dashboard-shell.test.mjs`, ana panel ve destek layout'larını ortak server bileşeniyle çalıştırır; API bağlantıları ve client bileşenleri taklit edilir. Temsilci/izleyici için kanal isteği ve kurulum rehberi olmaması, header'a aktif mağazanın rolünün aktarılması, mağaza yönetimi ile hesap/fatura yetkisinin ayrımı, arşivlenmiş mağaza, onboarding/oturum yönlendirmeleri ve mağazasız hesap desteği doğrulanır. Gerçek tarayıcı veya DB kullanılmaz.

`questions-list.test.ts`, gelen kutusunun arama ve durum filtrelerini birlikte uygulamasını, bekleyen sayacının sayfalamadan bağımsız filtreli toplamını ve yetki sınırını sahte kayıtlarla doğrular. Frontend `list-requests.test.mjs`, gerçek istek sahipliği kodunu geciktirilmiş sonuç/hata yanıtlarıyla çalıştırır: eski arama, sayfalama ve arka plan yenilemesi yeni listenin verisini, cursor'ını, sayacını veya yükleniyor durumunu değiştiremez. Aynı sayfayı eşzamanlı yükleme ve bileşen kapandıktan sonra gelen sonuçlar da sınanır. Gerçek DB veya tarayıcı kullanılmaz.

## CI ve yayın kabulü

[Quality workflow](../../.github/workflows/quality.yml) pull request, `main`/`master`/`ci/production-readiness` push ve elle tetiklemede Node 22 üzerinde çalışır. Backend job'ı `npm ci`, Prisma generate ve `check`; frontend job'ı `npm ci` ve `check` çalıştırır. İki job da production bağımlılık audit'i yapar. Mevcut testler için PostgreSQL/Redis servisleri başlatılmaz. Production secret kullanmaz ve deploy yapmaz. Önceki başarılı koşu ve commit [staging kabul kaydında](../../deploy/STAGING_ACCEPTANCE.md) yer alır; yeni aday aynı iki job için yeniden doğrulanmalı ve korunan dalda required check seçilmelidir.

Docker kabulü ve gerekli image build komutları: [deploy rehberi](../../deploy/README.md). `node deploy/test-production.mjs` ayrı rastgele Compose projesinde readiness, kalıcılık, proxy logları, şifreli backup/restore ve gerçek SIGTERM kapanışını sınar.

Repo kökünde `node --test deploy/compose-config.test.mjs`, Docker Compose CLI ile production/staging örneklerinin ayrı volume/ağ/secret/backup/image adlarını ve staging sandbox/origin ayarlarını doğrular; konteyner veya secret dosyası gerektirmez. Backend CI job'ı bu üç kontrolü de çalıştırır. `test-quality.mjs` Linux uygulama testlerinden önce aynı kontrolü host üzerinde çalıştırır.

`node deploy/test-quality.mjs` CI'daki komutları temiz Node 22/Linux konteynerlerinde, gerçek env dosyaları olmadan çalıştırır. Yalnızca backend/frontend kalite konteynerlerini kullanır; PostgreSQL/Redis servisi başlatmaz ve yerel logları saklar; GitHub workflow koşusu yerine geçmez. Gerçek ortam sırası ve sonuç alanları: [staging kabul kaydı](../../deploy/STAGING_ACCEPTANCE.md).

Yayın öncesinde [staging kabul kaydı](../../deploy/STAGING_ACCEPTANCE.md) ayrıca tamamlanmalı: HTTPS OAuth/oturum/Server Action, gerçek Paddle sandbox checkout-yenileme-plan değişikliği-iptal, Resend webhook ve teslimat, tarayıcı push, pazaryeri senaryoları, VDS yük ölçümü ve off-site restore. Otomatik testlerin geçmesi bağımlılık güvenlik bulgularını da kendiliğinden kapatmaz.
