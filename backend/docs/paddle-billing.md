# Paddle Billing kurulumu

CoreAssist, ödeme ekranını Paddle.js ile açar; plan ve fiyat seçimini backend
üzerinden doğrular. Abonelik durumu tarayıcıdaki ödeme sonucuna göre değil,
imzası doğrulanmış Paddle webhook olaylarına göre güncellenir.

## 1. Ortam değişkenleri

Sandbox değerlerini `backend/.env` dosyasına ekleyin:

```ini
PADDLE_ENV="sandbox"
PADDLE_API_KEY="pdl_sdbx_apikey_..."
PADDLE_WEBHOOK_SECRET="pdl_ntfset_..."
PADDLE_PRICE_STARTER_MONTHLY="pri_..."
PADDLE_PRICE_STARTER_ANNUAL="pri_..."
PADDLE_PRICE_GROWTH_MONTHLY="pri_..."
PADDLE_PRICE_GROWTH_ANNUAL="pri_..."
PADDLE_PRICE_BUSINESS_MONTHLY="pri_..."
PADDLE_PRICE_BUSINESS_ANNUAL="pri_..."
```

Tarayıcıda kullanılabilen client-side token'ı `frontend/.env.local` dosyasına
ekleyin. API anahtarını kesinlikle frontend'e koymayın.

```ini
NEXT_PUBLIC_PADDLE_ENV="sandbox"
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN="test_..."
```

## 2. Webhook hedefi

Paddle Sandbox panelinde **Developer tools > Notifications > New
destination** yolunu açın. Hedef URL:

```text
https://api.coreasistan.com/billing/webhooks/paddle
```

Yerel backend doğrudan internete açık olmadığı için localhost adresi Paddle
tarafından çağrılamaz. Yerel test için HTTPS tüneli kullanın ve aynı yolu tünel
adresinin sonuna ekleyin.

Şu olayları seçin:

- `subscription.created`
- `subscription.updated`
- `subscription.activated`
- `subscription.trialing`
- `subscription.past_due`
- `subscription.paused`
- `subscription.resumed`
- `subscription.canceled`
- `transaction.completed`
- `transaction.payment_failed`
- `transaction.past_due`

Destination oluşturulduktan sonra gösterilen endpoint secret değerini
`PADDLE_WEBHOOK_SECRET` olarak kaydedin.

## 3. Veritabanı ve uygulama

```bash
cd backend
npm run db:migrate:deploy
npm run start:dev
```

Frontend ortam değişkenleri build sırasında okunduğu için frontend sunucusunu
değişikliklerden sonra yeniden başlatın.

```bash
cd frontend
npm run dev
```

Planlar ekranında bir plan seçip **Ödemeye geç** düğmesine basıldığında Paddle
Sandbox checkout açılmalıdır. Başarılı test ödemesinden sonra abonelik kaydı
webhook ile güncellenir.
