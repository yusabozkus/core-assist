# Yerel uçtan uca kontrol kaydı

**Tarih:** 28 Eylül 2026 (Europe/Istanbul)

**Sonuç:** 37/37 HTTP ve SSR senaryosu geçti; runner ve ortam temizliği exit 0. Uygulama loglarında `Error`, `Exception`, `digest` veya unhandled hata kaydı görülmedi. Bu sonuç tarayıcı JavaScript/hydration veya gerçek OAuth kabulü değildir.

## Ortam ve tekrar çalıştırma

Kaynak: `ci/production-readiness`, uygulama commit'i `262252c6c4d3d31bc08ea0440fe6fb63eb21c95e` ve bu tur eklenen yerel test dosyaları. Aynı commit'in [GitHub Quality koşusu](https://github.com/yusabozkus/core-assist/actions/runs/36354084467) daha önce backend/frontend için başarılı tamamlandı. Bu yeni E2E paketi henüz GitHub CI'a eklenmedi.

Repo kökünde Docker Desktop açıkken:

```sh
node deploy/test-local-e2e.mjs
```

- Test kendi backend/frontend image'larını mevcut kaynaktan üretir; yerel node_modules veya build çıktısına güvenmez. Docker image/npm indirmeleri build sırasında internet gerektirebilir.
- Rastgele `core-e2e-*` Compose projesi, ayrı PostgreSQL 16 / Redis 7 ve `internal` Docker ağı oluşturur. Çalışan uygulama konteynerlerinin dış servis erişimi yoktur. Gerçek `.env` veya sağlayıcı anahtarları yüklenmez.
- Yalnızca uygulama portları `127.0.0.1:13001` ve `127.0.0.1:14001` üzerinde açılır. Bu portlar boş olmalıdır; mevcut servisler durdurulmaz. DB/Redis host portu açılmaz.
- Migration zinciri boş test DB'sine uygulanır. Demo seed: 12 kullanıcı, 8 müşteri hesabı, 10 mağaza, 568 ürün, 48 soru, 8 destek talebi. Test ayrıca bir admin ve bir VIEWER oluşturur.
- Backend geliştirme ayarları ve mock pazaryeri connector'ları kullanır; frontend gerçek Next standalone build'idir. HTTP localhost için yalnızca geçici frontend Dockerfile'daki HTTPS build kontrolü kaldırılır; production Dockerfile değişmez.
- Test DB'sine sentetik oturumlar eklenir ve uygulamanın gerçek Better Auth cookie imzasıyla HTTP istekleri yapılır. AuthGuard, rol kontrolleri ve servisler değiştirilmez. Bu yöntem **Google/Microsoft girişini test etmez**; giriş sonrası sunucu davranışını test eder.
- Sonunda yalnızca bu rastgele projenin konteyner, volume, ağ ve image'ları kaldırılır. `.ops-test` içindeki loglar ve sentetik ayarlar kalır; Git'e eklenmez. Gerçek geliştirme DB/Redis servisleri değişmez.

Başarılı koşu: `core-e2e-fd76057288`. Yerel kanıtlar: `.ops-test/core-e2e-fd76057288/report.json`, `scenarios.log`, `application.log`, `seed.log`, `cleanup.log`.

## Geçen senaryolar

| Grup | Adet | Kontrol |
| --- | --- | --- |
| Hazırlık ve oturum | 4 | Readiness; oturumsuz API reddi; gerçek Better Auth ile imzalı oturum çözümü; sahte imza reddi |
| Mağaza, katalog, soru ve rol | 7 | Mağaza listesinin DB ile eşleşmesi; yabancı müşteri mağaza/soru erişim reddi; katalog ürünlerinin DB eşleşmesi; soru detayı; VIEWER cevap ve AI taslak reddi |
| Profil | 2 | HTTP güncellemenin DB ve takip eden GET'e yansıması; geçersiz/izinsiz alanların reddi |
| Admin, duyuru ve bildirim | 4 | Müşterinin admin API'sine erişim reddi; saldırgan Origin reddi; OWNER hedefli yayın/tekrar yayında tekillik/alıcı ayrımı/mail kapalıyken mail kaydı oluşmaması/bildirim okundu durumu; mail açık fakat sağlayıcı yokken açık hata |
| Destek | 1 | Müşteri talebi → admin iç not ve yanıt → müşteri yanıtı → çözüm → yeniden açma; iç notun müşteriye ve talebin yabancı hesaba görünmemesi |
| Billing | 1 | Yetkili özet okuma ve yabancı müşteri erişim reddi |
| Public SSR | 3 | `/`, `/login`, `/contact` HTML yanıtları |
| Müşteri SSR | 8 | Dashboard, inbox, ürünler, stok, ekip, profil, bildirim ayarları ve destek; test oturumu ile HTML üretilmesi |
| Admin SSR | 5 | Genel görünüm, müşteriler, duyurular, e-postalar ve destek; admin oturumu ile HTML üretilmesi |
| Erişim ve çıkış | 2 | Oturumsuz dashboard'un login'e yönlenmesi ve özel içeriği göstermemesi; çıkış sonrası aynı cookie ile API erişiminin reddi |
| **Toplam** | **37** | **37 geçti, 0 başarısız** |

Bu turda uygulama hatası bulunmadı; uygulama davranışını değiştiren düzeltme yapılmadı.

## Bekleyen tarayıcı ve sağlayıcı kabulü

Bu oturumda Browser bağlantısı mevcut değildi. Ekranlara tıklanmadı; form/client-side davranışı, React hydration, mobil görünüm, tarayıcının cookie/CORS uygulaması ve Server Action üzerinden mağaza seçimi henüz doğrulanmadı. SSR kontrolleri gerçek Next sunucusunun HTTP HTML yanıtlarıdır; görsel test olarak sayılmaz.

Bir sonraki tarayıcı turu: müşteri/admin giriş yolculuğu, mağaza seçimi, soru filtreleri ve cevap editörü, profil formu, rol seçerek duyuru önizleme/yayınlama, destek formu, çıkış ve geri tuşu davranışı. Dış servisler için ayrıca yetkili test hesaplarıyla OAuth, Paddle sandbox, Resend teslimat/webhook, push ve pazaryerine cevap gönderimi gerekir. Bu pakette gerçek e-posta, ödeme veya pazaryeri cevabı gönderilmez; AI sağlayıcı kalitesi ve VDS yük kapasitesi ölçülmez.
