# Staging kabul kaydı

Bu dosya, yerel kontrollerden gerçek ortam kabulüne geçişi takip eder. Senaryo listesi ve geçme koşulları [production incelemesinin 8. bölümündedir](../PRODUCTION_READINESS_AUDIT.md). Aşağıdaki bekleyen satırlar test edilmiş sayılmaz.

## Ortam ve sürüm

| Alan | Mevcut durum |
| --- | --- |
| Kaynak | `yusabozkus/core-assist`; CI adayı dalı `ci/production-readiness`. Tam commit SHA başarılı GitHub koşusuyla birlikte kaydedilmeli |
| GitHub Quality koşusu | İlk uzak koşu bekliyor; workflow bu adaya dahil, aday dalına push ile tetiklenir |
| VDS / web ve API originleri | Henüz doğrulanmadı |
| Deploy yapılandırması | `deploy/.env` ve `deploy/secrets` bu çalışma dizininde yok |
| Yerel Docker kabulü | Önceki adımda migration/readiness/backup-restore/SIGTERM başarılı; public HTTPS ve gerçek sağlayıcı kabulü değildir |

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
| GitHub CI | Bekliyor | Aday SHA ve backend/frontend job URL'leri |
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

## Yerelde temiz Linux CI kontrolü

```sh
node deploy/test-quality.mjs
```

Bu komut yalnızca açıkça listelenen kaynak/config dosyalarını `.ops-test/core-quality-test-<rastgele>` içine kopyalar. Gerçek `.env`, secrets, yerel node_modules ve build çıktıları taşınmaz. Node 22 üzerinde temiz `npm ci`, üretim audit'i, codegen, lint, unit/integration ve frontend build çalışır. PostgreSQL/Redis host portu yayınlamaz; backend bu geçici servislerin ağ alanında localhost'a bağlanır, testlerin localhost koruması korunur. Yalnızca oluşturulan projenin konteyner/volume/image'ları sonunda kaldırılır; loglar kalır.

Bu kontrol GitHub Actions yürütücüsünü, dal korumasını veya gerçek staging'i doğrulamaz. Başarısızlıkta log yolu ve hata döner; başarılı sonuç GitHub workflow URL'si yerine kullanılamaz.
