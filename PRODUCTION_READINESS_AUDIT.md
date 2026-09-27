# Core Asistan — Production hazırlık incelemesi

**Tarih:** 26 Eylül 2026
**İncelenen commit:** `2aa091e` ve çalışma dizininin mevcut hali
**Hedef:** Docker üzerinde Next.js + NestJS + PostgreSQL + Redis; gerçek müşteri kullanımına geçiş öncesi değerlendirme.

## Staging kaynak ayrımı (28 Eylül 2026)

Dağıtım hazırlığında sabit `core-assist-production` proje adının `DEPLOYMENT_ENV=staging` ile değişmediği görüldü. Aynı Docker hostunda farklı checkout/env kullanmak tek başına PostgreSQL/Redis volume'lerini ayırmıyordu. Compose adı artık `core-assist-${DEPLOYMENT_ENV:-production}`; mevcut production kaynak adları korunuyor. Açık `-p`/`COMPOSE_PROJECT_NAME` override'ları hâlâ önceliklidir.

- `deploy/.env.staging.example`: ayrı secret ve backup yolları, staging image etiketi, sandbox ve production cookie kapsamı dışında örnek domainler. Gerçek domain/anahtar oluşturulmadı.
- Üç Compose config regresyonu **3/3 geçti**: ortam kaynak ayrımı, sandbox/public origin/cookie ayarları ve test projesi override'ı. Test konteyner başlatmadan örnek dosyaları çözümler; backend GitHub job'ına ve yerel kalite girişine eklendi.
- Deployment rehberi staging hazırlığını, 80/443 nedeniyle aynı hostta eşzamanlı yayın sınırını ve production cookie domaininin alt domainlerine cookie gönderilmesini açıklıyor.
- Uygulama kodu değişmedi; önceki 140 unit + 55 integration + 8 frontend sonucu tarihsel olarak geçerli, bu tur tekrar çalıştırılmadı. GitHub koşusu, gerçek VDS/HTTPS ve sağlayıcı kabulü **bekliyor**; commit/push yapılmadı.

## CI ortamı ve staging hazırlığı (27 Eylül 2026)

**Gerçek env dosyaları olmadan temiz Node 22/Linux CI komutları geçti.** Tekrarlanabilir kontrol: `node deploy/test-quality.mjs`. Script kaynakları açık dosya listesiyle kopyalar; `.env`, secrets, yerel node_modules/build çıktıları kullanılmaz. Geçici PostgreSQL/Redis host portu yayınlamaz ve testlerin localhost koruması korunur.

- İlk koşuda **139/140 unit** geçti: Better Auth'un `NODE_ENV=test` altında Origin denetimini varsayılan atlaması auth testindeki 403 beklentisini bozdu. Test örneğinde Origin/CSRF korumaları açıkça etkinleştirildi; production uygulama davranışı değiştirilmedi. Hedefli auth 20/20 ve ESLint başarılı.
- Düzeltmeden sonraki temiz koşuda backend **140/140 unit + 55/55 integration**, frontend **8/8 test**; iki tarafta production dependency audit'i **0 bulgu**, genel lint ve build **exit 0**. Frontend build gerçek `.env.local` olmadan geçti. Migration'lar yalnızca izole test DB'lerine uygulandı.
- Başarılı koşu logları `.ops-test/core-quality-test-7b0e6b487e/` altında; geçici konteyner/volume/image'lar temizlendi. Script sözdizimi ve `git diff --check` başarılı.
- **GitHub-hosted workflow çalıştırılmadı.** Remote `yusabozkus/core-assist` mevcut, ancak düzeltmeler yerel çalışma dizininde ve workflow henüz untracked. Commit/push yapılmadı; bu ortamda `gh` aracı da yok. Gerçek koşu aynı release adayı SHA için ayrıca doğrulanmalı.
- **Gerçek staging kabulü yapılmadı.** VDS/domain bilgisi henüz doğrulanmadı; yerelde `deploy/.env` ve `deploy/secrets` yok. `.ops-test/.../backend.env` sahte yerel test dosyasıdır, staging env'i değildir.

Sonraki işlem sırası ve bekleyen sonuç kaydı: [staging kabulü](deploy/STAGING_ACCEPTANCE.md). Gerçek GitHub koşusu için yayın adayının depoya taşınması; HTTPS/sağlayıcı kabulü için VDS, web/API originleri ve test hesapları gerekiyor. **GPT-6 Astra / High** ile devam edilebilir.

## Ek güvenlik kapanışı — backend bağımlılıkları (27 Eylül 2026)

**Backend'in güncel dependency bulguları kapatıldı; yerel testler ve Linux Docker kabulü geçti.** Başlangıçta 6 high + 1 moderate etkilenmiş paket vardı; güncelleme sonrası hem production hem geliştirme dahil backend audit'i **0 bulgu / exit 0**. Sürüm gerekçeleri, erişim değerlendirmesi, resmi kaynaklar ve override bakım koşulları: [bağımlılık güvenliği](backend/docs/dependency-security.md).

| Değişiklik | Sonuç |
| --- | --- |
| Nest HTTP zinciri | `common`, `core`, `platform-express` 11.2.3 → **11.2.6**; Multer 2.2.0 → **2.4.0**. Express/body-parser altındaki qs 6.15.3 → **6.16.0**. |
| Prisma alt bağımlılıkları | Yalnızca `@prisma/config@7.10.0` için deepmerge-ts **8.0.2**, `prisma@7.10.0` için mysql2 **3.24.4** override'ı. CLI/Client/adapter mevcut **7.10.0** sürümüne sabitlendi. Prisma major geçişi ve yeni migration yok. |
| CI | Backend ve frontend job'larına `npm audit --omit=dev` eklendi; üretim dependency bulgusu veya registry hatası kontrolü başarısız kılar. İlk uzak GitHub koşusu henüz yapılmadı. |

### Doğrulama ve sınırlar

- Backend genel lint **0 hata / 0 uyarı**, **140/140 unit**, **55/55 integration**, production build başarılı. Tüm migration zinciri yalnızca rastgele test DB'lerinde çalıştı. Uygulama DB'si değiştirilmedi.
- Prisma gerçek config yükleme, schema/datasource kontrolü, `validate` ve codegen başarılı. deepmerge 8'in Map/tip değişiklikleri proje config'inde kullanılmıyor; düz nesne yapılandırması ve migration zinciri test edildi. MySQL bağlantısı/Prisma Studio kabulü yapılmadı; uygulama PostgreSQL kullanıyor.
- Node 22 Linux image'ı temiz tam/runtime `npm ci`, codegen ve Nest build ile üretildi; iki kurulumda da audit 0 bulgu.
- Güncel image ile production Compose migration/bootstrap, readiness kesinti-toparlanma, Redis AOF, Caddy log redaksiyonu, şifreli backup/restore ve gerçek SIGTERM testleri geçti. Aktif worker/HTTP/SSE kapanışında DB yazıları disconnect öncesinde tamamlandı. İzole test DB'leri, konteynerleri ve kabul projesi volume'leri temizlendi.
- Workflow YAML ve `git diff --check` doğrulandı. Frontend kodu değişmedi; 6. adımdaki 8/8 test sonucu korunuyor, bu tur yeniden çalıştırılmadı. Frontend dev dependency taramasında önceki 1 moderate bulgusu bu backend çalışmasının kapsamı değildir.

**Sıradaki aşama:** İlk uzak CI koşusu ve staging kabul matrisi. Gerçek domain/OAuth, Paddle sandbox checkout-yenileme-plan değişikliği, Resend/push/pazaryeri kabulü, hedef VDS yükü ve off-site restore tamamlanmalı. Sıfır dependency audit'i tek başına production onayı değildir. **GPT-6 Astra / High** ile devam edilebilir; model/düzey değişikliği gerekmiyor.

## Düzeltme ilerlemesi — 6. adım (27 Eylül 2026)

**Somut tekrar ve bağımlılık temizliği tamamlandı.** Bu adım frontend ve dokümantasyonla sınırlı; backend iş akışları ve veritabanı şeması değiştirilmedi.

| Alan | Sonuç |
| --- | --- |
| Server API | 23 server istemcisindeki 27 GET çağrısı `lib/api/server-fetch.ts` yardımcısını kullanıyor. API adresi, `no-store`, JSON Accept, istek başına cookie ve timeout tek yerde. Oturumsuz boş/hata dönüşleri, özel 404 sınıfları, response tipleri ve mevcut React cache çağıran dosyalarda korunuyor. Public davet isteği açıkça `cookie: null` kullanıyor. |
| Sınıf birleştirme | HoverCard ortak `@/lib/utils` içindeki `cn` yardımcısına taşındı; tek kullanımlı ayrı `cn` paketi kaldırıldı. Bileşen className değerleri değiştirilmedi. |
| CLI/build bağımlılığı | `shadcn` devDependencies'e taşındı. İlk incelemedeki CLI tespitine ek olarak `app/globals.css` içindeki `shadcn/tailwind.css` kullanımı doğrulandı; paket tamamen kaldırılmadı. Build devDependencies kuruyor, runtime standalone çıktıyı kullanıyor. |
| İçerik ve rehberler | Backend/frontend şablon README'leri gerçek kurulum, test, API ve Docker akışlarıyla değiştirildi. Metadata artık uygulanmamış WhatsApp/Instagram yönetimi vaat etmiyor. Frontend örnek env dosyasına isteğe bağlı server API adresi açıklaması eklendi. |

### 6. adım doğrulama kanıtı

- Frontend `npm run check`: **lint 0 hata/0 uyarı, 8/8 test, production build/TypeScript başarılı**. Yeni 6 regresyon testi cookie ayrımı, URL önceliği, public davet, oturumsuz davranış, özel HTTP hataları, onboarding ve gerçek abort sinyalini kapsıyor. Mevcut 2 görsel güvenlik testi korunuyor. CI `check` üzerinden bu testleri de çalıştıracak.
- Node 22 Linux Docker image'ı temiz `npm ci` ve Next build ile başarılı üretildi; `shadcn` CSS importu, standalone/static/public çıktıları doğrulandı. Lockfile'da `cn` kaldırıldı ve `shadcn` dev olarak işaretlendi. `git diff --check` temiz.
- Güncel frontend **`npm audit --omit=dev`: 0 bulgu, exit 0**. Bu sonuç üretim dependency sınıflandırmasına aittir; geliştirme bağımlılıkları dahil Linux kurulumunda 1 moderate uyarısı devam ediyor. Backend güvenlik bulguları bu adımda güncellenmedi/kapatılmadı.
- Backend kodu değişmediğinden 5. adımdaki 140 unit + 55 integration testi yeniden çalıştırılmadı. Frontend testleri Next request context/fetch için test doubles kullanır; gerçek tarayıcı, React cache ve oturumlu SSR uçtan uca kabulü yapılmış sayılmaz. HoverCard için yeni tarayıcı görsel kabulü yapılmadı.

**Bu adımdan sonraki çalışma:** Backend dependency güvenlik kapanışı tamamlandı; güncel kanıt raporun başındadır. İlk uzak CI koşusu ve staging kabul matrisi bekliyor.

## Düzeltme ilerlemesi — 5. adım (27 Eylül 2026)

**QA-01 için kod, yerel lint/test/build kontrolleri ve CI workflow'u tamamlandı.** GitHub üzerinde ilk workflow koşusu ve gerçek HTTPS/sağlayıcı staging kabulü bekliyor. Komutlar, ortam hazırlığı ve testlerin sınırları: [kalite kontrol rehberi](backend/docs/quality-checks.md).

