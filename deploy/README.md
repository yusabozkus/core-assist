# Tek VDS üzerinde production dağıtımı

`docker-compose.production.yml`, PostgreSQL 16, Redis 7, NestJS, Next.js standalone ve Caddy HTTPS proxy'sini çalıştırır. Kök `docker-compose.yml` yalnızca geliştirme içindir; portları localhost'a bağlanır. Production dosyasını geliştirme Compose'una eklemeyin; tek başına `-f docker-compose.production.yml` kullanın.

## Ağ, kapasite ve sırlar

Sunucu satın almadan yerelde HTTP/SSR kabulünü çalıştırmak için `node deploy/test-local-e2e.mjs` kullanılabilir. İzole ortam, kapsam ve 37 senaryonun sonuçları: [yerel E2E kaydı](LOCAL_E2E_RESULTS.md). Bu kontrol tarayıcı etkileşimleri ve gerçek sağlayıcı kabulünün yerine geçmez.

- Yalnızca proxy 80/443 TCP ve 443 UDP yayınlar. API, frontend, PostgreSQL ve Redis host portu yayınlamaz. DB/Redis `internal` ağdadır; backend ayrıca dış sağlayıcılara ulaşabilen uygulama ağına bağlıdır.
- Başlangıç bellek tavanları: PostgreSQL 2 GiB, Redis 1.25 GiB (`maxmemory=512mb`; AOF rewrite/overhead için ek pay), backend 3 GiB, frontend 1.5 GiB, proxy 256 MiB. Bunlar gerçek kullanım veya performans garantisi değildir. 10 GB VDS'de OS, Docker ve Redis AOF rewrite için payı izleyin; `docker stats`, disk doluluğu ve kuyruk gecikmesiyle ayarlayın. Image build'i trafik alan VDS dışında yapmak tercih edilir; VDS'de yapılıyorsa sıralı derleyin.
- Redis AOF/everysec ve `noeviction` kullanır. Ani makine kaybında son yaklaşık 1 saniye yazım kaybı mümkündür. `noeviction`, bellek dolduğunda yeni yazımların hata alması demektir; disk/RAM alarmı gereklidir. Volume bir yedek değildir.
- Docker logları servis başına 3 × 10 MB ile döner. Caddy erişim ve HTTP hata loglarında URI, request/response header alanları çıkarılır; davet token'ı, OAuth query ve Cookie loglanmaz. Backend rota/durum/süre tanı logları tutulur. Üstte CDN/başka proxy varsa onun log politikasını ayrıca ayarlayın.
- Uygulama konteynerleri `node` kullanıcısıyla, salt okunur root dosya sistemiyle çalışır; Next cache ve `/tmp` geçicidir. Kalıcı veriler DB/Redis ve Caddy sertifika volume'larındadır.
- Sırlar image'a/build arg'a konmaz; Compose secret dosyaları `/run/secrets` altında okunur. Compose dosya sırları disk üzerinde şifreli bir kasa değildir. Sunucu/backup erişimini sınırlandırın; Docker yönetim yetkisi secret okuma yetkisidir.

## İlk hazırlık

Linux VDS'de Docker Engine + Compose v2.24.4 veya yenisi, doğru DNS A/AAAA kayıtları ve 80/443 erişimi gerekir. Kullanılmayan AAAA kaydı bırakmayın. Host firewall'da yönetim SSH erişimi ayrıca sınırlandırılmalı; DB/Redis için firewall istisnası açılmamalı.

Repo kökünde:

```sh
cp deploy/.env.example deploy/.env
install -d -m 700 deploy/secrets
openssl rand -hex 32 > deploy/secrets/postgres_password
openssl rand -hex 32 > deploy/secrets/redis_password
cp backend/.env.example deploy/secrets/backend.env
chmod 600 deploy/.env
```

