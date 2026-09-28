# Core Asistan backend

NestJS API ve BullMQ worker'ları; PostgreSQL/Prisma, Redis, Trendyol/Hepsiburada, AI taslakları, Paddle ve Resend entegrasyonları.

## Yerel geliştirme

Node 22 ve Docker gerekir. Depo kökünde PostgreSQL/Redis'i başlatın:

```sh
docker compose up -d postgres redis
```

Backend dizininde `.env.example` dosyasını **mevcut dosyanızı ezmeden** `.env` olarak kopyalayın. Yerel Compose için veritabanı adresi `postgresql://postgres:postgrespassword@localhost:5434/core_assist`, Redis adresi `redis://127.0.0.1:6379` olur. Auth originlerini `http://localhost:4001` ve `http://localhost:3001` olarak ayarlayın; gerekli anahtarları ilgili entegrasyon rehberlerine göre doldurun. Örnek dosya tek başına çalışır servis kimlik bilgileri sağlamaz.

```sh
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run start:dev
```

API varsayılan olarak 4001 portunda çalışır. `/health` process canlılığını, `/health/ready` başlangıç/kapanış durumunu ve PostgreSQL/Redis erişimini bildirir. Şema geliştirmek için `db:migrate`; var olan migration'ları uygulamak için `db:migrate:deploy` kullanılır.

## Kontroller

```sh
npm run check
npm run test:integration
```

`check` lint, bütün unit testleri ve production build çalıştırır. Integration testleri localhost PostgreSQL/Redis ister ve rastgele test veritabanları oluşturur. Ortam, hedefli komutlar ve kapsam: [kalite kontrol rehberi](docs/quality-checks.md). Windows PowerShell'de gerekirse `npm.cmd` kullanın.

## Dağıtım ve işletim

Production için [Docker dağıtım rehberi](../deploy/README.md) ve [güncel staging kabul kaydı](../deploy/STAGING_ACCEPTANCE.md) izlenmeli. Worker durdurma, migration ve rollback sırası dağıtım rehberindedir. Yerel Compose production paketi değildir.

- [Paddle billing](docs/paddle-billing.md)
- [Admin e-posta ve webhook](docs/admin-emails.md)
- [Bildirimler](docs/notifications.md)
- [Soru/cevap teslimatının toparlanması](docs/question-delivery-recovery.md)
- [Push, AI ve log korumaları](docs/production-guards.md)
- [Bağımlılık güvenliği ve Prisma override bakımı](docs/dependency-security.md)

Smoke/eval/seed scriptleri gerçek dış servis çağrısı veya veri yazımı yapabilir; genel test komutunun parçası değildir. Çalıştırmadan önce hedef ortamı ve ilgili scripti kontrol edin.