| Alan | Uygulanan değişiklik |
| --- | --- |
| Lint | Backend biçimlendirme ve fixture scriptindeki tip güvenliği; frontend kullanılmayan importlar ve admin iletişim detay sayfasındaki render/catch ayrımı düzeltildi. Hesap değiştirmede oturum/router önbelleğini sıfırlayan tam sayfa yönlendirmesi korunarak ilgili lint istisnası gerekçelendirildi. |
| Ortak komutlar | Backend `npm test` bütün unit spec'lerini, `test:integration` bütün integration spec'lerini otomatik bulur. `test:all` ikisini çalıştırır. Her iki projede `check` lint/test/build çalıştırır; lint kaynak değiştirmez, hata veya uyarıda başarısız olur. Backend otomatik düzeltmesi ayrı `lint:fix` komutudur. |
| DB kapanışı | Prisma bağlantı havuzunun sahipliği adapter'a verildi. Testler disconnect sonrasında DB bağlantılarının bitmesini sınırlı süre bekler; bağlantı kalırsa hata verir. Test DB'sini `WITH (FORCE)` ile silip geç gelen sürücü hatası üretme riski kaldırıldı. |
| Billing/tenant | 2 policy unit testi ve 13 gerçek PostgreSQL/Nest HTTP integration testi eklendi. Kota/idempotency/rollback, mağaza kapasitesi, abonelik dönemleri, Paddle imzası/duplicate/stale event, hesap/mağaza yetkileri, üyelik iptali ve soru kapsamı korunuyor. |
| Ek doğrulanmış düzeltme | Tekrarlı integration çalışmasında ilk soru alımında eşzamanlı `incomingEvent.upsert({ update: {} })` çağrılarından biri `P2002` verdi. Receipt oluşturma `createMany(skipDuplicates)` + unique okuma ile PostgreSQL çakışma korumasına taşındı; payload ve soru/event atomik persist davranışı korundu. 5 tur × 10 eşzamanlı istek tek event/tek soru oluşturuyor. |
| Test kararlılığı | BullMQ scheduler kaldırıldıktan sonra bekleyen ilk iş legacy-job testine karışabiliyordu. Sadece o teste ait rastgele kuyruk, scheduler kontrolü ile legacy-job aşaması arasında temizleniyor. Abonelik yenileme testi sabit takvim zamanı kullanıyor. |
| CI | `.github/workflows/quality.yml`: Node 22, temiz `npm ci`, codegen, backend/frontend lint/build/test ve izole PostgreSQL 16/Redis 7 integration job'ları. Production secret veya deploy adımı yok. |

### 5. adım doğrulama kanıtı

- Genel backend ve frontend lint **0 hata / 0 uyarı**. Backend **140/140 unit test**; frontend güvenlik **2/2 test**; iki tarafta production build ve TypeScript kontrolü başarılı.
- Ortak integration komutu **55/55 test, exit 0**: e-posta/duyuru 12, billing/tenant 13, soru/cevap teslimatı 20, AI/push korumaları 10. Migration'lar yalnızca rastgele test DB'lerinde çalıştırıldı; uygulama veritabanı değiştirilmedi.
- E-posta integration paketi ayrıca **3 ardışık çalışmada 12/12, exit 0** verdi; test sonrası uncaught exception oluşmadı. İlk incelemedeki kapanış hatası bu turda düzeltme öncesi yeniden üretilemedi; riskli pool/force-drop sırası kaldırıldı ve tekrarlarla doğrulandı. Sınırsız kararlılık garantisi verilmez.
- Soru alımındaki yarış ve scheduler test izolasyonu düzeltildikten sonra teslimat paketi iki ek tekrarda **20/20, exit 0** verdi. Test DB'lerinin temizlendiği ayrıca kontrol edildi; bu çalışma için açılan geçici PostgreSQL/Redis konteynerleri kaldırıldı.
- Linux backend/frontend image build'leri başarılı. Prisma yaşam döngüsü değişikliğinden sonra production Compose kabulü yeniden geçti: PostgreSQL/Redis readiness kesinti-toparlanma, Redis kalıcılığı, Caddy log redaksiyonu, şifreli backup/restore ve gerçek SIGTERM. Aktif BullMQ işi + HTTP yazısı + SSE harness'ı provider kapanışından önce tamamlandı. İzole kabul projesi/volume'leri kaldırıldı.
- Workflow YAML'i yerelde doğrulandı. **GitHub Actions üzerinde çalıştırılmadı**; ilk uzak koşu ve required check ayarı yapılmalı. `git diff --check` başarılı.

**Açık kalan kabul:** Gerçek OAuth/tarayıcı yolculukları, Paddle sandbox checkout/yenileme/plan değişikliği/iptal, Resend gerçek webhook ve teslimat, tarayıcı push/pazaryeri hata toparlama; hedef VDS yük testi ve uzaktan backup restore. Billing HTTP testleri sahte oturum çözümleme ve yerel imzalı Paddle payload'ları kullanır; gerçek sağlayıcı E2E kanıtı değildir. Mevcut dependency güvenlik bulguları bu adımla kapanmış sayılmaz. Runtime test çıktısında dependency kaynaklı deprecation uyarıları görüldü; lint uyarısı veya test hatası değildir, dependency güncelleme değerlendirmesinde takip edilmeli.

**Bu adımdan sonraki çalışma:** 6. adım tamamlandı; güncel sonuç raporun başındadır. Yayın için staging kabulü ve açık dependency değerlendirmesi devam ediyor.

## Düzeltme ilerlemesi — 4. adım (27 Eylül 2026)

**OPS-01 ve OPS-02 için dağıtım dosyaları, runtime korumaları ve yerel Linux Docker kabulü tamamlandı.** Gerçek VDS'ye deploy yapılmadı; public DNS/TLS, dış sağlayıcı kabulü, off-site storage kurulumu ve hedef VDS yük ölçümü bekliyor. Tam işletim rehberi: [deploy/README.md](deploy/README.md).

| Alan | Uygulanan değişiklik |
| --- | --- |
| Docker | Ayrı production Compose: PostgreSQL, Redis, tek seferlik migration, backend, Next standalone frontend ve Caddy. Yalnızca proxy portları yayınlanıyor. Uygulamalar root olmayan kullanıcı/salt okunur filesystem; kalıcı volume, bellek ve log sınırları var. Geliştirme DB/Redis portları localhost'a sınırlandı. |
| Sırlar ve ayarlar | Dosya tabanlı Compose secrets; `.env` image'a girmiyor. DB/Redis URL'leri secret dosyalarından kuruluyor. Frontend public ayarları build arg, SSR API adresi iç ağ. Production'da mock connector/test billing/yanlış Paddle ortamı ve eksik temel anahtarlar reddediliyor. Açık staging seçimi sandbox'a izin veriyor. |
| Proxy | Caddy otomatik HTTPS yapılandırması, gövde sınırı, SSE flush ve API readiness takibi. Erişim ve HTTP hata loglarından URI/header alanları çıkarılıyor; davet URL'leri proxy logunda korunuyor. |
| Kalıcılık ve yedek | Redis AOF/everysec + noeviction. PostgreSQL custom dump doğrudan age ile şifreleniyor; checksum ve yeni DB'ye restore scripti var. Rclone off-site copy ve günlük systemd şablonu eklendi; gerçek remote/anahtar yapılandırılmadı. |
| Readiness | `/health` liveness olarak korundu; `/health/ready` bootstrap, shutdown ve sınırlı PostgreSQL/Redis probe sonuçlarını kontrol ediyor. Kesintide 503, toparlamada 200. |
| Kapanış | Açık SIGTERM/SIGINT koordinasyonu: yeni HTTP/worker işi durduruluyor; SSE bitiriliyor; HTTP, worker ve periyodik temizlik tamamlanıyor; sonra Nest/Prisma/Redis kapanıyor. Nest'in Prisma'yı worker'dan önce kapatma riski bu sırayla önleniyor. İç deadline 150 saniye, Docker grace 180 saniye. |

### 4. adım doğrulama kanıtı

- Backend ve frontend **temiz Linux Docker image build'leri başarılı**: Node 22, Prisma generate + Nest build ve Next.js standalone/static/public çıktısı. Gerçek production Compose, sahte sırlar ve rastgele proje/volume ile çalıştırıldı; bütün migration zinciri boş izole DB'ye uygulandı. Root olmayan/salt okunur uygulama konteynerleri ve iç servislerin port yayınlamaması doğrulandı.
- PostgreSQL ve Redis ayrı ayrı pause edilerek **readiness 503 / liveness 200**, ardından unpause ile readiness toparlaması doğrulandı. Bu denemeler mevcut geliştirme DB/Redis konteynerlerine uygulanmadı.
- Redis'te gerçek `AOF` ve `noeviction` ayarları okundu; test kaydı yazılıp Redis yeniden başlatıldı ve kayıt korundu. Bu normal restart kanıtıdır; elektrik kesintisinde sıfır kayıp kanıtı değildir.
- Gerçek Caddy config doğrulandı; aynı proxy kuralları internal HTTP test originleriyle çalıştırıldı. API/frontend yönlendirmesi; normal/encoded davet yolu ve query/referer içindeki sahte token'ın erişim logunda bulunmaması; backend kapalıyken proxy hata logunda token bulunmaması doğrulandı. Public ACME sertifikası istenmedi.
- Şifreli PostgreSQL dump üretildi; checksum/decrypt/restore scriptiyle **ayrı DB'ye geri dönüldü ve sentinel veri okundu**. Bu yerel backup/restore kabulüdür; uzaktaki storage'dan geri dönüş henüz yapılmadı.
- Gerçek backend'e Docker SIGTERM gönderildi; yaklaşık 2 saniyede **exit 0** ve shutdown tamamlandı kaydı alındı. Ayrı harness'ta gerçek Nest/BullMQ/Prisma/bildirim SSE akışı kullanıldı: aktif 5 saniyelik job ve HTTP isteği veritabanına yazdı, SSE kapandı, ardından provider'lar kapandı. Ücretli AI veya pazaryeri gönderimi kullanılmadı.
- Backend integration dışı **138/138 test**, frontend güvenlik **2/2 test** başarılı. Yeni 3 runtime testinde yanlış production ayarları ve HTTP/worker/provider kapanış sırası korundu. Yerel backend build, değişen TS dosyalarında hedefli ESLint ve `git diff --check` başarılı. Genel lint ve kalan entegrasyon kapanış sorunu hâlâ 5. adımın kapsamıdır.

**Sınırlar / yayın öncesi kalan işler:** Public TLS/OAuth/webhook origin kabulü; gerçek off-site yedek hedefi, anahtar kurtarma kopyası, timer/retention/disk alarmı; hedef VDS yük ve uzun iş deadline ölçümü yapılmalı. Redis AOF sunucu dışı yedek değildir, tüm kuyruklar için kayıpsız felaket toparlama garantisi verilmez. DB restore sonrasında dış teslimatlar uzlaştırılmadan eski işler yeniden çalıştırılmamalı. Container health durumu tek başına restart/uyarı mekanizması değildir. Bu değişiklikler uygulamayı doğrudan müşteri trafiğine açma onayı değildir.

**Bu adımdan sonraki çalışma:** 5. adım — QA-01; güncel sonucu raporun başındaki 5. adım bölümündedir.

## Düzeltme ilerlemesi — 3. adım (27 Eylül 2026)

**PUSH-01, AI-01 ve LOG-01 için kod ve yerel regresyon testleri tamamlandı.** Gerçek tarayıcı push/HTTPS staging kabulü bekliyor. Yeni `ai_draft_lease` migration'ı mevcut uygulama DB'sine uygulanmadı. Geçiş ve sınırlar: [koruma rehberi](backend/docs/production-guards.md).