`backend.env` içindeki gerçek sırları doldurun. Gerekli alanlar: Better Auth secret (en az 32 karakter), Google OAuth, `INTEGRATION_CREDENTIALS_KEY` (32 bayt base64), Gemini, Resend API/webhook/gönderici, Paddle API/webhook ve altı fiyat ID'si. VAPID ve Microsoft opsiyoneldir. Mevcut veriyi taşıyorsanız **mevcut şifreleme anahtarlarını koruyun**; yeniden üretmek kayıtlı kimlik bilgilerini/e-posta içeriklerini okunamaz yapar. Yeni kurulumda Better Auth için `openssl rand -hex 32`, entegrasyon anahtarı için `openssl rand -base64 32` kullanılabilir.

Destek sohbetlerinde görsel göndermek için özel Backblaze B2 bucket'ının S3 endpoint, region ve bucket adını; ayrıca yalnızca bu bucket'a kısıtlı key ID ve application key'i `backend.env` içindeki `SUPPORT_B2_*` alanlarına yazın. Key'in `readFiles`, `writeFiles` ve `deleteFiles` yetkileri olmalı. Bucket public olmamalı; erişim uygulamanın kimlik ve talep yetkisi kontrollerinden geçer. Ayrı staging ve production bucket/key kullanın. Bu ayarlar yoksa metin mesajları çalışır, görsel yükleme 503 döner. Yeni `support_attachment` migration'ı uygulamayı başlatmadan önce çalıştırın; migration mevcut taleplere dokunmaz. Görseller mesaj başına en fazla 3 adet ve dosya başına 5 MiB olabilir; sunucu geçerli görüntü verisini yeniden kodlayıp EXIF'i temizler, 16 milyon pikseli aşan girişleri reddeder. Kullanıcı başına 10 dakikada 20 yükleme ve çalışma alanı başına 512 MiB destek görseli sınırı uygulanır. Caddy yalnızca görsel yükleme rotalarında 17 MB, diğer isteklerde 2 MB gövde sınırı kullanır.

Compose; DB/Redis URL, dış originler, connector modları, Paddle ortamı ve log ayarlarını açıkça belirler; `backend.env` bunları geçersiz kılamaz. `.env.example` dosyasındaki localhost/mock/sandbox varsayılanlarını uygulama ortamına yanlışlıkla taşımamak için bu ayrım vardır. Sırlar dotenv sözdizimiyle okunur, shell kodu olarak çalıştırılmaz.

Dosya tabanlı Compose secrets, host dosya izinlerini korur; `uid/gid/mode` yeniden eşlemesi beklemeyin. Konteynerdeki root olmayan kullanıcıların okuyabilmesi için dosyaları okunur yapıp **ana dizini yalnızca sunucu yöneticisine açık tutun**:

```sh
chmod 700 deploy/secrets
chmod 444 deploy/secrets/backend.env deploy/secrets/postgres_password deploy/secrets/redis_password
```

`deploy/.env` içinde gerçek domainleri, ortak cookie domainini, ACME e-postasını, public Paddle client token'ını ve benzersiz `RELEASE_TAG` değerini yazın. API key'i `PADDLE_CLIENT_TOKEN` yerine koymayın. Production'da `PADDLE_ENV=production`; bilinçli sandbox kabulünde `DEPLOYMENT_ENV=staging`, `PADDLE_ENV=sandbox`. Her ikisinde connector modları `live` kalır. Staging farklı DB, volume, sırlar ve güvenilir ayrı domain kullanmalı; production verisinin kopyasını worker'larla açmayın.

Production web/API adresleri sırasıyla `https://coreasistan.com` ve `https://api.coreasistan.com` olarak planlanmıştır. OAuth callback adresleri `https://api.coreasistan.com/api/auth/callback/google` ve `https://api.coreasistan.com/api/auth/callback/microsoft` olmalıdır. Backend'de aşağıdaki origin ve cookie ayarlarını birlikte doğrulayın:

```dotenv
NODE_ENV=production
BETTER_AUTH_URL=https://api.coreasistan.com
FRONTEND_URL=https://coreasistan.com
AUTH_COOKIE_DOMAIN=coreasistan.com
```

