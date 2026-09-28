# Core Asistan frontend

Next.js App Router üzerinde müşteri paneli, admin paneli ve tanıtım sayfaları. UI bileşenleri React, Tailwind CSS, Radix ve shadcn kullanır.

## Yerel geliştirme

Node 22 kullanın. `.env.example` dosyasını mevcut dosyanızı ezmeden `.env.local` olarak kopyalayın. Backend'i 4001 portunda başlatın; public API adresi yerelde `http://localhost:4001` olur. Paddle sandbox client token'ı checkout denemeleri için ayrıca gerekir.

```sh
npm ci
npm run dev
```

Uygulama `http://localhost:3001` adresinde açılır. Windows PowerShell'de gerekirse `npm.cmd` kullanın.

## Kontroller

```sh
npm run check
```

Lint, `scripts/*.test.mjs` testleri ve Next production build/TypeScript kontrolü çalışır. Yalnızca testler için `npm test`; görsel izin listesi için `npm run test:security`. [Ortak kalite rehberi](../backend/docs/quality-checks.md).

## Server API katmanı

`lib/api/*.server.ts` dosyaları sayfaya özgü response tiplerini, hata sınıflarını ve oturumsuz kullanıcı davranışını taşır. `lib/api/server-fetch.ts` yalnızca GET taşımasını ortaklaştırır: `API_URL` → `NEXT_PUBLIC_API_URL` → localhost adres seçimi, `no-store`, JSON Accept header, istek başına cookie ve timeout. Public davet çağrısı cookie göndermez. React'in mevcut request-scoped cache kullanımı korunur; ortak yardımcı kullanıcı verisini cache'lemez.

`NEXT_PUBLIC_*` değerleri tarayıcı build'ine girer; sır içermemeli. Docker SSR için `API_URL` iç ağ adresi olabilir, public adresin yerini tarayıcıda almaz. Server helper'ı client bileşenlerinden import etmeyin.

## UI bileşenleri

Sınıf birleştirmek için `@/lib/utils` içindeki `cn` kullanılır. Yeni bileşen eklemek için lockfile'daki yerel CLI'ı çalıştırın:

```sh
npm exec -- shadcn add button
```

`shadcn` geliştirme bağımlılığıdır; `app/globals.css` içindeki `shadcn/tailwind.css` importu build sırasında gereklidir. Build aşamasında devDependencies kurulmalıdır. Docker runtime derlenmiş standalone çıktıyı çalıştırır.

Production build arg'ları, SSR adresi, HTTPS ve cookie domain ayarları: [dağıtım rehberi](../deploy/README.md). Gerçek ortam kabul durumu: [staging kabul kaydı](../deploy/STAGING_ACCEPTANCE.md).