| Alan | Uygulanan değişiklik |
| --- | --- |
| Push hedefi | Kayıtta ve gönderimde HTTPS/443 servis izin listesi, gerçek P-256/auth anahtar doğrulaması. Socket DNS çözümlemesinde özel/ayrılmış IP reddi; doğrulanan adresler doğrudan bağlantıda kullanılıyor. Redirect yok; toplam 10 saniye ve yanıt boyutu sınırı var. Mevcut VAPID/şifreleme ve 404/410 temizliği korunuyor. |
| Push kapasitesi | Kullanıcı başına 10 abonelik; paralel kayıtlar DB kilidiyle kontrol ediliyor. Başka kullanıcıya ait endpoint ve anahtarlar devralınamıyor. Eski kayıtlar da gönderimde doğrulanıyor. |
| AI paralelliği | Manuel/otomatik bütün taslak girişleri hesap başına tek PostgreSQL lease kullanıyor; başlangıçlar arasında 5 saniye var. Aynı sorunun tekrarları ve farklı soruların son kota hakkı için yarışı engelleniyor. Başka hesaplar bu kilidi paylaşmıyor. |
| AI toparlama | Süreli ve yenilenen sahiplik, token ile eski işin commit/release engeli. Taslak ve kota aynı transaction'da korunuyor. Kapasite bekleyen otomatik job başarısız deneme sayılmadan erteleniyor. Üretim sırasında cevap kuyruğa alınmışsa taslak commit edilmiyor. |
| Davet logları | HTTP path, encoded path, logger context, iç içe metadata ve hata metinlerindeki davet token'ı maskeleniyor. Normal rota/durum/süre tanı bilgisi korunuyor. Proxy/CDN logları 4. adımın konusu. |

### 3. adım doğrulama kanıtı

- **14/14 hedefli güvenlik testi başarılı:** izinli/yanıltıcı push hostları, özel IP'ler, yanlış anahtarlar, DNS yanıtları, redirect/410 davranışı, toplam timeout ve timeout sonrası toparlama; 200/400/401/404/500 ve yarıda kesilen isteklerde token redaksiyonu; JSON/pretty/context/error logları.
- **10/10 yeni entegrasyon testi başarılı:** aynı soruya 10 paralel manuel/otomatik istekte tek üretim/tek kota; farklı soruların son kota hakkı yarışı; başarısız üretim sonrası kilit bırakma ve cooldown; ücretsiz yeniden üretim kuralı; lease expiry sonrası eski sahibin commit/release reddi; taslak hazırlanırken cevap kuyruğa alınması; hesaplar arası bağımsızlık; paralel push kayıt sınırı ve kullanıcılar arası sahiplik; gerçek BullMQ üzerinde deneme hakkı tüketmeden erteleme.
- Entegrasyonda rastgele isimli izole PostgreSQL DB'sine bütün migration zinciri uygulandı; gerçek Redis'te yalnızca rastgele test prefix'i kullanıldı. AI/push sağlayıcı çağrıları taklit edildi. Gerçek uygulama DB/kuyruğuna test kaydı, ücretli model çağrısı, e-posta veya pazaryeri cevabı gönderilmedi.
- Integration dışı backend testlerinin tamamı **135/135 başarılı** (14 yeni test dahil). Backend production build başarılı; değişen kaynak/test dosyalarında hedefli ESLint **0 hata, 0 uyarı**, `git diff --check` temiz. Bu adımda frontend değişmedi; yeni tarayıcı uçtan uca testi yapılmadı.

**İşletim sınırları:** Hesap başına tek AI üretimi bilinçli kapasite sınırıdır; manuel istekte mevcut panelin `429 / AI_RATE_LIMITED` bekleme yanıtı kullanılır. Gönderilmiş provider isteğinin maliyeti geri alınmaz; process kaybında eski dış çağrının iptal edildiği varsayılmaz. Stok kontrolü akışı tek üretimde iki model çağrısı yapabilir. Backend redaksiyonu eski logları/proxy loglarını temizlemez. Yeni sürüm öncesi migration ve eski worker durdurma sırası uygulanmalı; karışık sürüm korumayı aşabilir.

**Bu adımdan sonraki çalışma:** 4. adım — OPS-01 ve OPS-02; güncel sonucu raporun başındaki 4. adım bölümündedir.

## Düzeltme ilerlemesi — 2. adım (27 Eylül 2026)

**SYNC-01 ve ANSWER-01 için kod, migration, panel davranışı ve yerel regresyon testleri tamamlandı.** Gerçek pazaryeri ve hedef Linux/VDS kesinti kabulü son test aşamasında yapılacak. Mevcut uygulama DB'sine migration uygulanmadı; sürüm geçişi için eski worker'ları durdurma sırası [toparlanma rehberinde](backend/docs/question-delivery-recovery.md) bulunuyor.

| Alan | Uygulanan değişiklik |
| --- | --- |
| Soru tekrarları | Event varlığı artık tamamlanma sayılmıyor. Event satırı kilitleniyor; soru oluşturma ve event tamamlama tek transaction. İlk işlem başarısızsa tekrar soru oluşturabiliyor; eşzamanlı tekrarlar tekilleşiyor. |
| Önceden kaybolmuş sorular | Soru senkronizasyonu başında sorusu olmayan `PENDING`/`FAILED` event'ler saklanan payload ve mevcut provider normalizer'larıyla yeniden işleniyor. Eksik/mock payload'lar taze sağlayıcı verisini bekliyor; veri tahmin edilmiyor. |
| DB → Redis aktarımı | `QuestionAnswer` satırı kalıcı gönderim niyeti olarak kullanılıyor. Enqueue hatasında `QUEUED` korunuyor. 60 saniyelik reconciliation eksik işleri kararlı iş kimliğiyle tamamlıyor; eski tamamlanmış/başarısız job'ları da ele alıyor. |
| Gönderim sınırı | Dış POST öncesinde yalnızca `QUEUED` satır koşullu olarak `PROCESSING` yapılabiliyor. İki worker aynı cevabı gönderemiyor. `queuedAt` deneme kimliği eski job'ın yeni isteği değiştirmesini engelliyor. |
| Belirsiz sonuç | Sağlayıcı çağrısı hatası veya gönderim sonrası DB hatası `REVIEW_REQUIRED` oluşturuyor; yeniden POST yok. 15 dakikayı aşan sahipsiz `PROCESSING` kayıtları da incelemeye alınıyor. Dış gönderimden önceki hatalar normal retry/FAILED akışını koruyor. |
| Kullanıcı/admin | Soru listesinde Teslimat kontrolü durumu ve filtresi; cevap alanında gerekçe, gönderilecek metin ve destek yolu; taslak geçmişinde/analitikte doğru etiket; admin gönderim sorunlarında görünürlük. Belirsiz teslimat için tekrar gönderim ve yeni taslak engelleniyor. |
| Operatör çözümü | Derlenmiş backend'de `repair:answer` komutu, worker'lar durdurulup pazaryeri sonucu doğrulandıktan sonra `sent`/`not-sent` kararı kaydediyor. Transaction içinde audit var; komut dış gönderim yapmıyor. |
| Geçiş | İki migration: yeni enum ve eski sürümde denenmiş belirsiz kayıtların incelemeye alınması. Eski worker'larla karışık sürüm çalıştırılmamalı. Prisma client yeniden üretildi. |

### 2. adım doğrulama kanıtı

- **20/20 yeni entegrasyon testi başarılı.** Rastgele isimli izole PostgreSQL DB'sinde migration zinciri ve gerçek transaction/kilit davranışı kullanıldı. Redis'te yalnızca rastgele test prefix'ine sahip BullMQ kuyruğu oluşturuldu ve temizlendi.
- Event insert sonrası ürün çözümleme hatası; soru insert ve event completion sırasında PostgreSQL trigger'ıyla hata; beş eşzamanlı soru tekrarı; eski failed/pending payload replay; bağlantıdan eski sorunun ignore davranışı doğrulandı.
- Enqueue öncesi kayıp ve Redis kabulünün belirsiz kalması; gerçek Redis'te eksik job toparlama, iki reconciler, eski job biçimi ve duplicate iş; paralel iki worker; sağlayıcı kabulünden sonra ağ cevabı kaybı; sağlayıcı başarısından sonra yerel commit hatası doğrulandı. Dış sağlayıcı çağrısı taklit edildi ve ilgili senaryolarda çağrı sayısı **1** kaldı.
- Eski PROCESSING kaydının incelemeye dönüşmesi, ön kontrol hatasında güvenli FAILED durumu, iki operatör kararı/audit, eski job'ın yeni denemeye müdahale edememesi, SAFE_AUTO açık/sonradan kapalı koşulları ve legacy migration'ın durum ayrımı doğrulandı.
- Mevcut integration dışı **121/121 test başarılı**. Backend ve frontend production build başarılı; değişen kaynak/test dosyalarında hedefli ESLint **0 hata, 0 uyarı**, `git diff --check` temiz. Backend build'in ilk denemesinde önceki adımdaki Windows `dist` temizleme `ENOTEMPTY` hatası tekrar görüldü; tekrar derleme başarılı.
- Gerçek müşteri DB'sine/uygulama Redis kuyruğuna test verisi yazılmadı; ödeme, e-posta, ücretli AI veya pazaryeri cevabı gönderilmedi. Fiziksel process-kill ve gerçek sağlayıcı sandbox testi yapılmış gibi kabul edilmemeli.

**İşletim sınırları:** Redis tamamen sıfırlanırsa scheduler da silinir; yeni backend yeniden başlatılarak scheduler kurulmalı. `REVIEW_REQUIRED` otomatik teslimat doğrulaması değildir; sağlayıcı sonucu operatörce doğrulanmalıdır. Operatör komutundaki worker durdurma beyanı makineleri otomatik kontrol etmez. Güvenilir payload'ı olmayan eski event'lerin taze sağlayıcı kaydına ihtiyacı vardır. Bunlar ve migration/rollback sırası [rehberde](backend/docs/question-delivery-recovery.md) ayrıntılıdır.

**Bu adımdan sonraki çalışma:** 3. adım — PUSH-01, AI-01, LOG-01; güncel sonucu raporun başındaki 3. adım bölümündedir.

## Düzeltme ilerlemesi — 1. adım (26 Eylül 2026)

**SEC-01 ve AUTH-01 için kod düzenlemeleri ve yerel doğrulamalar tamamlandı. HTTPS staging kabulü henüz yapılmadı.** Aşağıdaki ilk inceleme bulguları ve başlangıç ölçümleri geçmiş kaydı olarak korunmuştur; güncel durum bu bölümde ve ilgili bulgu notlarında belirtilir. Diğer adımlardaki yayın engelleri devam ediyor.

| Değişiklik | Güncel durum |
| --- | --- |
| Next.js / ESLint | `next` ve `eslint-config-next` tam sürüm `16.3.6`; lockfile güncellendi. Next'in `sharp` zinciri `0.35.4`, `postcss` zinciri `8.5.23`. Next/sharp/postcss için audit uyarısı kalmadı. |
| Uzak görseller | Genel `**` host izni kaldırıldı. Trendyol, Hepsiburada ve Google `lh3`–`lh6` hostları HTTPS, varsayılan port ve query olmadan kabul ediliyor. Redirect takibi kapalı; özel ağ IP izni kapalı. Microsoft inline avatarları ek host gerektirmiyor. |
| Ortak oturum | `AUTH_COOKIE_DOMAIN` eklendi. Planlanan production adreslerinde `coreasistan.com`; localhost'ta boş. Domain, iki origin ve HTTPS başlangıçta doğrulanıyor. Public/private suffix kontrolü için `tldts` doğrudan dependency oldu. |
| Çerez güvenliği | `Secure`, `HttpOnly`, `SameSite=Lax` korunuyor. Ortak cookie kapsamı trusted origin listesini genişletmiyor. Son giriş yöntemi eklentisi session çerezinin domain/secure özelliklerini devralıyor; bu tercih çerezi mevcut davranış gereği JS tarafından okunabilir. |
| Dağıtım notları | [PRODUCTION_NOTES.md](PRODUCTION_NOTES.md) ve [backend/.env.example](backend/.env.example) güncellendi. Gerçek `.env` sırları değiştirilmedi. |

### 1. adım doğrulama kanıtı