Frontend build'inde `NEXT_PUBLIC_API_URL=https://api.coreasistan.com` kullanın. SSR için `API_URL` iç ağdaki backend adresi olabilir; `BETTER_AUTH_URL` tarayıcının kullandığı dış HTTPS origin olarak kalır. Adreslere ayrıca `/api/auth` eklemeyin. Ortak cookie domaini API oturum çerezini frontend SSR'a ulaştırır; `Secure`, `HttpOnly`, `SameSite=Lax` ve `Path=/` özellikleri korunur. Son giriş yöntemini hatırlatan tercih çerezi arayüz tarafından okunduğu için HttpOnly değildir. Ortak domain, başka subdomainleri güvenilir origin yapmaz; origin kontrolleri sürer. `AUTH_COOKIE_DOMAIN` kapsamındaki tüm subdomainler güvenilir olmalı; kullanıcıya devredilen subdomainleri bu kapsama almayın. Localhost veya tek hostlu HTTPS kurulumunda ortak domain boş kalır. Domain değiştirildiğinde eski kapsamlı çerezleri temizleyip yeniden giriş yapın.

## Build, migration ve başlatma

### Staging ortamını hazırlama

Staging için ayrı sunucu/checkout üzerinde `cp deploy/.env.staging.example deploy/.env` ile başlayın. Örnekteki domainleri size ait staging domainleriyle değiştirin; `example.net` kullanıma hazır bir adres değildir. Secret dosyalarını `deploy/secrets/staging/` içinde oluşturun; yukarıdaki ilk hazırlık komutlarında ve izin ayarlarında bu yolu kullanın. Ayrı test hesapları, Paddle sandbox anahtarları/fiyatları ve sandbox public client token tanımlayın. `RELEASE_TAG=staging-<commit-sha>` kullanın; production image etiketiyle aynı etiketi kullanmayın.

Compose varsayılan proje adı ortama göre `core-assist-staging` veya `core-assist-production` olur. Böylece DB/Redis/Caddy volume ve ağ adları ayrılır; production'ın mevcut kaynak adları değişmez. Shell'de `COMPOSE_PROJECT_NAME` veya komutta `-p` verilmesi bu ayrımı geçersiz kılabilir; iki ortama aynı proje adını vermeyin. Örnek staging dosyası secret ve backup yollarını da ayırır. Her iki proxy 80/443 kullandığından mevcut dosya iki ortamı aynı hostta eşzamanlı yayınlamak için yeterli değildir; ayrı host kullanın veya ortak proxy tasarımını ayrıca yapın.

Production cookie domaini `coreasistan.com` olduğunda cookie'ler onun alt domainlerine de gönderilir. Bu nedenle tam ayrım için staging'e bu kapsamın dışında bir domain seçin; örnekte `staging.example.net` bunun için kullanılır. `staging.coreasistan.com` ile `api.staging.coreasistan.com` ve `AUTH_COOKIE_DOMAIN=staging.coreasistan.com` staging çerezini kendi içinde sınırlar, ancak production çerezi bu hostlara da gider; yalnızca güvenilir staging ortamında kullanılabilir. `WEB_DOMAIN`, `API_DOMAIN`, `AUTH_COOKIE_DOMAIN` ve sağlayıcı callback/webhook adresleri aynı staging kurulumunu göstermeli. Public suffix veya HTTPS dışı ortak cookie domaini başlangıçta reddedilir.

Konteyner başlatmadan örneklerin kaynak ayrımını doğrulamak için repo kökünde `node --test deploy/compose-config.test.mjs` çalıştırın. Bu test gerçek secret dosyalarını okumaz; Docker Compose CLI gerekir. Gerçek domain/sağlayıcı kabulünün yerine geçmez.

### Dağıtım komutları

Her komutu repo kökünde çalıştırın:

```sh
docker compose --env-file deploy/.env -f docker-compose.production.yml config --quiet
docker compose --env-file deploy/.env -f docker-compose.production.yml build backend
docker compose --env-file deploy/.env -f docker-compose.production.yml build frontend
# Ağ çağrısı yapmadan temel production yapılandırmasını doğrula:
docker compose --env-file deploy/.env -f docker-compose.production.yml run --rm --no-deps backend -e "require('./dist/src/infrastructure/runtime/production-config').validateProductionConfig(); require('./dist/src/modules/auth/auth-runtime.config').authRuntimeConfig(); console.log('Configuration accepted')"
docker compose --env-file deploy/.env -f docker-compose.production.yml up -d postgres redis
docker compose --env-file deploy/.env -f docker-compose.production.yml run --rm --no-deps migrate
docker compose --env-file deploy/.env -f docker-compose.production.yml up -d --wait backend frontend proxy
```

`migrate` tek seferlik servistir. Normal backend restart migration çalıştırmaz. `up` migration bağımlılığını da kontrol eder; manuel çalıştırmadan sonra yeniden `migrate deploy` görülmesi idempotenttir. Uygulama başlatılmadan başarılı migration şarttır. Prisma CLI runtime image içinde mevcuttur.

`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PADDLE_ENV` ve client token **frontend build sırasında** bundle'a yazılır. Değişirse frontend image'ını yeniden derleyin. SSR iç ağdan `API_URL=http://backend:4001` kullanır. Frontend 3000, backend 4001 dinler; dış HTTPS originleri değişmez.

Production doğrulaması eksik anahtarları, mock connector'ları, test billing limitlerini ve yanlış Paddle ortamını reddeder. Bu kontrol sağlayıcı anahtarının gerçekten geçerli olduğunu kanıtlamaz; OAuth/ödeme/e-posta kabulü ayrıca gerekir.

## Güncelleme ve geri dönüş

1. Yeni image'ları yeni release etiketiyle önceden derleyin; mevcut etiket/digest ve deploy env kopyasını kaydedin. Trafik alan image etiketini yeniden kullanmayın.
2. Kısa bakım penceresinde proxy, frontend ve **tüm eski backend/worker instance'larını** durdurun. Tek instance kurulumunda bu planlı kesintidir; sıfır kesinti iddiası yoktur.
3. Aşağıdaki yöntemle şifreli DB yedeği alın ve sunucu dışına kopyalayın; sırların geri kazanım kopyasının da bulunduğunu doğrulayın.
4. Yeni image ile migration çalıştırın; yeni backend/frontend/proxy'yi başlatın. `/health/ready`, login, migration durumu ve gönderim kuyruğunu kontrol edin.
5. Sadece schema geriye uyumluysa önceki image etiketine dönün. Migration'ları körlemesine geri almayın. Schema uyumsuzsa backup'ı ayrı DB'ye restore edip doğrulayın; eski/yeni işlemleri uzlaştırdıktan sonra kontrollü DB geçişi yapın. Restore yeni yazılan verileri geri getirmez.

Eski cevap denemelerini karantinaya alan migration nedeniyle [cevap teslimatı geçiş kuralları](../backend/docs/question-delivery-recovery.md) geçerlidir. Geri yüklenen DB'yi üretime bağlamadan önce backup sonrasında dışarıya gönderilmiş cevap/ödeme/e-postaları kontrol edin; eski queue veya QUEUED satırlarını körlemesine tekrar çalıştırmayın.

## Sağlık ve kapanış

