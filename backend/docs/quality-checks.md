# Kalite kontrolleri ve test kapsamı

Bu komutlar CI ile aynı lint, test ve build kontrollerini yerelde çalıştırır. Windows PowerShell script çalıştırma politikası `npm` komutunu engelliyorsa `npm.cmd` kullanın.

## Komutlar

Backend dizininde:

```sh
npm ci
npm run db:generate
npm run check
npm run test:integration
```

Frontend dizininde:

```sh
npm ci
npm run check
```

| Komut | Kapsam |
| --- | --- |
| Backend `npm test` | `src` altındaki bütün integration dışı `.spec.ts` dosyaları; yeni spec'ler otomatik keşfedilir. |
| Backend `npm run test:integration` | Bütün `.integration.spec.ts` dosyaları sırayla; PostgreSQL ve Redis gerekir. |
| Backend `npm run test:all` | Unit + integration testleri. Lint/build ayrıca `check` ile çalıştırılır. |
| Backend `npm run check` | Kaynak değiştirmeyen lint, bütün unit testleri, Nest production build. |
| Frontend `npm test` | `scripts/*.test.mjs`: görsel güvenlik konfigürasyonu ve server API davranış regresyonları. |
| Frontend `npm run check` | Kaynak değiştirmeyen lint, bütün frontend testleri, Next production build/TypeScript kontrolü. |
| Backend `npm run lint:fix` | İsteğe bağlı yerel lint düzeltmesi; CI kullanmaz. |

Lint sıfır hata ve sıfır uyarı ister. Node test runner'ın hata kodu üst komuta taşınır; başarısız test veya kapanış hatası başarılı sayılmaz. `src/generated` test keşfinden hariçtir. CI her iki projede ayrıca `npm audit --omit=dev` çalıştırır; `check` komutu bu ağ bağımlı taramayı içermez. Güncellemeler ve geçici override gerekçeleri: [bağımlılık güvenliği](dependency-security.md).

## Entegrasyon ortamı

`TEST_DATABASE_URL` için yalnızca localhost PostgreSQL kabul edilir. Kullanıcının test DB'si oluşturma/silme yetkisi olmalı. Her dosya `core_assist_*_test_<rastgele kimlik>` isimli ayrı DB oluşturur, bütün migration zincirini uygular ve sonunda kaldırır. Uygulamanın kendi DB tablolarına migration/seed uygulanmaz. Değişken verilmezse yerel `DATABASE_URL` bağlantısı DB oluşturmak için kullanılır; ayrı test PostgreSQL'i tercih edin.

`TEST_REDIS_URL` yalnızca localhost Redis olmalı. Verilmezse `REDIS_URL`, o da yoksa `redis://127.0.0.1:6379` kullanılır. Testler rastgele kuyruk adları/prefix'leri kullanır; uygulama kuyruklarını silmez, `FLUSHDB` çalıştırmaz. Ayrı test Redis'i tercih edin. Test sonuçlarının yerel billing ayarlarından etkilenmemesi için `BILLING_TEST_LIMITS_ENABLED=false` tanımlayın.