- Backend production build başarılı. İlk deneme Windows'ta `dist` temizliğinde `ENOTEMPTY` verdi; aynı komutun ikinci denemesi başarılı oldu. Hata nedeniyle uygulama kodu veya build ayarı değiştirilmedi.
- Frontend Next.js `16.3.6` production build, TypeScript kontrolü ve sayfa üretimi başarılı.
- Backend 28 integration dışı test dosyasında **121/121 test başarılı**; bunun 20'si yeni auth regresyon testi. Memory adapter ile gerçek Better Auth handler'ında oturum oluşturma → Cookie başlığıyla SSR benzeri oturum okuma → yabancı origin reddi → doğru domain üzerinde logout çerezi → eski session'ın geçersizliği doğrulandı. Gerçek OAuth veya PostgreSQL entegrasyonu yerine geçmez.
- Frontend `npm run test:security`: **2/2 test başarılı**. Gerçek Next config yüklenerek izinli CDN'ler, benzer saldırgan host adları, özel IP'ler, HTTP, farklı port ve query içeren URL'ler kontrol edildi.
- Değişen auth dosyaları ve frontend config/test dosyalarında hedefli ESLint: **0 hata, 0 uyarı**.
- Production Next server `127.0.0.1:3107` üzerinde: `/` ve `/login` → **200**, oturumsuz `/dashboard` → **307 /login**, eski billing rotası → **308 /billing**, izin dışı uzak görsel isteği → **400**. Bu kontrol yalnızca okuma istekleriyle yapıldı.
- Güncel `npm audit --omit=dev`: frontend **6 moderate, 0 high, 0 critical**; backend **9 high, 6 moderate**. Frontend'de kalan zincir `shadcn`/MCP/Express/qs; backend'in önceki transitif bulguları değişmedi. Bu adım bütün dependency uyarılarının kapatıldığı anlamına gelmez; HTTP yolundaki zincirlerin değerlendirme/güncelleme işi hâlâ gerekli.

**Staging/son kabulde açık kalanlar:** temiz Linux image kurulumu; gerçek CDN yanıtları/profil resimleri; Google ve Microsoft OAuth ile gerçek HTTPS subdomainler üzerinde giriş, tam yenileme ve çıkış; oturumlu mağaza seçimi Server Action'ı. Mevcut DB entegrasyon testindeki aralıklı kapanış sorunu ve genel lint bulguları bu adımda düzeltilmedi. Gerçek ödeme, e-posta, pazaryeri cevabı veya ücretli AI çağrısı yapılmadı.

**Bu adımdan sonraki çalışma:** 2. adım — SYNC-01 ve ANSWER-01; güncel sonucu raporun başındaki 2. adım bölümündedir.

## 1. Karar (ilk inceleme)

**Bu haliyle doğrudan müşteri trafiğine açılmasını önermiyorum.** Uygulamanın ana parçaları uygulanmış, her iki production derlemesi başarılı ve mevcut birim testleri geçiyor. Buna rağmen üretim domainlerinde oturumun çalışmasını etkileyen bir yapılandırma uyumsuzluğu, kullanılan Next.js sürümünde güncel güvenlik duyuruları ve soru/cevap işlemlerinin kesintiden toparlanmasında somut hatalar var.

Bu sonuç, projenin baştan yazılması gerektiği anlamına gelmiyor. Öncelik aşağıdaki dar kapsamlı düzeltmeler ve bunları koruyan regresyon testleri olmalı. Geniş refactor, yeni altyapı katmanları veya mikroservis dönüşümü bu incelemenin gerektirdiği işler değil.

Bir “% hazır” değeri verilmedi: OAuth, gerçek pazaryeri teslimatı, Paddle yenilemesi, sunucu kapasitesi ve yedekten dönüş aynı ölçüyle değerlendirilemez. Mevcut durum **yerel geliştirme/test aşaması ilerlemiş, production kabulü henüz tamamlanmamış** olarak değerlendirildi.

### Öncelik tablosu

| ID | Öncelik | Bulgu | Kanıt düzeyi |
| --- | --- | --- | --- |
| SEC-01 | P0 | Next.js `16.2.6`, uygulamada kullanılan özellikleri etkileyen güvenlik duyurularının kapsamına giriyor | Paket taraması + resmi duyuru + kaynak kod |
| AUTH-01 | P1 | Planlanan web/API domain ayrımında oturum çerezi frontend SSR'a ulaşmıyor | Kod + kurulu Better Auth üzerinde çerez üretimi |
| SYNC-01 | P1 | İlk işleme sırasında hata alan gelen soru, sonraki denemede kalıcı olarak atlanabiliyor | Hata enjeksiyonuyla yeniden üretildi |
| ANSWER-01 | P1 | Belirsiz cevap teslimatı kör tekrar deneniyor; DB–Redis arası çökme de cevabı kuyrukta kilitleyebiliyor | Tekrar gönderim yeniden üretildi; kuyruk boşluğu statik olarak doğrulandı |
| PUSH-01 | P1, push açıkken | Kullanıcı kontrollü push endpoint'i özel ağ adreslerini kabul ediyor | Gerçek DTO ve kurulu push kütüphanesiyle doğrulandı; ağ isteği yapılmadı |
| OPS-01 | P1, yayına çıkış hazırlığı | Depodaki Docker düzeni üretim dağıtımını tamamlamıyor; mevcut compose doğrudan internete açık VDS için uygun değil | Dosya envanteri ve yapılandırma |
| AI-01 | P2 | Manuel taslak üretiminde aynı soruya paralel model çağrısı ve kota tüketiminden önce maliyet oluşması | Paralel çağrı yeniden üretildi + kod |
| OPS-02 | P2 | SIGTERM için düzgün kapanış etkin değil; health endpoint'i bağımlılık hazır olma durumunu ölçmüyor | Uygulama ve kurulu Nest/BullMQ kodu |
| LOG-01 | P2 | Ekip davet token'ı HTTP erişim loguna açık olarak yazılıyor | Sahte token ile yeniden üretildi |
| QA-01 | P2 / yayın kabulü | Yerel lint/test/build ve kritik regresyonlar tamamlandı; uzak CI ve staging kabulü bekliyor | Rapor başındaki 5. adım ve kalite kontrol rehberi |

**P0:** İnternete açılmadan kapatılmalı. **P1:** İlk müşteri kullanımından önce çözülmeli veya ilgili özellik kapalı tutulmalı. **P2:** Etkisi daha sınırlı; düzeltme ve kabul testi planına alınmalı. Henüz uygulanmamış dağıtım adımları, canlıda yaşandığı iddia edilen arızalar değildir.

## 2. Kapsam ve yapılan kontroller

İnceleme; uygulama/modül envanteri, frontend route ve API istemcileri, kimlik doğrulama, mağaza/hesap yetkileri, ekip davetleri, hesap silme, katalog ve soru senkronizasyonu, AI taslak/cevap teslimatı, abonelik/kota/webhook işleme, bildirim/e-posta, destek/admin, veritabanı şeması/migration, loglama ve Docker yapılandırmasını kapsıyor. Kritik akışlar kaynak kod üzerinden takip edildi; her kullanıcı ekranı tarayıcıda uçtan uca çalıştırılmış değildir.

Uygulama kaynak kodu değiştirilmedi. Başlangıçta zaten değişmiş olan `backend/docs/admin-emails.md` ve `start-development.bat` dosyaları korundu. `.env` değerleri rapora alınmadı. Gerçek e-posta, pazaryeri cevabı, ücretli AI çağrısı veya ödeme işlemi oluşturulmadı.

### Kontrol sonuçları

| Kontrol | Sonuç | Anlamı / sınırı |
| --- | --- | --- |
| Backend `npm run build` | Başarılı | TypeScript/Nest derlemesi geçiyor; tek başına deployment testi değil |
| Frontend `npm run build` | Başarılı | Next.js production derlemesi, TypeScript kontrolü ve statik sayfa üretimi geçti |
| Backend 27 adet integration dışı `.spec.ts` | **101 test geçti, 0 başarısız** | Mevcut testlerin sonucu; bütün iş kurallarının test edildiği anlamına gelmez |
| Admin e-posta/duyuru PostgreSQL entegrasyon testi, ilk çalışma | İşlevsel 12 test geçti; dosya kapanışında hata, **exit 1** | Test sonrası açık bağlantı/asenkron faaliyet sorunu; aşağıda ayrıntı var |
| Aynı entegrasyon testinin ikinci çalışması | **12 test geçti, exit 0** | İlk hatanın aralıklı olduğunu gösteriyor; ilk başarısızlık yok sayılmadı |
| Boş izole PostgreSQL veritabanına migration uygulanması | Başarılı | Entegrasyon testinin hazırlığı sırasında mevcut 64 migration dizininin zinciri uygulandı; mevcut müşteri verisini yükseltme/restore testi yapılmadı |
| Backend ESLint, `--fix` olmadan | **8 hata** | 2 biçimlendirme, 6 fixture geliştirme scriptinde tip güvenliği hatası |
| Frontend ESLint | **1 hata, 5 uyarı** | Derleme başarılı olsa da lint kapısı yeşil değil |
| Backend `npm audit --omit=dev` | 15 etkilenen paket: 9 high, 6 moderate | Bağımlılık grafiğindeki paket sayısı; 15 bağımsız erişilebilir açık demek değil |
| Frontend `npm audit --omit=dev` | 10 etkilenen paket: 1 critical, 3 high, 6 moderate | Next.js uyarılarının uygulamayla ilişkisi ayrıca incelendi |
| Hedefli hata/konfigürasyon kontrolleri | 6 davranış doğrulandı | Çerez kapsamı, soru retry, cevap retry, paralel taslak, token loglama ve push hedefi |

Entegrasyon testi mevcut uygulama veritabanını değiştirmedi: localhost PostgreSQL üzerinde rastgele isimli `core_assist_email_test_<id>` veritabanı oluşturdu, migration ve sentetik verilerle çalıştı, ardından kendi test veritabanını kaldırdı. Resend çağrısı test içinde taklit edildi.

Bu turda Docker image build/run, Linux üzerinde gerçek bootstrap, tarayıcı OAuth akışı, canlı sağlayıcı sözleşme testi, yük testi ve yedekten geri yükleme yapılmadı. Bunlar başarılı kabul edilmemeli; son bölümde kabul planı var. Yerel kontroller Node `v24.17.0` üzerinde yapıldı; backend Dockerfile Node 22 tabanını kullanıyor. Son doğrulama hedef image üzerinde de yapılmalı.

## 3. Yayına çıkışı etkileyen bulgular

### SEC-01 — Next.js güvenlik güncellemesi gerekli

**Güncelleme:** `16.3.6` yükseltmesi ve dar görsel izin listesi uygulandı; build, hedefli regresyonlar ve dependency taraması geçti. Gerçek görsel/Server Action ve temiz Linux kurulumu son kabulde doğrulanacak. Aşağıdaki açıklama ilk inceleme durumudur.

**Kaynak:** [frontend/package.json](frontend/package.json), satır 25 ve 45; [next.config.ts](frontend/next.config.ts), satır 24–25; [dashboard/actions.ts](frontend/app/(dashboard)/dashboard/actions.ts).

Next.js sürümü `16.2.6`. Uygulama App Router, Server Actions ve `next/image` kullanıyor. Uzak görseller için `hostname: "**"` ile bütün HTTPS domainleri kabul ediliyor.

İnceleme tarihinde doğrulanan resmi duyurular:

- **AVIF image optimization / RCE:** kullanılan sürüm etkilenen aralıkta; duyurudaki 16.x düzeltmesi `16.3.3`. Bu projede image optimization ve geniş uzak görsel izin listesi bulunması nedeniyle yalnızca kullanılmayan bir bağımlılık uyarısı olarak geçilemez. [Next.js güvenlik duyurusu](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4)
- **Server Actions / hizmet engelleme:** App Router ve en az bir Server Action kullanan uygulamalar etkileniyor; projede bu koşullar mevcut. Duyurudaki 16.x düzeltmesi `16.2.11`; yukarıdaki kritik açık nedeniyle yalnızca bu sürüme çıkmak yeterli hedef değil. [Next.js güvenlik duyurusu](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj)
- **Windows üzerinde RCE:** ayrıca Windows dosya sistemi üzerinde çalışan sunucular için bir duyuru var. Linux Docker hedefi için bunu ayrıca gerçekleşmiş bir açık gibi saymıyorum; mevcut Windows geliştirme sunucusunu internete açarken de sürüm güncellemesi gerekir. [Next.js güvenlik duyurusu](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)