- `/health`: işlem HTTP isteğine yanıt verebiliyor (liveness).
- `/health/ready`: bootstrap tamamlandı, shutdown başlamadı, PostgreSQL sorgusu ve Redis PING başarılı. Başarısızsa 503; ayrıntı/sır dışarı verilmez. Probe bağlantıları ve komutları 1 saniye sınırlarıyla çalışır; eşzamanlı kontroller birleştirilir, sonuç 1 saniye önbelleğe alınır. Proxy 5 saniyede bir kontrol eder; kesinti görünürlüğü anlık değildir.
- Docker `unhealthy` tek başına otomatik restart yapmaz. Alarm ve operatör müdahalesi gerekir. DB/Redis geri gelince readiness yeniden yeşile döner.
- SIGTERM/SIGINT: readiness kapanır; yeni HTTP kabulü durur, açık bildirim SSE akışları sonlandırılır. BullMQ worker'ları yeni iş almayı bırakıp aktif işi bitirir; HTTP ve periyodik temizlik tamamlanır. Sonra Nest provider'ları, Prisma ve Redis bağlantıları kapanır.
- Backend iç sınırı 150 saniye, Docker grace period 180 saniyedir. Süre aşımı zorunlu çıkışla sonuçlanır; sınırsız/uzun işlerin tamamlanması garanti edilmez. [Belirsiz teslimat toparlama](../backend/docs/question-delivery-recovery.md) devreye girer. Nest `enableShutdownHooks()` ayrıca açılmamalı; drain sırasını koruyan açık sinyal işleyicisi kullanılır.

## Şifreli yedek ve ayrı DB'ye geri yükleme

Operatör bilgisayarında `age-keygen -o core-assist-recovery.key` ile recovery kimliği oluşturun. **Özel anahtarı VDS'de tutmayın**; güvenli ikinci kopyasını saklayın. Public `age1...` recipient'ını `deploy/.env` içindeki `AGE_RECIPIENT` alanına yazın. Sunucuda `BACKUP_DIR` için repo dışı, izinleri 700 olan bir klasör oluşturun. Yedek helper image'ı:

```sh
docker compose --env-file deploy/.env -f docker-compose.production.yml --profile ops build backup
docker compose --env-file deploy/.env -f docker-compose.production.yml --profile ops run --rm --no-deps backup
```

`pg_dump` custom format çıktısı doğrudan age ile şifrelenir; plaintext dump diske yazılmaz. Başarıyla biten dosya `.dump.age` adına taşınır ve SHA-256 dosyası eklenir. Hata alan `.partial` temizlenir; mevcut yedeklerin üzerine yazılmaz. Bu tutarlı PostgreSQL snapshot'ıdır; Redis ile atomik ortak snapshot değildir.

Sunucu dışında yeni bir recovery ortamına indirdiğiniz yedeği ve checksum'u `BACKUP_DIR` içine koyun. Recovery özel anahtarını yalnızca geçici olarak mount edin. `RESTORE_DATABASE` yeni bir `restore_...` adı olmalı; script mevcut DB üzerine yazmaz:

```sh
docker compose --env-file deploy/.env -f docker-compose.production.yml --profile ops run --rm --no-deps \
  -e RESTORE_DATABASE=restore_acceptance \
  -v /secure/core-assist-recovery.key:/run/secrets/backup_identity:ro \
  --entrypoint bash backup /usr/local/bin/core-restore core-assist-YYYYMMDDTHHMMSSZ-NNN.dump.age
```

Script checksum, decrypt ve archive list kontrolünden sonra yeni DB oluşturur; restore hatasında işlemi başarısız sayar ve yarım DB'yi otomatik silmez. Ayrı DB'de migration tablosu, kullanıcı/mağaza/ürün/soru adetleri ve şifrelenmiş kimlik bilgilerini açabilme kontrol edilmeli. Test ortamında dış gönderimler/worker'lar kapalı tutulmalı. Doğrulanmış restore için backup öncesi anahtarlar da gerekir: entegrasyon anahtarı, Better Auth/OAuth, Resend/Paddle/VAPID ve deploy ayarlarının güvenli ayrı kopyasını saklayın.

