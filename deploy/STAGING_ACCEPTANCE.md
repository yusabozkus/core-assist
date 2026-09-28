# Staging kabul kaydı

Bu dosya, güncel yayın durumunu, kabul ölçütlerini ve yerel kontrollerden gerçek ortam kabulüne geçişi takip eder. Aşağıdaki bekleyen satırlar test edilmiş sayılmaz; tamamlanan her yeni adayın commit'i ve kanıtı burada güncellenmelidir.

## Ortam ve sürüm

| Alan | Mevcut durum |
| --- | --- |
| Kaynak | `yusabozkus/core-assist`; `ci/production-readiness`, doğrulanan uygulama commit'i `262252c6c4d3d31bc08ea0440fe6fb63eb21c95e` |
| GitHub Quality koşusu | [36354084467](https://github.com/yusabozkus/core-assist/actions/runs/36354084467) başarılı; backend ve frontend aynı commit için geçti |
| VDS / web ve API originleri | Henüz doğrulanmadı |
| Deploy yapılandırması | `deploy/.env` ve `deploy/secrets` bu çalışma dizininde yok |
| Yerel Docker kabulü | Önceki adımda migration/readiness/backup-restore/SIGTERM başarılı; public HTTPS ve gerçek sağlayıcı kabulü değildir |
| Yerel HTTP/SSR E2E | [37/37 izole senaryo geçti](LOCAL_E2E_RESULTS.md); tarayıcı ve sağlayıcı kabulü ayrıca bekliyor |

27 Eylül temiz Linux kontrolünde CI'a özgü bir test ayarı eksikliği bulundu: Better Auth `NODE_ENV=test` altında Origin denetimini varsayılan atladığı için auth regresyonu 403 yerine 200 aldı. Test örneğinde Origin/CSRF korumaları açıkça etkinleştirildi; production uygulama ayarı değiştirilmedi. Düzeltmeden sonra hedefli auth paketi 20/20 geçti.

Son temiz Linux koşusu **başarılı / exit 0**: backend audit/lint, 140 unit + 55 integration, Nest build; frontend audit/lint, 8 test ve Next build. Koşu `core-quality-test-7b0e6b487e`; loglar yerelde `.ops-test/core-quality-test-7b0e6b487e/` altında. Projenin geçici konteyner, volume ve image'ları kaldırıldı. Bu sonuç aşağıdaki gerçek GitHub/staging satırlarını tamamlamaz.

IDE'de açık `.ops-test/core-ops-test-*/backend.env`, yerel Docker testinin **sahte anahtar** dosyasıdır. Staging yapılandırması olarak kullanılmaz. Bu klasör Git tarafından ignore edilir. Gerçek deploy dosyaları [dağıtım rehberine](README.md) göre hazırlanır; anahtarlar kabul kaydına veya commit'e eklenmez.

## Uygulama sırası

28 Eylül hazırlığı: Compose proje adı artık ortama bağlıdır; production `core-assist-production` adını korur, staging `core-assist-staging` olur. [Staging örneği](.env.staging.example) secret/backup/image yollarını ve cookie kapsamını ayırır. `node --test deploy/compose-config.test.mjs` **3/3 geçti**; GitHub backend job'ına eklendi. Bu yapılandırma kontrolü gerçek staging veya GitHub koşusu değildir. Kurulum için [staging hazırlık adımlarını](README.md#staging-ortamını-hazırlama) izleyin; aynı hostta iki proxy'nin 80/443 portlarını paylaşması mevcut Compose'un kapsamı dışındadır.

1. Yayın adayının tüm gerekli dosyalarını gözden geçirip bir commit oluşturun. Backend/frontend lockfile'ları, generated client, migration'lar, deployment dosyaları, yeni testler ve workflow aynı adaya dahil olmalı; gerçek env/secrets ve `.ops-test` hariç kalmalı. Commit SHA'yı bu kayda yazın.
2. Adayı GitHub'a taşıyın. `main`/`master`/`ci/production-readiness` push veya pull request `Quality` workflow'unu tetikler. Diğer dallara yalnızca push yapmak mevcut workflow'u otomatik tetiklemez. İki job'ın **aynı aday SHA** için yeşil olduğunu doğrulayın, koşu bağlantısını kaydedin. Sonraki kod değişikliği yeni aday ve yeni koşu gerektirir.
3. Ayrı staging DB/Redis volume'leri ve test hesaplarını hazırlayın. `DEPLOYMENT_ENV=staging`, `PADDLE_ENV=sandbox`; gerçek domainlerle HTTPS ve cookie kapsamını yapılandırın. Production müşteri verisini veya aktif dış gönderimlerini staging'e taşımayın.
4. Aynı aday SHA'dan image üretip mevcut dağıtım rehberindeki migration/başlatma sırasını uygulayın. Public readiness ve oturum yolculuğunu doğrulayın.
5. Aşağıdaki sağlayıcı ve rol senaryolarını tamamlayın. Kanıt olarak tarih, aday SHA, anonim test hesabı etiketi, sonuç ve maskelenmiş log/event referansı kaydedin. Cookie, token, kart veya müşteri içeriği kaydetmeyin.
6. Hedef VDS yük ölçümü, off-site restore ve geri dönüş provasından sonra yayın kararını verin. Yerel Docker performansı hedef VDS kapasite kanıtı değildir.

## Sonuçlar

| Grup | Durum | Kaydedilecek kanıt |
| --- | --- | --- |
| GitHub CI | 262252c için geçti | [Backend](https://github.com/yusabozkus/core-assist/actions/runs/36354084467/job/108718206652), [frontend](https://github.com/yusabozkus/core-assist/actions/runs/36354084467/job/108718206825); sonraki kod adayı yeniden doğrulanmalı |
| HTTPS, migration, restart | Bekliyor | Image digest, migration sonucu, readiness/restart zamanı |
| OAuth / SSR / logout / revoke | Bekliyor | Google/Microsoft giriş; yenileme, mağaza seçimi ve çıkış sonrası erişim reddi |
| Rol / tenant / ekip / destek | Bekliyor | OWNER, hesap yöneticisi, temsilci, VIEWER ve yabancı hesap read/write matrisi; davet/koltuk sınırı |
| Katalog / soru / taslak / cevap | Bekliyor | Yetkili test mağazası; duplicate, timeout, kota, belirsiz teslimat ve SAFE_AUTO sonuçları |
| Paddle | Bekliyor | Sandbox ilk ödeme/3DS, yenileme reddi/başarısı, geciken webhook, plan/iptal/refund ve hesap kapatma |
| E-posta / duyuru / webhook | Bekliyor | Kontrollü test alıcıları; rol seçimi, mail switch, duplicate/bounce/complaint ve teslimat |
| Bildirim / push | Bekliyor | Gerçek tarayıcı izni/aboneliği, quiet hours, SSE reconnect ve tercih davranışı |
| AI kalite | Bekliyor | Gerçekçi Türkçe soru seti, bilinmeyen bilgi, stok değişimi ve prompt injection değerlendirmesi |
| VDS yük ve kesinti | Bekliyor | 20 mağaza/20.000 ürün, varyant ve sync yükü; p95, kuyruk bekleme, CPU/RAM/disk ölçümleri |
| Off-site restore / rollback | Bekliyor | Uzaktan indirilen yedek, ayrı DB doğrulaması, anahtar geri kazanımı ve dış teslimat uzlaştırması |

## Ayrıntılı kabul ölçütleri

Bu senaryolar önce ayrı test hesapları ve sandbox sağlayıcılarıyla uygulanır. Sonuç tablosundaki grup ancak ilgili ölçütler aynı yayın adayı için kanıtlandığında tamamlandı olarak işaretlenir.

| Test grubu | Senaryo | Geçme koşulu |
| --- | --- | --- |
| Temiz kurulum | Lockfile ile kurulum, codegen, lint, unit/integration testleri ve iki production build | Bütün komutlar exit 0; tekrar edilen entegrasyon testlerinde kapanış hatası yok |
| Image ve migration | Hedef Linux image, boş ve eski sürüm verisiyle migration, tekrar çalıştırma ve restart | Servisler hazır; migration tekrarında güvenli; kullanıcı verisi korunuyor |
| Giriş | Google/Microsoft, logout, session revoke, web/API subdomainleri arasında SSR yenilemesi | Giriş döngüsü yok; iptal edilen oturum veri alamıyor |
| Yetki | OWNER, ACCOUNT_ADMIN, temsilci, VIEWER, platform admin ve yabancı hesap; farklı URL kimlikleri | Her rol yalnızca izinli okuma/yazma yapabiliyor; başka hesaba erişim yok |
| Ekip | Davet rolü, e-posta, süre aşımı, revoke, eşzamanlı kabul ve koltuk sınırı | Kişi/mağaza/rol doğru; limitler korunuyor; token loglanmıyor |
| Mağaza ve kanal | Oluşturma, credential hatası/yenileme, kaldırma, arşiv/restore, aktif işte silme | Yetki ve limit korunuyor; sahipsiz kayıt veya takılı iş kalmıyor |
| Katalog | 20 mağaza/20.000 ürün ve varyantla full sync ve sonraki stok sync | Ürün/varyant kimlikleri tekilleşiyor; kapasite ve stok doğru |
| Soru alma | Duplicate, işleme hatası, bozuk sağlayıcı kaydı ve sayfalama | Soru kaybolmuyor veya çoğalmıyor; hatalı kayıt diğerlerini engellemiyor |
| AI taslak | Paralel manuel/otomatik üretim, son kota hakkı, provider 429/timeout, stok değişimi ve eksik bilgi | Dış çağrılar sınırlı; kota doğru; güvensiz taslak otomatik gönderilmiyor |
| AI kalite | Türkçe beden/renk/stok soruları, bilinmeyen bilgi ve prompt injection | Uydurulan bilgi otomatik gönderilmiyor; değerlendirme sonuçları kaydediliyor |
| Cevap teslimatı | Manuel ve SAFE_AUTO, ağ yanıtı kaybı, DB commit hatası, DB–Redis arası kapanma | Belirsiz gönderim kontrollü; mükerrer cevap veya sonsuz kuyruk yok |
| Paddle ilk ödeme | Başarılı/başarısız/3DS, terk edilen checkout ve yeniden deneme | Yanlış hesap/plan erişimi veya mükerrer ücret yok |
| Paddle dönem geçişi | Başarılı/reddedilen yenileme, geciken/tekrarlanan/sırasız webhook, reconciliation | Erişim ve kota doğrulanmış duruma göre; grace sınırsız uzamıyor |
| Paddle plan ve iptal | Upgrade/downgrade, limit, yıllık planın aylık kotası, iptal/pause/refund | Plan sınırları doğru; mükerrer checkout/ücret yok |
| E-posta ve duyuru | Roller, mail anahtarı, önizleme sonrası alıcı değişimi, çift onay | Doğru alıcı; kişi başına tek teslimat; işlem geri alma güvenli |
| Resend webhook | Geçersiz imza, erken/duplicate/sırasız olay, bounce/complaint, timeout/retry | Teslimat durumu doğru; hassas içerik tutulmuyor; belirsiz sonuç kör tekrarlanmıyor |
| Bildirim ve push | Tercihler, sessiz saatler, SSE reconnect, özel push hedefi ve timeout | Tercihler uygulanıyor; tenant sızıntısı veya yasak hedefe çıkış yok |
| Destek ve admin | Dahili not görünürlüğü, yabancı ticket ID'si, müşteri/e-posta filtreleri | İç not veya başka hesabın kaydı müşteriye görünmüyor |
| Hesap kapatma | Aktif ödeme, bekleyen plan değişimi, Paddle timeout ve geç webhook | Doğrulanmadan silinmiyor; silinen hesap yeniden canlanmıyor |
| Kesinti | Redis/DB restart, SIGTERM ve worker ortasında kapanma | Readiness doğru; işler toparlanıyor; teslimat kaybı görünür |
| Geri yükleme | Sunucu dışı yedekten ayrı ortam, sır ve anahtar geri kazanımı | DB, üyelik/abonelik ve şifreli bağlantılar kullanılabiliyor |

Hedef yük varsayımı **10 müşteri, 20 mağaza, 20.000 ürün ve ayda 30.000 soru**. Yalnızca aylık soru ortalaması veya container bellek sınırlarıyla VDS kapasitesi kararı verilmez. İlk/yenilenen katalog ve stok senkronizasyonları sırasında API p95, kuyruk bekleme süresi, PostgreSQL sorgu/bağlantı sayısı, CPU/RAM, Redis belleği ve disk büyümesi ölçülür. Ölçüm yalnızca izole test verisiyle yapılır.

## Açık hazırlık ve ürün işleri

- [ ] Güncel yayın adayının GitHub Quality backend/frontend işlerini aynı commit için doğrula ve bunları required check yap. Önceki başarılı koşu yalnızca yukarıdaki commit'i kapsar.
- [ ] DNS/TLS, OAuth callback ve webhook originlerini gerçek HTTPS ortamında doğrula; mevcut şifreleme anahtarlarını güvenle taşı ve migration öncesinde yedek al. Domain/cookie ayarlarının tek kaynağı [dağıtım rehberidir](README.md#ilk-hazırlık).
- [ ] Proxy topolojisine göre `TRUST_PROXY_HOPS`, SSE buffering/timeout, public frontend build değerleri ve kanal connector ortamlarını doğrula. Admin allowlist'i, log rotasyonu, uptime/kuyruk/disk alarmlarını gerçek ortamda kontrol et.
- [ ] Günlük off-site yedeği kur, uzaktan indirip ayrı DB'ye restore et; disk ve son başarılı yedek alarmlarını doğrula. Hedef VDS üzerinde yük ve restart ölçümünü kaydet.
- [ ] Paddle ürün/fiyat adlarını `Core Asistan Starter`, `Core Asistan Growth`, `Core Asistan Business` olarak; Google OAuth ve Microsoft Entra uygulama adlarını `Core Asistan` olarak ayarla. Production callback adreslerini ekle.
- [ ] Resend'de `coreasistan.com` gönderici domainini doğrula, gönderici adını `Core Asistan` yap, teslimat webhook'unu kur ve backend'de `RESEND_WEBHOOK_SECRET` tanımla. [Webhook kurulum adımları](../backend/docs/admin-emails.md).
- [ ] `seed:demo` tarafından oluşturulan `DEMO_AI_BATCH` kullanım olaylarının `BillingUsagePeriod` tarih aralığına uymasını sağla; aksi halde tarih bazlı AI grafiği ve dönem kotası karşılaştırması yanıltıcı olabilir.
- [ ] Demo Paddle kimliklerini yalnızca arayüz/sorgu testi say; checkout, yenileme ve reconciliation işlemlerini gerçek Paddle sandbox kayıtlarıyla ayrıca doğrula.

## Yerelde temiz Linux CI kontrolü

```sh
node deploy/test-quality.mjs
```

Bu komut yalnızca açıkça listelenen kaynak/config dosyalarını `.ops-test/core-quality-test-<rastgele>` içine kopyalar. Gerçek `.env`, secrets, yerel node_modules ve build çıktıları taşınmaz. Node 22 üzerinde temiz `npm ci`, üretim audit'i, codegen, lint, unit/integration ve frontend build çalışır. PostgreSQL/Redis host portu yayınlamaz; backend bu geçici servislerin ağ alanında localhost'a bağlanır, testlerin localhost koruması korunur. Yalnızca oluşturulan projenin konteyner/volume/image'ları sonunda kaldırılır; loglar kalır.

Bu kontrol GitHub Actions yürütücüsünü, dal korumasını veya gerçek staging'i doğrulamaz. Başarısızlıkta log yolu ve hata döner; başarılı sonuç GitHub workflow URL'si yerine kullanılamaz.