**Yapılacak iş:** Next.js ve `eslint-config-next` uyumlu, güvenlik düzeltmelerini içeren sürümlere yükseltilmeli; bu duyurular için en az `16.3.3` düzeltme tabanı dikkate alınmalı ve yükseltme anındaki duyurular yeniden kontrol edilmeli. Lockfile yenilenmeli, `sharp` zinciri de doğrulanmalı. Görsel host izinleri gerçek pazaryeri/giriş sağlayıcısı CDN ihtiyaçlarıyla sınırlandırılmalı. Körlemesine `npm audit fix --force` kullanılmamalı.

**Kabul testi:** Temiz kurulum + production build + gerçek ürün/avatar görselleri + Server Action kullanan mağaza seçimi + yeniden dependency audit. Bu incelemede exploit çalıştırılmadı; sürüm ve etkin özelliklerin eşleşmesi doğrulandı.

Backend taramasındaki Multer ve mysql2 uyarılarının aynı düzeyde erişilebilir olduğu sonucuna varılmadı: kaynak kodda Multer upload akışı bulunmadı ve uygulama PostgreSQL kullanıyor. Express/body-parser/qs gibi HTTP yoluna daha yakın zincirler ayrıca güncelleme çalışmasına alınmalı. Tarama sayıları tek başına saldırı yüzeyi ölçüsü değildir.

### AUTH-01 — Web/API subdomain ayrımı SSR oturumuyla uyumsuz

**Güncelleme:** [auth-runtime.config.ts](backend/src/modules/auth/auth-runtime.config.ts) ile doğrulanan ortak cookie domaini eklendi; session okuma/revoke yerel testleri geçti. HTTPS staging üzerinde Google/Microsoft kabulü bekliyor. Aşağıdaki açıklama ilk inceleme durumudur.

**Kaynak:** [PRODUCTION_NOTES.md](PRODUCTION_NOTES.md), satır 7–10; [auth.service.ts](backend/src/modules/auth/auth.service.ts), satır 48–70; [auth-client.ts](frontend/lib/auth-client.ts), satır 3–5; [server-auth.ts](frontend/lib/server-auth.ts), satır 26–40; [dashboard/layout.tsx](frontend/app/(dashboard)/dashboard/layout.tsx), satır 27–32.

Planlanan adresler `coreasistan.com` ve `api.coreasistan.com`. Tarayıcı auth istemcisi doğrudan API'ye gidiyor. Better Auth yapılandırmasında ortak cookie domaini yok. Frontend ise sunucuda oturumu kendi isteğine gelen `Cookie` başlığını API'ye ileterek okuyor.

Kurulu Better Auth ile `getCookies({ baseURL: 'https://api.coreasistan.com' })` çalıştırıldı. Oturum çerezi `secure: true`, `httpOnly: true`, `sameSite: 'lax'`, `path: '/'` özellikleriyle üretildi; **`domain` özelliği yok**. Böyle bir çerez API hostuna aittir, ana domaine gelen frontend isteğine eklenmez.

**Kullanıcı etkisi:** OAuth/API oturumu oluşsa bile dashboard'un sunucu tarafı oturum kontrolü kullanıcıyı göremez; yeniden login yönlendirmesi oluşabilir. Localhost'ta portların farklı olması bu hatayı göstermez, çünkü host aynıdır. CORS ve `trustedOrigins` ayarları cookie domainini değiştirmez.

**Yapılacak iş:** Auth ve SSR için tutarlı bir origin/çerez düzeni seçilmeli. Seçenekler: aynı origin üzerinden reverse proxy/BFF veya kontrollü ortak üst domain çerezi. Ortak domain tercihinde yalnızca güvenilen subdomainler bulunmalı ve mevcut origin kontrolleri korunmalı. Son giriş yöntemi çerezi de login ekranında okunuyorsa aynı düzen içinde ele alınmalı.

**Kabul testi:** Gerçek HTTPS staging domainlerinde Google ve Microsoft giriş → dashboard'a geçiş → tam sayfa yenileme → başka dashboard rotası → çıkış → eski oturumla erişim denemesi. Tarayıcı ve SSR aynı oturumu görmeli; kullanıcılar arasında cache paylaşılmamalı.

### SYNC-01 — Başarısız gelen sorular retry sırasında kaybolabiliyor

**Güncelleme:** Event/soru atomikliği, satır kilidi ve eski payload replay uygulandı. Gerçek PostgreSQL hata enjeksiyonu ve eşzamanlı tekrar testleri geçti. Aşağıdaki açıklama ilk inceleme durumudur.

**Kaynak:** [question-sync-worker.service.ts](backend/src/modules/question-sync/question-sync-worker.service.ts), satır 355–477; özellikle 363, 375–408 ve 437–476.

Akış şu şekilde:

1. `IncomingEvent` kaydı oluşturuluyor.
2. Ürün bağlantısı çözülüyor ve `ProductQuestion` oluşturuluyor.
3. İkinci aşama hata alırsa event `FAILED` yapılıyor ve hata yükseltiliyor.
4. Aynı soru tekrar geldiğinde event'in benzersiz anahtarı `P2002` üretiyor.
5. Duplicate dalı yalnızca mevcut `ProductQuestion` kaydına bakıyor; kayıt hiç oluşmamışsa `null` dönüyor. `FAILED` event tekrar işlenmiyor.

**Doğrulama:** Gerçek derlenmiş worker metodu, sahte veritabanı ile çalıştırıldı. İlk denemede ürün çözümlemesi geçici DB hatası verdi. İkinci denemede sonuç `null`, event durumu `FAILED`, ürün çözümleme çağrı sayısı hâlâ `1` oldu. İkinci deneme eksik soruyu oluşturmaya hiç girişmedi.

**Etki:** Tek bir geçici hata sonrasında soru panelde görünmeyebilir; sonraki başarılı senkronizasyon bunu otomatik düzeltmez. Bu, sadece log veya gecikme sorunu değil, işlenecek müşteri sorusunun atlanmasıdır.

**Yapılacak iş:** Event'in varlığı ile işlenmiş olması ayrılmalı. Event/soru kaydı atomik kurulmalı veya `PENDING/FAILED` event'ler güvenli claim ile yeniden işlenmeli. Duplicate dalı yalnızca tamamlanmış kayıtları atlamalı. Önceden oluşmuş, sorusu bulunmayan failed event'ler için kontrollü onarım yolu da gerekli.

**Kabul testi:** Event insert sonrası, ürün çözümlemesinde ve soru transaction'ında ayrı ayrı hata üret; aynı sağlayıcı sorusunu tekrar gönder. Sonuç tam bir `ProductQuestion` olmalı, üçüncü tekrar ikinci bir soru oluşturmamalı.

### ANSWER-01 — Cevap teslimatında belirsiz sonuç ve kuyruk aktarımı boşluğu

**Güncelleme:** DB gönderim niyeti/reconciliation, tek claim, deneme kimliği ve `REVIEW_REQUIRED` inceleme/operatör çözümü uygulandı. Yerel PostgreSQL + Redis regresyonları geçti. Migration/worker geçişi ve sağlayıcı sandbox kabulü ayrıca uygulanmalı. Aşağıdaki açıklama ilk inceleme durumudur.

**Kaynak:** [question-answer-worker.service.ts](backend/src/modules/question-answer/question-answer-worker.service.ts), satır 127–150 ve 296–332; [question-answer-queue.service.ts](backend/src/modules/question-answer/question-answer-queue.service.ts), satır 180–297; [question-answer.processor.ts](backend/src/modules/question-answer/question-answer.processor.ts).

**A. Sağlayıcı kabulünden sonra yerel kayıt hatası:** Worker önce pazaryerine gönderiyor, ardından yerel `SENT/ANSWERED` transaction'ını yazıyor. Bu transaction hata alırsa kayıt `PROCESSING` kalıyor. Retry, `PROCESSING` kaydını yeniden kabul edip aynı dış gönderimi tekrar yapıyor. Timeout sırasında sağlayıcının cevabı kabul edip etmediğinin bilinmemesi de aynı sınıfa giriyor.

Hata enjeksiyonunda iki worker çalışması için `providerSendCalls = 2`, yerel durum `PROCESSING` elde edildi. Gerçek pazaryerine gönderim yapılmadı. Bu sonuç sağlayıcının iki cevabı da yayınlayacağını kanıtlamaz: sağlayıcı ikinciyi reddedebilir; o durumda kullanıcıya başarısız görünen ama aslında teslim edilmiş bir cevap da oluşabilir.

**B. DB–Redis aktarımı:** `QuestionAnswer` kaydı DB'de commit edildikten sonra `queue.add()` çağrılıyor. Bu iki adım arasında process kapanırsa `QUEUED` kayıt var, Redis işi yok. Yeni gönderim isteği mevcut `QUEUED/PROCESSING` kaydı nedeniyle conflict alıyor. Cevap kuyruğu için bu yetim DB kayıtlarını tarayıp toparlayan bir outbox/reconciliation akışı bulunmadı. Bu alt senaryo kod yoluyla belirlendi; gerçek process-kill testi bu turda yapılmadı.

**Yapılacak iş:** Gönderim niyetinin kalıcı outbox üzerinden kuyruğa aktarılması, yetim kayıtların toparlanması ve sağlayıcı sonucunun belirsiz kaldığı duruma özel işlem gerekli. Sağlayıcı destekliyorsa kararlı idempotency anahtarı kullanılmalı; desteklemiyorsa tekrar POST öncesi sonuç doğrulaması veya manuel inceleme durumu uygulanmalı. Sadece retry sayısını artırmak çözüm değil.

**Kabul testi:** DB commit sonrası Redis enqueue öncesi process'i kapat; sağlayıcı başarı cevabı sonrası DB commit'ini boz; sağlayıcı kabulü sonrası ağ cevabını düşür. Her durumda soru ya güvenli şekilde tamamlanmalı ya da açık bir inceleme durumunda kalmalı. İş kaybolmamalı, kullanıcı sonsuza kadar “kuyrukta” görmemeli.

### PUSH-01 — Push aboneliği sunucunun özel ağ adreslerine yönlendirilebiliyor

**Güncelleme:** Servis host izinleri, endpoint/anahtar doğrulaması, socket DNS/IP kontrolü, timeout ve abonelik sınırı uygulandı. Yerel güvenlik/entegrasyon testleri geçti; gerçek tarayıcı push kabulü bekliyor. Aşağıdaki açıklama ilk inceleme durumudur.

**Kaynak:** [web-push-subscription.dto.ts](backend/src/modules/notifications/dto/web-push-subscription.dto.ts), satır 21–34; [notifications.service.ts](backend/src/modules/notifications/notifications.service.ts), satır 349–375; [notification-delivery.service.ts](backend/src/modules/notifications/notification-delivery.service.ts), satır 494–536.

Endpoint için genel `IsUrl({ require_protocol: true })` doğrulaması var. Üyelik ve push yapılandırması kontrolünden sonra kullanıcı adresi aynen saklanıyor; teslimat sırasında `webPush.sendNotification()` içine aynen veriliyor. İzinli push servis hostları veya private/loopback hedefleri için kontrol yok.

**Doğrulama:** Sahte UUID ve yerel üretilmiş şifreleme anahtarlarıyla `https://127.0.0.1:9443/audit-no-network` adresi gerçek DTO doğrulamasından **0 hatayla** geçti. Kurulu `web-push` kütüphanesi de aynı hedef için istek ayrıntısı oluşturdu. Özel ağa veya dış servise gerçek istek yapılmadı.

