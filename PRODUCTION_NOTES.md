# Production Notes

Bu dosya, Core Asistan production ortamına alınmadan önce tamamlanması gereken işleri takip eder.

## Test ve CI kabulü

- Yerel/CI komutları ve test sınırları: [kalite kontrol rehberi](backend/docs/quality-checks.md). Her iki projede `npm run check`; backend'de ayrıca `npm run test:integration` çalıştırılır.
- [Quality workflow](.github/workflows/quality.yml) lint/test/build kapılarını otomatik çalıştırır; deploy yapmaz.
- Backend/frontend üretim dependency audit'i CI kapısına eklendi. Backend Prisma 7.10.0 için iki sürüme özel güvenlik override'ı kullanır; güncelleme/kaldırma şartları: [bağımlılık güvenliği](backend/docs/dependency-security.md).
- [ ] İlk GitHub Actions koşusunu doğrula ve backend/frontend job'larını required check yap.
- Temiz Linux CI komutları `node deploy/test-quality.mjs` ile yerelde geçti; gerçek GitHub koşusu/staging yerine sayılmaz. Aday SHA, ortam ve kabul sonuçları: [staging kabul kaydı](deploy/STAGING_ACCEPTANCE.md).
- [ ] [Production incelemesindeki](PRODUCTION_READINESS_AUDIT.md) staging kabul matrisini gerçek test hesaplarıyla tamamla. Yerel Paddle imza/tenant testleri gerçek checkout ve plan değişikliği kabulü değildir.

## Docker dağıtımı ve işletim

- Production paketi: [docker-compose.production.yml](docker-compose.production.yml); hazırlık, migration, güncelleme ve geri dönüş: [dağıtım rehberi](deploy/README.md).
- Yalnızca proxy portları dışarı açılır. Backend/frontend image'ları ayrı, sırlar dosya tabanlı Compose secrets, Redis AOF/noeviction, DB/Redis/sertifikalar kalıcı volume kullanır.
- `/health` liveness, `/health/ready` PostgreSQL/Redis readiness kontrolüdür. SIGTERM önce HTTP/worker/SSE drain yapar; sonra provider'ları kapatır. Backend için 180 saniye container grace period tanımlıdır.
- Şifreli PostgreSQL yedek/ayrı DB'ye restore scriptleri, rclone off-site kopya ve systemd zamanlama şablonu eklendi. Sunucuya kurulmadı; gerçek remote ve recovery anahtarı operatörce yapılandırılmalı.
- [ ] VDS DNS/TLS, OAuth ve webhook originlerini doğrula.
- [ ] Sırları ve mevcut şifreleme anahtarlarını güvenli taşı; migration öncesi backup al.
- [ ] Günlük off-site backup'ı çalıştır, uzaktan indirip restore et; disk ve son başarılı backup alarmını kur.
- [ ] Hedef VDS üzerinde yük ve yeniden başlatma kabulünü yap; yerel Docker testleri kapasite garantisi değildir.

## Production alan adları

- Web uygulaması: `https://coreasistan.com`
- Backend API: `https://api.coreasistan.com`
- Google callback: `https://api.coreasistan.com/api/auth/callback/google`
- Microsoft callback: `https://api.coreasistan.com/api/auth/callback/microsoft`

### Web/API oturum çerezi

Backend production ortamında aşağıdaki değerler birlikte yapılandırılmalı:

```dotenv
NODE_ENV=production
BETTER_AUTH_URL=https://api.coreasistan.com
FRONTEND_URL=https://coreasistan.com
AUTH_COOKIE_DOMAIN=coreasistan.com
```

Frontend build ortamında `NEXT_PUBLIC_API_URL=https://api.coreasistan.com` kullanılmalı. SSR için `API_URL` tanımlanıyorsa backend'e ulaşan adres olmalı; `BETTER_AUTH_URL` ise tarayıcının kullandığı dış HTTPS origin olarak kalmalı. URL değerlerine `/api/auth` eklenmez.

Ortak domain, API'nin oluşturduğu oturum çerezinin frontend'e de ulaşmasını ve SSR oturum kontrolünün çalışmasını sağlar. Oturum çerezi `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` özelliklerini korur. Son giriş yöntemini hatırlatan Better Auth çerezi aynı domaini devralır; arayüzün okuması gerektiği için bu tercih çerezi HttpOnly değildir. Ortak cookie domaini bütün subdomainleri güvenilir origin yapmaz; mevcut origin kontrolleri korunur.