Redis volume'ı AOF ile kalıcıdır; bu pakette Redis'in sunucu dışı otomatik yedeği yoktur. Redis kaybında scheduler'ların kurulması için backend yeniden başlatılmalı; cevap outbox reconciliation ve [teslimat rehberi](../backend/docs/question-delivery-recovery.md) uygulanmalı. DB'den yeniden kurulabilen cevap kuyruğu, bütün BullMQ işlerinin eksiksiz geri geldiği anlamına gelmez; draft/sync/email/webhook kuyruğu ve sağlayıcı yeniden teslimatları son kabulde ayrı incelenmeli. Eski Redis snapshot'ını yeni DB ile gelişigüzel eşleştirmeyin.

## Sunucu dışı kopya ve zamanlama

Sunucuda `rclone` kurup yalnızca yedek hedefi için yetkili bir remote tanımlayın. Şifreleme zaten age ile yapılır. Remote retention/versioning ve mümkünse silmeye karşı koruma sağlayıcı tarafında kurulmalı. `backup-offsite.sh` **copy** kullanır, uzaktaki dosyaları silmez.

`/etc/core-assist-backup.env` (600) örneği:

```dotenv
BACKUP_DIR=/var/backups/core-assist
BACKUP_REMOTE=backup-storage:core-assist-production
```

`BACKUP_DIR`, deploy env ile aynı olmalı. Checkout `/opt/core-assist` dışında ise service dosyasındaki iki yolu düzeltin. Servis kullanıcısının rclone config'ine eriştiğini doğrulayın.

```sh
sudo install -m 644 deploy/core-assist-backup.service /etc/systemd/system/
sudo install -m 644 deploy/core-assist-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start core-assist-backup.service
sudo systemctl enable --now core-assist-backup.timer
sudo systemctl status core-assist-backup.service
```

Önce elle çalıştırıp uzaktan indirme/restore prova edilmeli. Günlük programın başarılı son çalışma zamanına alarm kurun. Başlangıç hedefi: günlük yedek, en az 14 günlük geri dönüş noktası; iş ihtiyacına göre sıklaştırın. Bu programla felaket halinde yaklaşık 24 saat veri kaybı kabul edilmiş olur. Dosyalar otomatik budanmaz; ölçülen DB/yedek boyutuna göre yerel ve remote retention tanımlayın, disk boşluğuna alarm koyun. 70 GB disk için kontrol edilmemiş süresiz birikim uygun değildir.

## Tekrarlanabilir yerel kabul

CI komutlarını gerçek `.env` kullanmadan temiz Linux/Node 22 ortamında doğrulamak için `node deploy/test-quality.mjs` çalıştırın. Gerçek GitHub koşusu ve sağlayıcı kabulü için [staging kabul kaydını](STAGING_ACCEPTANCE.md) kullanın.

Önce sahte public ayarlarla test image'larını üretin; sonra Docker testini çalıştırın:

```sh
docker build -t core-assist-backend:ops-test backend
docker build -t core-assist-frontend:ops-test \
  --build-arg NEXT_PUBLIC_API_URL=https://api.ops-test.example.com \
  --build-arg NEXT_PUBLIC_PADDLE_ENV=sandbox \
  --build-arg NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_ops_placeholder frontend
node deploy/test-production.mjs
```

Test mevcut `.env`/uygulama DB'sini kullanmaz; rastgele proje, secret, ağ ve volume oluşturur. Dış sağlayıcı anahtarları yoktur. Gerçek migration/startup, DB/Redis kesintisi, proxy yönlendirmesi/log redaksiyonu, şifreli backup/restore ve SIGTERM çalıştırılır. Test projesinin container/volume'ları sonunda temizlenir; `.ops-test` altında yalnızca sahte test sırları, yedek ve loglar kalır. Public TLS/ACME, sunucu dışı rclone hedefi ve gerçek sağlayıcı kabulü bu yerel testin kapsamı değildir.

Kaynak davranışları: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Compose başlatma sırası](https://docs.docker.com/compose/how-tos/startup-order/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Caddy log filtreleri](https://caddyserver.com/docs/caddyfile/directives/log), [BullMQ production](https://docs.bullmq.io/guide/going-to-production), [BullMQ graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown).