**Etki ve koşul:** VAPID/push etkinse ve kullanıcı mağaza üyeliğine sahipse sunucudan kullanıcı kontrollü HTTPS hedeflerine istek başlatılabilir. Bu bir SSRF hedef doğrulama eksikliğidir; dahili verinin okunabildiği veya başka bir servisin ele geçirildiği test edilmedi. Push kapalıysa abonelik kaydı uygulama tarafından reddediliyor; bu koşul rapordaki önceliğin parçasıdır.

Aynı gönderim çağrısında yalnızca `TTL` verilmiş. TTL, HTTP bağlantı timeout'u değildir; kütüphanenin `timeout` seçeneği kullanılmıyor. Takılan hedeflerin bildirim teslimatını bekletmesi de ele alınmalı.

**Yapılacak iş:** Desteklenen tarayıcı push servisleri için HTTPS host/port izin listesi; yönlendirme ve DNS/özel ağ politikası; geçerli anahtar doğrulaması; sınırlı abonelik sayısı ve bağlantı timeout'u. Bunlar tamamlanana kadar production'da push kapalı tutulabilir; uygulama içi bildirim/e-posta ayrı işlevlerdir.

**Kabul testi:** Localhost, private IPv4/IPv6 ve izin verilmeyen domainler reddedilmeli. Gerçek desteklenen tarayıcının ürettiği abonelik kabul edilmeli. Timeout sonrası diğer bildirim işleri devam etmeli.

### OPS-01 — Production dağıtım paketi ve kurtarma prosedürü eksik

**Güncelleme:** Ayrı production Compose, frontend/backend image'ları, özel DB/Redis ağı, Caddy, dosya sırları, resource/log sınırları ve şifreli backup/ayrı DB'ye restore paketi eklendi. Yerel Linux Docker kabulü geçti; gerçek VDS/TLS/off-site kurulumu bekliyor. Aşağıdaki açıklama ilk inceleme durumudur.

**Kaynak:** [docker-compose.yml](docker-compose.yml); [backend/Dockerfile](backend/Dockerfile); [README.md](README.md); [PRODUCTION_NOTES.md](PRODUCTION_NOTES.md); [backend/.env.example](backend/.env.example); [frontend/.env.example](frontend/.env.example).

Mevcut compose yalnızca PostgreSQL ve Redis'i çalıştırıyor. Backend Dockerfile mevcut; frontend image tanımı, iki uygulamayı da içeren production compose, HTTPS reverse proxy ayarı ve depoda tanımlı yedek/restore akışı bulunmadı.

Mevcut compose'ta PostgreSQL `5434:5432`, Redis `6379:6379` olarak bütün arayüzlere publish ediliyor; PostgreSQL parolası sabit geliştirme değeri. Redis için auth ve açık bir AOF/durability politikası tanımlı değil. Bu, mevcut sunucuda portların internete açık olduğunun kanıtı değildir; dosyanın VDS'de değişmeden kullanılmasının uygun olmadığını gösterir. Volume tanımlı olması tek başına yedek veya sıfır kayıp garantisi vermez. Redis burada BullMQ işlerini taşıdığı için yalnızca silinebilir cache gibi değerlendirilemez.

**Yayından önce somutlaştırılacaklar:**

- Uygulama image'ları, iç ağ, reverse proxy/TLS, restart ve disk/log sınırları. DB/Redis portları internete açılmamalı; yönetim erişimi gerekiyorsa ayrıca sınırlandırılmalı.
- Frontend'in tarayıcıya gömülen `NEXT_PUBLIC_*` değerleri build sırasında doğru olmalı; container başlatırken değiştirmek önceden üretilmiş bundle'ı düzeltmez. `API_URL` kullanılacaksa SSR iç adresi ayrıca tanımlanmalı.
- Frontend `dev` komutu 3001, `start` komutu varsayılan Next portunu kullanıyor. Production portu ve proxy hedefi açıkça seçilmeli; geliştirme portu varsayılmamalı.
- PostgreSQL için sunucu dışı, erişimi sınırlı yedek ve test edilmiş geri yükleme. Entegrasyon şifreleme anahtarı ve gerekli sırların geri kazanım planı da bulunmalı; yalnızca DB yedeği şifreli pazaryeri kimlik bilgilerini kullanmaya yetmez.
- Redis kalıcılığı, eviction politikası ve Redis kaybında işlerin yeniden oluşturulması. Özellikle `ANSWER-01` düzeltilmeden kalıcı kuyruk kaybı normal retry ile giderilemiyor.
- Migration öncesi yedek, deployment sırası ve geri dönüş prosedürü. Mevcut Dockerfile başlangıçta `migrate deploy` çalıştırıyor; aynı anda birden fazla instance başlatma ve eski image'a dönüş davranışı prova edilmeli.

**Konfigürasyon tuzağı:** `.env.example` içinde katalog/soru modları açıkça `mock`, Paddle ortamı `sandbox`. Provider registry üretimde değer verilmemişse `live` seçiyor, ancak açıkça verilmiş `mock` değerini üretimde de kabul ediyor. Örnek env'i kopyalayıp sadece `NODE_ENV=production` yapmak gerçek entegrasyonları açmaz. Production başlangıç doğrulaması veya deployment öncesi zorunlu kontrol eklenmeli.

Bu madde “daha çok altyapı olsun” önerisi değildir: kullanıcının hedeflediği Docker/VDS dağıtımının mevcut depodaki karşılığı henüz tamamlanmamış durumda.

## 4. Diğer doğrulanmış sorunlar

### AI-01 — Manuel AI çağrılarında paralellik ve maliyet kontrolü

**Güncelleme:** Manuel/otomatik üretim için hesap başına tek DB lease, 5 saniye başlangıç aralığı ve transaction içinde sahiplik doğrulaması eklendi. Paralel istek, son kota hakkı, hata/expiry ve BullMQ erteleme testleri geçti. Sağlayıcıya ulaşmış isteğin maliyeti geri alınmaz. Aşağıdaki açıklama ilk inceleme durumudur.

**Kaynak:** [questions.service.ts](backend/src/modules/questions/questions.service.ts), satır 519–531; [question-draft.service.ts](backend/src/modules/questions/question-draft.service.ts), satır 151, 184 ve 234–319; [billing-usage.service.ts](backend/src/modules/billing/billing-usage.service.ts), `assertDraftGenerationAvailableForStore` ve `consumeAiQuestionWithClient`.

Manuel taslak endpoint'i doğrudan üretim servisini çağırıyor. Kota önce okunuyor, model çağrısı yapılıyor, başarılı taslak sonradan transaction içinde kotaya yazılıyor. Aynı soru için işlem başında tekilleştirme/claim yok; otomasyon kuyruğunun kontrolleri bu manuel yolu sınırlamıyor.

İki eşzamanlı `generate()` çağrısında her ikisinin de model katmanına ulaştığı doğrulandı: **aynı soru, 2 model çağrısı**. Model sahteydi; ücret oluşmadı.

Burada “veritabanındaki kota kesin aşılır” denmiyor: kullanım artırımı koşullu ve atomik. Risk, az kota kalmışken çok sayıda isteğin ücretli modele ulaşması ve sonradan reddedilmesi; aynı soruda gereksiz paralel üretim ve gecikmedir. İstemci butonunu disabled yapmak API düzeyinde koruma sağlamaz.

**Düzeltme:** Soru başına süreli, hata sonrası bırakılabilen claim; hesap bazlı eşzamanlılık/istek sınırı; gerekiyorsa model çağrısı öncesi rezervasyon. Başarısız üretimin müşterinin kotasından düşmemesi kuralı korunmalı.

**Kabul:** Aynı soruya paralel 10 istek tek üretime indirgenmeli veya açıkça reddedilmeli. Hesapta 1 hak kalmışken farklı sorulara burst geldiğinde dış model çağrı sayısı tanımlı bütçeyle sınırlı kalmalı.

Not: Kota tamamen bittiğinde ücretsiz taslak tekrarlarının da durması ilk bakışta hata gibi görünüyor, ancak [plan-questions.tsx](frontend/components/dashboard/billing/plan-questions.tsx), satır 23 bunu açıkça ürün kuralı olarak söylüyor. Bu davranış ayrıca hata olarak raporlanmadı.

### OPS-02 — Düzgün kapanış ve readiness ayrımı

**Güncelleme:** HTTP/BullMQ/SSE drain koordinasyonu ve DB/Redis readiness uygulandı. Gerçek Linux konteynerinde bağımlılık kesintileri, normal SIGTERM ve aktif işli kapanış geçti. 150 saniyeyi aşan işler için toparlama gerekir; hedef VDS kabulü bekliyor. Aşağıdaki açıklama ilk inceleme durumudur.

**Kaynak:** [main.ts](backend/src/main.ts), satır 12–64; [prisma.service.ts](backend/src/database/prisma.service.ts), satır 25–28; [notification-stream.service.ts](backend/src/modules/notifications/notification-stream.service.ts), `onModuleDestroy`; [app.controller.ts](backend/src/app.controller.ts), satır 13–18.

Bootstrap'ta `app.enableShutdownHooks()` veya eşdeğer sinyal işleyicisi yok. Prisma ve bildirim akışı kapanış hook'ları tanımlı; kurulu Nest BullMQ entegrasyonu da worker'ları `onApplicationShutdown` içinde kapatıyor. Docker SIGTERM gönderdiğinde bu Nest yaşam döngüsü otomatik etkinleştirilmiş değil.

**Etki:** Normal deployment/restart sırasında sürmekte olan worker/HTTP işlemlerinin tamamlanmasına fırsat verilmez. BullMQ stalled-job toparlaması bazı işleri tekrar çalıştırabilir; bu, dış gönderim belirsizliğini ortadan kaldırmaz.

`/health` her zaman `ok` dönüyor. Bu bir liveness endpoint'i olarak kullanılabilir; DB/Redis bağlantısı kopmuşken “trafik almaya hazır” sonucunu vermez. Depoda ayrı readiness kontrolü yok.

**Düzeltme/kabul:** Shutdown hook'ları, yeterli container kapanış süresi ve aktif işlerin güvenli drain davranışı birlikte uygulanmalı. PostgreSQL/Redis erişimini kısa timeout'larla ölçen readiness eklenmeli; liveness'tan ayrılmalı. SIGTERM ile uzun iş, açık SSE bağlantısı ve DB/Redis kesintisi senaryoları hedef Linux image üzerinde denenmeli.

### LOG-01 — Davet token'ı erişim logunda korunmuyor

**Güncelleme:** HTTP path ve merkezi logger'da davet token redaksiyonu eklendi; encoded path ve hata/metadata/context regresyonları geçti. Proxy/CDN ve eski loglar ayrıca ele alınmalı. Aşağıdaki açıklama ilk inceleme durumudur.

**Kaynak:** [team.controller.ts](backend/src/modules/team/team.controller.ts), satır 92–109; [http-logging.middleware.ts](backend/src/infrastructure/logging/http-logging.middleware.ts), satır 37; [structured-logger.ts](backend/src/infrastructure/logging/structured-logger.ts), satır 18 ve 208–216.

Ekip daveti `/workspace-invitations/:token` üzerinden okunuyor. HTTP logger `request.path` yazıyor. Mevcut redaksiyon, `token` isimli alanları ve `token=...` metinlerini gizliyor; URL path segmentindeki davet token'ını gizlemiyor.

Logger ve middleware sahte bir token ile çalıştırıldı; redaksiyon sonrası token path içinde aynen kaldı. Gerçek davet token'ı okunmadı veya çıktılanmadı.

**Etki:** Veritabanında hash olarak tutulan davet bağlantısı log erişimi olan yerlere açık biçimde yayılıyor. Davet kabulünde doğrulanmış hedef e-posta kontrolü mevcut olduğundan bunu tek başına hesap ele geçirme olarak nitelendirmiyorum.

**Düzeltme/kabul:** Bu route için parametreli route adı veya maskelenmiş path loglanmalı; reverse proxy erişim logu da aynı açıdan kontrol edilmeli. Sahte davet token'ı hiçbir uygulama erişim/hata logunda bulunmamalı.