- `AUTH_COOKIE_DOMAIN` kapsamındaki **bütün subdomainler güvenilir olmalı**. Kullanıcıların içerik/site barındırdığı veya başka kişilere devredilen subdomainleri bu kapsama almayın.
- Localhost geliştirmede (`localhost:3001` + `localhost:4001`) bu değişken boş kalır. Aynı host üzerinde HTTPS reverse proxy kurulumunda da ortak domain gerekmez.
- Staging/production çerezlerini tamamen ayırmak için staging'i farklı bir ana domain altında kurun ve kendi ortak cookie domainini kullanın. `staging.coreasistan.com` + `api.staging.coreasistan.com` için `staging.coreasistan.com` kapsamı staging çerezini sınırlar; ancak production'ın `coreasistan.com` çerezi bu hostlara da gider. Bu düzen tam izolasyon sağlamaz ve yalnızca güvenilir staging ortamında kullanılmalıdır.
- Farklı web/API hostları için eksik/uyumsuz domain, public suffix (`com`, `co.uk`, `github.io`) ve HTTPS dışı ortak cookie ayarı başlangıçta hata verir.
- Mevcut bir ortamın cookie domaini değiştiriliyorsa eski host/domain kapsamındaki çerezleri temizleyip yeniden giriş yapın; aynı isimde eski host-only çerez bırakmayın.

Yerel regresyon: backend'de `npm run test:auth`, frontend'de `npm run test:security`.

- [ ] HTTPS staging üzerinde Google ve Microsoft ile giriş, dashboard yenilemesi/rota değişimi ve çıkış sonrası erişim reddini doğrula.
- [ ] Gerçek ürün/profil görsellerini ve Server Action üzerinden mağaza seçimini staging'de doğrula. Optimizer yalnızca `cdn.dsmcdn.com`, `productimages.hepsiburada.net`, `lh3`–`lh6.googleusercontent.com` hostlarını kabul eder; yeni CDN gerekirse gerçek URL doğrulanarak listeye eklenir. Query parametreli uzak görseller ve yönlendirmeler kapalıdır.

## Soru/cevap teslimatı sürüm geçişi

- Yeni cevap durumu ve eski denemeleri ayıran iki migration eklendi. **Eski backend/answer worker instance'ları durdurulduktan sonra** `npm run db:migrate:deploy` uygulanmalı; ardından yalnızca yeni sürüm başlatılmalı. Bu çalışma sırasında uygulama DB'si yerine izole test DB'leri güncellendi.
- Belirsiz gönderimler panelde **Teslimat kontrolü** olarak görünür; otomatik tekrar gönderilmez. Operatör kararı için yeni backend build'inin `npm run repair:answer` komutu vardır.
- Redis tamamen sıfırlanırsa yeni backend yeniden başlatılarak reconciliation scheduler'ı yeniden kurulmalı.
- Tam geçiş/onarım ve test adımları: [Soru ve cevap teslimatının toparlanması](backend/docs/question-delivery-recovery.md).

## Push, AI taslak ve log korumaları

- `20260927060000_add_ai_draft_lease` migration'ı yeni backend başlamadan uygulanmalı. Eski/yeni backend birlikte çalıştırılmamalı; yukarıdaki worker durdurma sırası geçerli. Yerel doğrulamada yalnızca izole test DB'si güncellendi.
- AI üretimi hesap başına aynı anda 1 işlem ve başlangıçlar arasında 5 saniye ile sınırlı. Manuel istek bekleme yanıtı alır; otomasyon işi ertelenir. Yeni env değişkeni gerekmiyor.
- Push hedefleri izinli tarayıcı servisleriyle sınırlı; gönderimde DNS/IP doğrulanıyor. Kullanıcı başına 10 abonelik sınırı var.
- Backend davet URL token'larını maskeliyor. Proxy/CDN erişim loglarında aynı koruma dağıtım adımında ayrıca sağlanmalı.
- [Geçiş, sınırlar ve staging kabul adımları](backend/docs/production-guards.md).

## Harici servislerde marka adı

