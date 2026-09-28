# Bağımlılık güvenliği — 27 Eylül 2026

Backend taraması başlangıçta **6 high + 1 moderate** etkilenmiş paket gösterdi. Bunlar bağımlılık grafiğindeki paket sayılarıdır; yedi ayrı erişilebilir uygulama açığı anlamına gelmez. Hedefli güncellemeden sonra hem `npm audit --omit=dev --json` hem `npm audit --json` **0 bulgu / exit 0** verdi.

## Uygulanan sürümler ve erişim değerlendirmesi

| Zincir | Değişiklik | Projedeki kullanım |
| --- | --- | --- |
| Nest → Multer | `@nestjs/common`, `core`, `platform-express`: 11.2.3 → **11.2.6**; Multer 2.2.0 → **2.4.0** | HTTP framework runtime'da. Kaynakta Multer/file interceptor kullanan yükleme rotası bulunmadı; yine de framework'ün düzeltilmiş bağımlılığı alındı. |
| Express/body-parser → qs | 6.15.3 → **6.16.0**; mevcut semver aralığında lockfile güncellemesi | HTTP ayrıştırma zincirinde. Yeni doğrudan dependency veya override eklenmedi. |
| Prisma → @prisma/config → deepmerge-ts | 7.1.5 → **8.0.2**; yalnızca `@prisma/config@7.10.0` için override | CLI yerel `prisma.config.ts` yüklerken kullanılıyor. Config schema/datasource içeren düz bir nesne; müşteri isteği veya Map tabanlı config birleştirmesi yok. |
| Prisma → mysql2 | 3.15.3 → **3.24.4**; yalnızca `prisma@7.10.0` için override | Uygulama ve Better Auth PostgreSQL/Prisma kullanıyor. MySQL bağlantısı açılmıyor. Better Auth'un uyumlu opsiyonel peer bağımlılığı da aynı güncel kopyaya çözülüyor. |

Multer düzeltmeleri ve yeni bağımlılık sürümü [Nest 11.2.6 sürümünde](https://github.com/nestjs/nest/releases/tag/v11.2.6) yer alıyor; ilgili [multipart güvenlik duyurusu](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm) incelendi. qs için [isBuffer kaynaklı DoS duyurusu](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), MySQL için [sıkıştırılmış protokol duyurusu](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3) değerlendirildi.

## Prisma override gerekçesi ve bakım

Prisma CLI, Client ve PostgreSQL adapter zaten lockfile'da **7.10.0** idi; bu sürümler package.json'da da aynı tam sürüme sabitlendi. Prisma major sürümü veya veritabanı şeması değiştirilmedi. CLI production image'ında migration servisi için gerekli olduğundan yalnızca audit görünümünü değiştirmek amacıyla devDependencies'e taşınmadı.

Prisma 7.10.0'ın config/MySQL bağımlılıkları eski sürümlere sabitlenmişti. Dar kapsamlı iki override yalnızca bu sürüm için geçerlidir. `deepmerge-ts` 8 bir major geçişidir: [resmi sürüm notları](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) Map birleştirme ve tip değişikliklerini açıklar. Projenin düz config nesnesinde bu farklılıklar kullanılmıyor; yine de uyum aşağıdaki gerçek CLI ve veritabanı kontrolleriyle doğrulandı. Bu, bütün Prisma Studio/MySQL senaryolarının test edildiği anlamına gelmez.

Prisma güncellenirken CLI/Client/adapter birlikte değerlendirilmeli. Yeni sürüm bu güvenli alt bağımlılıkları kendisi getiriyorsa override'lar kaldırılmalı; eski sürüme özel override'ın yeni sürüme otomatik uygulanacağı varsayılmamalı. Her değişiklikte lockfile, audit, codegen, migration ve integration sonuçları yeniden kontrol edilmeli.

## Doğrulama

- Gerçek `prisma.config.ts` yüklenerek çözümlenen schema yolu ve PostgreSQL datasource korundu; `prisma validate` ve `db:generate` geçti. Döngüsel nesne birleştirmesi yeni deepmerge sürümünde stack exhaustion üretmedi.
- Backend `check`: genel lint sıfır hata/uyarı, **140/140 unit test**, Nest build başarılı.
- İzole PostgreSQL/Redis ile **55/55 integration testi**; tüm migration zinciri yeni test DB'lerine uygulandı. Auth/tenant, billing, e-posta, soru teslimatı, AI ve kuyruk kontrolleri geçti. Uygulama DB'sine migration uygulanmadı.
- Node 22 Linux Docker build'inde hem tam `npm ci` hem runtime `npm ci --omit=dev`, Prisma generate ve Nest build başarılı; her iki kurulumda audit 0 bulgu.
- Güncellenen backend ile izole production Compose kabulü geçti: migration/bootstrap, PostgreSQL/Redis readiness kesinti-toparlanma, Redis AOF kalıcılığı, Caddy erişim/hata log redaksiyonu, şifreli backup/ayrı DB'ye restore. Gerçek backend SIGTERM yaklaşık 1,8 saniyede exit 0 verdi; aktif BullMQ işi ve HTTP yazısı SSE kapanışıyla birlikte provider disconnect öncesinde tamamlandı. Test Compose projesi ve ayrıca açılan PostgreSQL/Redis test konteynerleri temizlendi.

[Quality workflow](../../.github/workflows/quality.yml) backend ve frontend için `npm audit --omit=dev` de çalıştırır. Güncel üretim bağımlılık bulgusu veya registry hatası bu kontrolü başarısız kılar; test/build adımları ayrıca korunur. İlk başarılı uzak koşu ve doğrulanan commit [staging kabul kaydında](../../deploy/STAGING_ACCEPTANCE.md) yer alır; sonraki aday ayrıca doğrulanmalıdır.

Frontend production audit'i 6. adımda 0 bulgu vermişti; geliştirme bağımlılıkları dahil frontend taramasındaki 1 moderate bu backend güncellemesinin kapsamı değildir. Sıfır audit sonucu bütün uygulamanın güvenli olduğu garantisi değildir; [staging kabul kaydı](../../deploy/STAGING_ACCEPTANCE.md) ayrıca tamamlanmalı.