### QA-01 — Yeşil build, henüz yeşil yayın kontrolü değil

**27 Eylül güncellemesi:** Yerel lint/test/build ve test kapanışı düzenlemeleri tamamlandı; ortak komutlar, CI ve billing/tenant regresyonları eklendi. Kanıtlar raporun başındaki 5. adım bölümündedir. Aşağıdaki ayrıntılar ilk incelemenin tarihsel kaydıdır; halen açık lint hataları olarak okunmamalı. Gerçek sağlayıcı/tarayıcı staging kapsamı açık kalıyor.

**Lint ayrıntısı:**

| Dosya | Sonuç |
| --- | --- |
| [provider-manifests.ts](backend/src/modules/channels/providers/provider-manifests.ts), 43 | Prettier |
| [workspaces.service.ts](backend/src/modules/workspaces/workspaces.service.ts), 36 | Prettier |
| [refresh-marketplace-fixtures.ts](backend/src/scripts/refresh-marketplace-fixtures.ts), 240, 329, 416 | Toplam 6 tip güvenliği hatası; fixture scripti, müşteri HTTP akışı değil |
| [admin contact detail page](frontend/app/admin/contact-messages/[messageId]/page.tsx), 24 | `react-hooks/error-boundaries`: `try/catch` içinde JSX oluşturulması |
| [auth layout](frontend/app/(auth)/layout.tsx), 6 | Kullanılmayan ikon importu |
| [billing-shell-header.tsx](frontend/components/dashboard/billing/billing-shell-header.tsx), 5 | Kullanılmayan `Image` importu |
| [landing-brand.tsx](frontend/components/landing/landing-brand.tsx), 3, 4, 10 | İki kullanılmayan import ve kullanılmayan `compact` değeri |

Frontend lint hatası tek başına sayfanın kesin çalışmadığını göstermiyor; veri yükleme hatası ile render hatasının farklı ele alınması gerektiğini ve lint komutunun başarısız olduğunu gösteriyor. Biçimlendirme hataları da müşteri verisi kaybı seviyesinde değerlendirilmemeli.

**Aralıklı entegrasyon test hatası:** [admin-emails.integration.spec.ts](backend/src/modules/admin/admin-emails.integration.spec.ts), satır 99–108 kapanışında ilk çalışmada `terminating connection due to administrator command` oluştu. Node test runner test bittikten sonra asenkron faaliyet/uncaught exception bildirdi. İkinci çalışmada 12/12 ve exit 0 elde edildi. Kesin kök neden henüz belirlenmedi; pool/asenkron temizliğinin izole veritabanı kaldırılmadan önce tamamlandığı araştırılmalı. Bu bulgu production e-posta gönderiminin bozuk olduğu iddiası değildir.

**Kapsam eksikliği:** 28 spec dosyasının 21'i notifications altında; kalanlar admin 3, team 1, product-sync 1, questions 1, question-answer 1. Son iki worker spec'i ağırlıklı olarak hata bildirimi davranışını test ediyor. Billing, auth/tenant sınırı, checkout, plan değişikliği, gerçek soru persist/retry ve frontend kullanıcı yolculukları için bu seviyede kalıcı otomatik test paketi bulunmadı. Depoda smoke/eval/benchmark scriptleri mevcut; veri oluşturan veya dış servis çağıran scriptler bu raporda sırf “test sayısı” artırmak için çalıştırılmadı.

Backend package scriptlerinde bütün unit spec'leri kapsayan tek bir genel test komutu ve depoda CI workflow'u bulunmadı. Mevcut `test:admin-emails` scripti tüm spec'leri çalıştırmıyor. Sonraki düzeltmelerden sonra genel test/lint/build kapısı tanımlanmalı; backend'in mevcut lint scriptindeki `--fix` özelliği CI kontrolünden ayrılmalı.

## 5. İncelenen ve sorun uydurulmayan alanlar

| Alan | Görülen mevcut koruma / uygulama | Henüz kanıtlanmayan kısım |
| --- | --- | --- |
| Kimlik doğrulama | Üretimde gerekli auth URL/secret kontrolleri, şifreli OAuth token'ları, implicit account linking kapalı, alternatif hesap silme endpoint'i kapalı | Production domain/cookie akışı; gerçek Google/Microsoft callback |
| Admin | Doğrulanmış e-posta + tam allowlist karşılaştırması, backend guard'ları, admin mutation origin kontrolü | Tarayıcıdan rol matrisi ve oturum iptali E2E |
| Tenant ve roller | İncelenen mağaza/katalog/soru/knowledge yollarında üyelik; VIEWER yazma kısıtları; billing hesap OWNER/ADMIN kontrolü; support için workspace sınırı ve iç mesaj filtresi | Bütün endpoint'leri kapsayan negatif erişim testi |
| Ekip davetleri | Token hash'i, süre kontrolü, e-posta eşleşmesi, transaction/lock, rol atama kısıtları, koltuk limiti | Kabul/iptal/üyelik kaldırma eşzamanlılık testleri |
| Hesap silme | Fresh-session kontrolü, Paddle durumunu doğrulama, kapanış kaydı, yerel transaction/lock | Gerçek sağlayıcı kesintisi altında kapanış/yeniden deneme |
| Paddle webhook | Ham gövde imza doğrulama, event ID ile tekilleştirme, transaction içinde işleme; sıradan transaction bildirimi erişim açmıyor | Sandbox tekrar/sıra/yenileme/plan değişikliği kabul testleri |
| Abonelik ve kota | Koşullu atomik kota artırımı, idempotency anahtarı, workspace kapasite kilidi, yenileme reconciliation ve sınırlı grace | Bunların kalıcı regresyon testleri; dış AI maliyeti için AI-01 |
| Katalog | Canlı Trendyol/Hepsiburada adaptörleri, sayfalama/checkpoint, süreli sync kilitleri ve retry | Gerçek sağlayıcı sözleşmesi, ilk büyük aktarım, varyant eşleştirme |
| AI güvenliği | Kanıt/risk/eksik bilgi/confidence değerlendirmesi; stok doğrulaması ve gönderim öncesi yeniden kontrol | Gerçek ürün sorularında doğruluk, prompt injection ve yanlış otomatik yanıt oranı |
| E-posta/duyuru | Kalıcı outbox, idempotency, gönderim/teslim ayrımı, imzalı Resend webhook, rol hedefleme ve transaction rollback testleri | Production DNS/gönderici, gerçek bounce/complaint, uzun kesinti sonrası toparlanma |
| Bildirim | Uygulama içi kayıt, tercihler, digest, Redis pub/sub ile instance'lar arasında değişiklik yayını | Proxy üzerinden SSE ve gerçek browser push; PUSH-01 |
| Veri saklama | Operasyon kayıtları için sınırlı batch'li retention, başarısız queue işleri için retention mevcut | Uzun dönem DB/disk büyümesi, backup/restore ve müşteri verisinin yükseltmesi |

Bu tablodaki olumlu bulgular kodda gerçekten bulunan önlemlerdir. “Ödeme tarafında idempotency yok”, “her veri sorgusu tenant filtresiz”, “Redis sadece process belleğinde bildirim yayıyor” gibi genellemeler mevcut kod için doğru değil.

## 6. Kod tekrarları ve gereksiz parçalar

**27 Eylül güncellemesi:** Aşağıdaki somut temizlikler 6. adımda uygulandı; sonuç ve kontroller raporun başındadır. Alt bölümler ilk inceleme gerekçelerini korur. `shadcn` için sonradan doğrulanan CSS importu build bağımlılığı olarak korunmuştur.

Bu bölüm yayın engeliyle aynı öncelikte değil. Birbirine benzeyen her bileşen veya büyük servis otomatik olarak refactor sebebi sayılmadı.

### 6.1. Frontend server API istemcilerinde gerçek tekrar var

[admin-emails.server.ts](frontend/lib/api/admin-emails.server.ts), [admin-support.server.ts](frontend/lib/api/admin-support.server.ts), [support.server.ts](frontend/lib/api/support.server.ts), [questions.server.ts](frontend/lib/api/questions.server.ts) ve diğer server istemcileri aynı API URL çözümleme, cookie taşıma, `no-store`, timeout ve hata kontrolünü tekrar kuruyor.

**Öneri:** Küçük bir server-only HTTP yardımcı katmanı bu ortak davranışı taşıyabilir; route'a özel 404 ve response tipleri çağıranda kalabilir. AUTH-01 düzeltilirken çerez/API düzenini her dosyada farklı uygulama riskini azaltır. Mevcut client/server ayrımı veya bütün domain servisleri birleştirilmemeli.

### 6.2. `cn` için iki ayrı çözüm kullanılıyor

Projede [lib/utils.ts](frontend/lib/utils.ts) içindeki `clsx + tailwind-merge` tabanlı `cn` yaygın olarak kullanılıyor. [hover-card.tsx](frontend/components/ui/hover-card.tsx), satır 4 ise ayrı `cn` paketinden import ediyor; bu bileşen hesap profilinde kullanılıyor.

Bu nedenle `cn` paketi “hiç kullanılmıyor” denilerek silinmemeli. Önce bu tek import ortak yardımcıya taşınıp görünüm doğrulanırsa ek bağımlılık kaldırılabilir. Kazanç küçük ama somut; bir production arızası olarak raporlanmıyor.

### 6.3. `shadcn` CLI production dependency olarak bulunuyor

[frontend/package.json](frontend/package.json), satır 33'teki `shadcn` uygulama runtime importlarında kullanılmıyor; README'de bileşen üretme aracı olarak geçiyor. Dev dependency'ye taşınması değerlendirilmelidir. Mevcut üretim bağımlılık taramasında CLI'nin getirdiği MCP/Express zinciri de sayıldığı için gereksiz paket ve audit gürültüsü oluşturuyor. Bu, CLI'deki her açığın web uygulamasından erişilebilir olduğu anlamına gelmez.

### 6.4. Temizlik ve içerik uyumu

Lint'in saptadığı kullanılmayan importlar kaldırılabilir. Root README yalnızca başlık; backend README büyük ölçüde Nest başlangıç şablonu. Dağıtım ve test komutları gerçek projeye göre yazılmalı; bunun önemi özellikle OPS-01'deki işletim adımlarında ortaya çıkıyor.

[frontend/app/layout.tsx](frontend/app/layout.tsx), satır 21 meta açıklamasında WhatsApp ve Instagram yönetimi de vaat ediliyor. Aktif provider registry/manifest listesi Trendyol ve Hepsiburada ile sınırlı. Yalnızca logo dosyası bulunması entegrasyonun uygulanmış olduğu anlamına gelmiyor. İlk yayın metni sunulan özelliklerle hizalanmalı; sırf bu ifade için yeni kanal geliştirmek gerekmiyor.

Mock adaptörler, fixture'lar, billing reconciliation, veri retention ve e-posta outbox kodu “fazlalık” sayılmadı; mevcut geliştirme/işletim davranışında işlevleri var. Kullanılmadığı kanıtlanmayan modüller için silme önerisi yapılmadı.

## 7. Production yapılandırma kontrolü

Bu tablo kullanıcı hesabındaki mevcut servis ayarlarının eksik olduğunu iddia etmez; canlıya geçişte doğrulanacak değerleri gösterir. Yerel Resend/Hookdeck testi bu dış ayarların production karşılığını tek başına doğrulamaz.