- [ ] Paddle ürün ve fiyat adlarını `Core Asistan Starter`, `Core Asistan Growth` ve `Core Asistan Business` olarak güncelle.
- [ ] Google OAuth izin ekranındaki uygulama adını `Core Asistan` yap ve production callback adresini ekle.
- [ ] Microsoft Entra uygulama adını `Core Asistan` yap ve production callback adresini ekle.
- [ ] Resend gönderici domainini `coreasistan.com` olarak doğrula; gönderici adını `Core Asistan` yap.
- [ ] Resend teslimat webhook'unu kur ve backend'e `RESEND_WEBHOOK_SECRET` ekle. Adımlar: [E-posta teslimat takibi](backend/docs/admin-emails.md).

## Ekip davetleri

- [x] Ekip daveti oluşturulduğunda kullanıcıya Resend üzerinden otomatik davet e-postası gönder.
- [x] E-postada hesap adı, verilen rol, erişilebilen mağazalar, son kullanma tarihi ve kabul bağlantısı yer alsın.
- [x] Davet token'ını veritabanında yalnızca hash olarak, bekleyen e-posta içeriğinde şifreli olarak sakla; loglama.
- [x] Davet bağlantısını `FRONTEND_URL` üzerinden oluştur; production ortamında HTTPS kullan.
- [x] Teslimatı idempotent kaydet ve geçici Resend hatalarını yeniden dene.
- [x] Gönderim durumunu ekip ekranında göster; başarısızlıkta daveti koru ve yeniden gönderme sun.

## Rol bazlı e-posta bildirimleri

Yalnızca önemli, işlem gerektiren veya güvenlikle ilgili olaylar e-posta olarak gönderilmelidir. Sık gerçekleşen operasyonel olaylar tek tek gönderilmemeli; tercihe bağlı veya özet olmalıdır.

| Olay | Alıcılar | Gönderim şekli |
| --- | --- | --- |
| Davet oluşturuldu | Davet edilen kişi | Anında ve zorunlu |
| Davet kabul edildi | Hesap sahibi ve daveti oluşturan yönetici | Anında |
| Rol veya mağaza erişimi değişti | Yetkisi değişen kullanıcı | Anında ve zorunlu |
| Üye ekipten çıkarıldı | Çıkarılan kullanıcı | Anında ve zorunlu |
| Ödeme başarısız oldu, abonelik veya plan değişti | Hesap sahibi ve hesap yöneticileri | Anında ve zorunlu |
| Fatura veya iade oluştu | Hesap sahibi ve hesap yöneticileri | Anında |
| AI kotası `%80`, `%95` veya `%100` oldu | Hesap sahibi ve hesap yöneticileri | Her eşikte bir kez |
| Kanal bağlantısı koptu | İlgili mağaza yöneticileri ve hesap yöneticileri | Anında |
| Ürün veya soru senkronizasyonu tekrar tekrar başarısız oldu | İlgili mağaza yöneticileri | Hata eşiği aşıldığında |
| Otomatik yanıt gönderilemedi veya otomasyon durdu | İlgili mağaza yöneticileri ve temsilciler | Anında |
| İnceleme bekleyen sorular birikti | İlgili mağaza yöneticileri ve temsilciler | Günlük özet |
| Düşük veya tükenen stok | İlgili mağaza yöneticileri | Tercihe bağlı özet |
| Yeni cihazdan giriş veya giriş sağlayıcısı değişikliği | İlgili kullanıcı | Anında ve zorunlu |
| Hesap silme talebi | İlgili kullanıcı ve hesap sahibi | Anında ve zorunlu |

### Teslimat kuralları

- [ ] Backend'de merkezi bir `olay -> alıcı rolleri` politikası oluştur.
- [ ] `createForStoreMembers` ile tüm mağaza üyelerine yayın yapmak yerine rol ve mağaza erişimine göre alıcı seç.
- [ ] Hesap sahibi finans, güvenlik, ekip ve kritik operasyon e-postalarını alsın.
- [ ] Hesap yöneticileri finans, ekip ve tüm mağazaların kritik bildirimlerini alsın.
- [ ] Mağaza yöneticileri ve temsilciler yalnızca erişebildikleri mağazalarla ilgili e-postaları alsın.
- [ ] Görüntüleyicilere varsayılan olarak operasyonel e-posta gönderme.
- [ ] Finans ve güvenlik e-postaları kapatılamasın; stok, AI ve senkronizasyon e-postaları kullanıcı tercihine bağlı olsun.
- [ ] Aynı olay için mükerrer gönderimi engelle; yoğun bildirimlerde hız sınırı ve günlük özet kullan.