PowerShell örneği; portları kendi test servislerinize göre değiştirin:

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:local_test_only@127.0.0.1:5432/postgres'
$env:TEST_REDIS_URL='redis://127.0.0.1:6379/0'
$env:BILLING_TEST_LIMITS_ENABLED='false'
npm.cmd run test:integration
```

Prisma kendi bağlantı havuzuna sahiptir; `$disconnect()` havuzu kapatır. Test temizliği PostgreSQL'deki bağlantıların bitmesini en fazla 5 saniye bekler. Bağlantı kalırsa hata verir; `DROP DATABASE ... WITH (FORCE)` ile sürücü bağlantılarını zorla kesmez veya hatayı yutmaz. Yarım kalan test DB'leri varsa yalnızca test prefix'i ve sahibini doğruladığınız DB'leri temizleyin.

## Kritik regresyonlar

- Billing: eşzamanlı aynı idempotency anahtarı yalnızca bir kota birimi tüketir; farklı istekler son birimi aşamaz; ledger yazma hatası sayaç artışını geri alır; paralel mağaza açma kapasiteyi aşamaz.
- Abonelik: trial/iptal/gecikme ve 30 dakikalık yenileme toleransı; scheduler SQL filtresi ile istek erişiminin uyumu; yıllık planın ay sonu/artık yıl kota pencereleri. Onaylanmamış yenileme yeni kota açmaz; imzalı yeni dönem bildirimi açar.
- Paddle: SDK ile gerçek yerel HMAC doğrulaması; sahte imza reddi; eşzamanlı duplicate ve eski subscription snapshot; yanlış müşteri bağının transaction rollback'i ve aynı event ile yeniden deneme. `transaction.payment_failed` tek başına aboneliği aktif/pasif yapmaz.
- Hesap/mağaza sınırları: gerçek Nest HTTP controller ve guard'larında oturumsuz/başka müşteri erişimi, checkout Origin kontrolü, hesap yöneticisi ile mağaza yöneticisinin ayrımı, üyelik kaldırma, başka mağazaya ait soru kimliği, VIEWER cevap/taslak engeli.
- E-posta/duyuru: Resend imzası ve erken/tekrarlanan/sırasız event; rol hedefleme, mail switch'i, atomik yayın ve outbox; kayıtların hesap bazında ayrılması.
- Soru/cevap ve AI: PostgreSQL rollback/replay, cevap reconciliation ve belirsiz teslimat; gerçek BullMQ yeniden kurma/duplicate, AI lease/kota/yarış sınırları ve push abonelik limitleri.

Billing HTTP testlerinde oturum çözümleme sahte kullanıcılarla sağlanır; OAuth giriş yolculuğu test edilmez. Paddle event gövdeleri ve imzalar yereldir; gerçek checkout/tahsilat/plan değişikliği API'si çağrılmaz. E-posta/pazaryeri/ücretli AI servisleri test doubles ile değiştirilir. Bu kapsam gerçek sağlayıcıların uçtan uca kabulünün yerine geçmez.

Frontend server API testleri gerçek TypeScript istemcilerini çalıştırır; Next request headers ve fetch yerine yerel test doubles kullanır. Cookie ayrımı, public davete cookie gönderilmemesi, `no-store`, timeout, özel 404 sınıfları, onboarding hata sözleşmesi ve oturumsuz boş durumlar korunur. React cache bu testlerde passthrough'dur; Next'in gerçek SSR/cache ve tarayıcı davranışı staging kabulünde doğrulanmalıdır.

Auth handler regresyonu Origin/CSRF denetimini test örneğinde açıkça etkinleştirir. Better Auth'un `NODE_ENV=test` için Origin kontrolünü varsayılan atlaması bu güvenlik testine uygulanmaz; saldırgan origin ve güvenilmeyen subdomain için 403 beklentisi korunur.

## CI ve yayın kabulü

[Quality workflow](../../.github/workflows/quality.yml) pull request, `main`/`master`/`ci/production-readiness` push ve elle tetiklemede Node 22 üzerinde çalışır. Backend job'ı PostgreSQL 16 ve Redis 7 servisleri, `npm ci`, Prisma generate, `check` ve bütün integration testlerini içerir. Frontend job'ı `npm ci` ve `check` çalıştırır. Production secret kullanmaz ve deploy yapmaz. Workflow'un depoya eklenmesi GitHub üzerinde başarılı koşu alındığı anlamına gelmez; ilk koşu ayrıca doğrulanmalı, korunan dal için iki job required check olarak seçilmeli.

Docker kabulü ve gerekli image build komutları: [deploy rehberi](../../deploy/README.md). `node deploy/test-production.mjs` ayrı rastgele Compose projesinde readiness, kalıcılık, proxy logları, şifreli backup/restore ve gerçek SIGTERM kapanışını sınar.

Repo kökünde `node --test deploy/compose-config.test.mjs`, Docker Compose CLI ile production/staging örneklerinin ayrı volume/ağ/secret/backup/image adlarını ve staging sandbox/origin ayarlarını doğrular; konteyner veya secret dosyası gerektirmez. Backend CI job'ı bu üç kontrolü de çalıştırır. `test-quality.mjs` Linux uygulama testlerinden önce aynı kontrolü host üzerinde çalıştırır.

`node deploy/test-quality.mjs` CI'daki komutları temiz Node 22/Linux konteynerlerinde, gerçek env dosyaları olmadan çalıştırır. İzole DB/Redis ve yerel loglar kullanır; GitHub workflow koşusu yerine geçmez. Gerçek ortam sırası ve sonuç alanları: [staging kabul kaydı](../../deploy/STAGING_ACCEPTANCE.md).

Yayın öncesinde [incelemenin staging kabul matrisi](../../PRODUCTION_READINESS_AUDIT.md) ayrıca tamamlanmalı: HTTPS OAuth/oturum/Server Action, gerçek Paddle sandbox checkout-yenileme-plan değişikliği-iptal, Resend webhook ve teslimat, tarayıcı push, pazaryeri senaryoları, VDS yük ölçümü ve off-site restore. Otomatik testlerin geçmesi bağımlılık güvenlik bulgularını da kendiliğinden kapatmaz.