| Alan | Canlıya geçerken doğrulanacak |
| --- | --- |
| Domain/OAuth | AUTH-01 çözümü; gerçek `FRONTEND_URL`, `BETTER_AUTH_URL`, Google/Microsoft callback ve allowed origin |
| Proxy | Gerçek proxy topolojisine uygun `TRUST_PROXY_HOPS`; HTTPS; SSE buffering/timeout davranışı |
| Frontend build | `NEXT_PUBLIC_API_URL`, Paddle client token ve ortamının image oluşturulurken doğru olması; varsa SSR `API_URL` |
| PostgreSQL/Redis | İç ağ adresleri, dış port erişimi, parola/ACL politikası, kalıcılık, disk sınırı ve izleme |
| Pazaryeri | Katalog ve soru connector modları `live`; her bağlantının doğru SANDBOX/PRODUCTION ortamı; kimlik şifreleme anahtarının kalıcı olması |
| Paddle | Backend ve frontend ortamları uyumlu; live API/client anahtarları ve price ID'leri; live webhook imzası ve doğru event listesi; test limitleri kapalı |
| Resend | Doğrulanmış gönderici domaini, uygun DNS kayıtları, production gönderen adresi, gerçek HTTPS webhook ve production secret; admin ekranında teslimat olayı görülmesi |
| Push | PUSH-01 düzeltildiyse doğru VAPID anahtarları; aksi durumda özellik kapalı |
| AI | Geçerli model/API ayarları, timeout ve provider hata davranışı; AI-01 için hesap bazlı maliyet/paralellik sınırı |
| Operasyon | Minimum gerekli admin allowlist, log rotasyonu, harici uptime/queue/backlog/disk uyarıları, restore ve rollback talimatı |

## 8. Düzeltmelerden sonra yapılacak kabul testleri

Şu an bu testler tamamlanmış gibi işaretlenmemeli. Gerçek sağlayıcı denemeleri önce sandbox/test hesaplarıyla yapılmalı; production kabulü ayrı, kontrollü bir adım olmalı.

| Test grubu | Senaryo | Geçme koşulu |
| --- | --- | --- |
| Temiz kurulum | Lockfile ile temiz dependency kurulumu, codegen, backend/frontend build, lint, unit + DB integration | Komutların hepsi exit 0; entegrasyon testi tekrarlarında kapanış hatası yok |
| Image/migration | Hedef Linux image build; boş DB ve önceki sürüm verisi üzerinde migration; restart | Servisler doğru sırayla hazır, migration tekrarında güvenli, kullanıcı verileri korunmuş |
| Giriş | Google/Microsoft, logout, session revoke, subdomain SSR yenilemesi | Login döngüsü yok; iptal edilen session tekrar veri alamıyor |
| Yetki matrisi | OWNER / ACCOUNT_ADMIN / temsilci / VIEWER / platform admin / yabancı hesap | Her rol yalnızca izinli read/write; URL'deki farklı store/workspace/question ID ile erişim yok |
| Ekip | Davet rol filtreleri, farklı e-posta, süre aşımı, revoke, eşzamanlı kabul, koltuk sınırı | Doğru kişi/mağaza/rol; limitler aşılmıyor; davet token'ı loglarda yok |
| Mağaza/kanal | Oluşturma, credential hata/yenileme, bağlantı kaldırma, arşiv/restore, aktif iş varken silme | Yetki/limit korunuyor; aktif işler sahipsiz veri veya takılı durum bırakmıyor |
| Katalog | 20 mağazada toplam 20.000 ürün ve gerçekçi varyantlar; ilk full sync, sonraki stok sync | Ürün/variant kimlikleri tekilleşiyor, kapasite sınırı tutarlı, stok doğru |
| Soru alma | Aynı soru tekrarı; SYNC-01'in üç hata noktası; bozuk sağlayıcı kaydı; sayfalama | Soru kaybolmuyor, duplicate oluşmuyor; hatalı kayıt diğer soruları kalıcı engellemiyor |
| Taslak | Paralel manuel/otomatik üretim, kota son hakkı, provider 429/timeout, stok değişimi, eksik kanıt | Dış çağrılar sınırlı, sayaç doğru, başarısız üretim ücret hakkı tüketmiyor, güvensiz taslak otomatik gitmiyor |
| AI kalite | Gerçekçi Türkçe sorular, beden/renk/stok, prompt injection, bilinmeyen bilgi | Uydurulan bilgi otomatik gönderilmiyor; ölçülen değerlendirme sonuçları kaydedilmiş |
| Cevap gönderimi | Manuel ve SAFE_AUTO; ağ cevabı kaybı, DB commit hatası, DB–Redis arası kapanma | ANSWER-01 kapanmış; belirsiz teslimat kontrollü, sonsuz kuyruk durumu yok |
| Paddle ilk ödeme | Başarılı/başarısız/3DS, checkout'un terk edilmesi ve yenilenmesi | Yanlış hesap/plan erişimi yok; bekleyen checkout güvenle toparlanıyor |
| Paddle dönem geçişi | Başarılı ve reddedilen yenileme, geciken/tekrarlanan/sırasız webhook, reconciliation | Erişim ve kota yalnızca doğrulanmış kurala göre; grace uzatılarak sınırsız erişim verilmiyor |
| Paddle plan/iptal | Upgrade/downgrade, limit aşımı, yıllık planın aylık kullanım penceresi, iptal/pause/refund | Eski/yeni plan sınırları doğru; mükerrer checkout/ücret oluşturulmuyor |
| E-posta/duyuru | Her rol + hepsi, mail switch kapalı/açık, preview sonrası alıcı değişimi, çift confirmation | Doğru alıcılar; kişi başına tek bildirim/mail; transaction rollback güvenli |
| Resend webhook | Geçersiz imza, erken/duplicate/sırasız olay, bounce/complaint, timeout/retry | Doğru teslim durumu; hassas içerik saklanmıyor; belirsiz gönderim kör tekrarlanmıyor |
| Bildirim/push | Tercihler, quiet hours, SSE reconnect; özel push hedefi ve timeout | Tercihler uygulanıyor, tenant sızıntısı yok, yasak hedefe çıkış yok |
| Destek/admin | İç mesaj görünürlüğü, farklı hesap ticket ID'si, müşteri/e-posta filtreleri | Müşteriye iç admin notu veya başka hesabın kaydı gösterilmiyor |
| Hesap kapatma | Aktif ödeme, bekleyen plan değişikliği, Paddle timeout, kapanış sonrası geciken webhook | Doğrulanmadan silinmiyor; silinen hesap webhook ile yeniden canlanmıyor |
| Kesinti | Redis/DB restart, SIGTERM, worker ortasında kapanma | Readiness doğru, işler güvenle toparlanıyor, e-posta/cevap kaybı açıkça görünür |
| Geri yükleme | Sunucu dışı yedekten ayrı ortam kurma, secrets geri kazanımı | DB, üyelik/abonelik ve şifreli bağlantılar gerçekten kullanılabilir |

### Hedef yük ve VDS kararı

Önceki kullanım varsayımı: **10 müşteri, 20 mağaza, 20.000 ürün, ayda 30.000 soru**. Bu hacim için yalnızca aylık soru ortalamasıyla sunucu yeterliliği kararı verilmemeli. Kodda stok taraması varsayılan 5 dakikada, soru taraması 2 dakikada, full katalog yenilemesi yaklaşık 24 saatte bir planlanıyor. Ürün varyantları, başlangıç senkronizasyonu ve aynı anda gelen işler yükü belirliyor.

Hedef VDS/container üzerinde bu veriyle inbox, arama, katalog, admin özetleri ve eşzamanlı sync ölçülmeli. API p95 gecikmesi, worker kuyruğunda bekleme, PostgreSQL sorgu süreleri/bağlantıları, CPU throttling, RAM/OOM, Redis bellek ve günlük disk büyümesi kaydedilmeli. Mevcut benchmark scripti incelenip izole veritabanına yönlendirilerek kullanılabilir; gerçek müşteri veritabanına seed/clean uygulanmamalı.

Bu incelemede yük testi yapılmadığından **“10 GB RAM / 4 vCPU kesin yeterli”** sonucu çıkarılmadı. Önce mevcut mimariyle ölçüm yapmak, ölçüm gerektirmeden worker'ları farklı sunuculara bölmekten daha uygun sonraki adımdır.

## 9. Önerilen iş sırası ve çıkış kriteri

1. **SEC-01 ve AUTH-01 — kod ve yerel testler tamamlandı; staging kabulü bekliyor:** Güvenli dependency sürümü ve gerçek production origin/çerez düzeni. Güncel kanıtlar rapor başındaki ilerleme bölümünde.
2. **SYNC-01 ve ANSWER-01 — kod ve yerel testler tamamlandı; ortam migration'ı/son kabul bekliyor:** Gelen soru kaybı, belirsiz cevap teslimatı ve yetim kuyruk kayıtları. Kanıtlar rapor başındaki 2. adım bölümünde.
3. **PUSH-01, AI-01, LOG-01 — kod ve yerel testler tamamlandı:** Push hedef/DNS kontrolü ve abonelik sınırı; hesap başına tek AI üretimi/cooldown; davet token redaksiyonu. Migration geçişi ve gerçek tarayıcı/HTTPS staging kabulü bekliyor; kanıt ve sınırlar raporun başında.
4. **OPS-01 ve OPS-02 — kod ve yerel Docker kabulü tamamlandı:** Docker/proxy/secrets/kalıcılık, şifreli backup/restore ve off-site zamanlama paketi; readiness ve HTTP/worker/SSE drain. Public TLS, gerçek off-site kurulum/restore ve VDS yük kabulü bekliyor; ayrıntılar raporun başında.
5. **QA-01 — kod ve yerel kontroller tamamlandı; uzak CI/staging kabulü bekliyor:** Genel lint, güvenli test kapanışı, otomatik spec keşfi, CI ve kritik billing/tenant testleri. 140 unit + 55 integration + 2 frontend güvenlik testi başarılı. Soru receipt yarışında doğrulanan ek düzeltme dahil; ayrıntılar rapor başında. Ardından yukarıdaki staging kabul matrisi.
6. **İsteğe bağlı temizlik — tamamlandı:** Ortak server API taşıması, `cn` standardizasyonu, `shadcn` build/dev bağımlılığı, gerçek README'ler ve metadata uyumu. Frontend 8/8 test, lint, yerel/Linux build başarılı; üretim dependency audit'i 0 bulgu. Ek backend dependency güvenlik kapanışı da tamamlandı; güncel kanıt rapor başında. Sonraki aşama uzak CI ve staging kabulüdür.

**Yayın kabulü:** P0/P1 maddeleri kapatılmış veya koşullu özellik devre dışı; hedef Linux image üzerinde temiz test/derleme; gerçek domainlerde giriş; sandbox ödeme/yenileme ve pazaryeri hata toparlama kanıtı; doğrulanmış restore/rollback; hedef yük altında ölçülmüş kabul edilebilir davranış. Bu koşullar tamamlandığında mevcut mimariyle kontrollü ilk müşteri yayını değerlendirilebilir.

## Ek — Kontrolleri yeniden çalıştırma

PowerShell; backend ve frontend komutları kendi dizinlerinde çalıştırılmalıdır:

```powershell
# backend
npm.cmd run db:generate
npm.cmd run check
npm.cmd run test:integration
npm.cmd audit --omit=dev --json

# frontend
npm.cmd run check
npm.cmd audit --omit=dev --json
```

Entegrasyon testleri yalnızca localhost PostgreSQL/Redis kabul eder; rastgele isimli test DB'si oluşturmak için CREATE DATABASE yetkisi gerekir. `TEST_DATABASE_URL` ve `TEST_REDIS_URL` ile ayrı test servislerini seçin. Test korumaları kaldırılarak production'a yönlendirilmemeli. Backend `lint` artık kaynak değiştirmez; düzeltme ayrı `lint:fix` komutudur. Temiz kurulum ve ayrıntılar: [kalite kontrol rehberi](backend/docs/quality-checks.md).

Ham kontrol çıktıları bu bilgisayarda `%TEMP%\core-assist-audit-20260926` altında tutuldu: build, lint JSON, audit JSON, unit test, iki integration çalışması ve sahte servislerle yapılan hedefli probe scriptleri. Bu geçici dosyalar kalıcı CI testi değildir; rapordaki kabul testleri düzeltme aşamasında depoya alınmalıdır.
