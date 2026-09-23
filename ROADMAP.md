## Güncel açık doğrulama işleri

- [ ] `seed:demo` tarafından oluşturulan `DEMO_AI_BATCH` kullanım olaylarının
  `BillingUsagePeriod` tarih aralığında kalmasını sağla. Mevcut dağıtımda bazı
  güncel ve önceki dönem olayları bağlı oldukları dönemin dışına taşabildiği
  için tarih bazlı AI grafikleri ile dönem kotası karşılaştırması yanıltıcı
  olabiliyor.
- [ ] Demo Paddle kimliklerinin yalnızca arayüz ve sorgu testi sağladığını
  açıkça koru; checkout, yenileme ve reconciliation senaryolarını gerçek Paddle
  sandbox kayıtlarıyla ayrıca doğrula.

---

Evet. **Next.js + NestJS + PostgreSQL + Prisma** bu proje için gayet doğru bir stack. Hatta ben olsam başlangıçta çok fazla teknoloji eklemeden tam olarak bununla başlardım.

Küçük bir düzeltme: Prisma veritabanı değil, ORM katmanı. Yapı şöyle olur:

```text
Next.js
   ↓ REST API
NestJS
   ↓
Prisma ORM
   ↓
PostgreSQL
```

Arka planda çalışan işler için daha sonra:

```text
Redis + BullMQ
```

ekleriz.

Bu projede sıralama çok önemli. AI'ı erkenden yaparsanız sonrasında sürekli altyapıyı yeniden yazarsınız. Ben şu sırayla ilerlerdim.

---

# Aşama 0 — Sistemin temel mimarisini belirle

Daha kod yazmadan temel kavramlarımız belli olsun.

Sistemde en önemli entity:

```text
User
  ↓
Organization / Workspace
  ↓
Store
  ├── Trendyol
  ├── Hepsiburada
  ├── WhatsApp
  └── Instagram
```

Buradaki kritik nokta şu:

**User doğrudan ürünün sahibi olmamalı. Store ürünün sahibi olmalı.**

Örneğin Yiğit:

```text
Yiğit
 │
 └── Workspace
      │
      ├── Store: TshirtLab
      │    ├── Trendyol
      │    └── Instagram
      │
      └── Store: SneakerLab
           ├── Hepsiburada
           └── WhatsApp
```

Böylece SaaS baştan multi-tenant olur.

---

# Aşama 1 — Authentication + Multi Tenant altyapısı

İlk kodlayacağınız şey AI değil.

### Backend

NestJS tarafında:

```text
AuthModule
UsersModule
WorkspacesModule
StoresModule
MembersModule
```

oluşturun.

Temel tablolar:

```text
User

Workspace
- id
- name
- ownerId

WorkspaceMember
- workspaceId
- userId
- role

Store
- id
- workspaceId
- name
- timezone
- status
- createdAt

StoreMember
- storeId
- userId
- role
```

Roller ileride:

```text
OWNER
ADMIN
AGENT
VIEWER
```

olabilir.

Her backend sorgusunda:

```ts
storeId;
workspaceId;
```

kontrolü yapılmalı.

Bir kullanıcının URL'yi değiştirerek başka mağazanın datasına ulaşması kesinlikle mümkün olmamalı.

### Frontend

Next.js:

```text
/login

/onboarding

/app
/app/stores
/app/stores/:storeId
```

İlk onboarding:

```text
Hesap oluştur
     ↓
Workspace oluştur
     ↓
İlk mağazayı oluştur
     ↓
Platform bağla
```

### Bu aşamanın bitiş kriteri

Kullanıcı:

- giriş yapabiliyor
- workspace oluşturabiliyor
- mağaza oluşturabiliyor
- mağazalar arasında geçebiliyor

AI hâlâ yok.

---

# Aşama 2 — Channel Integration sistemi

Burada önemli bir tasarım kararı var.

Trendyol için ayrı ayrı her yerde Trendyol kodu yazmayın.

Bir **Channel Adapter Architecture** oluşturun.

Örneğin:

```ts
interface CommerceChannel {
  connect(): Promise<void>;

  getProducts(): Promise<ExternalProduct[]>;

  getProduct(id: string): Promise<ExternalProduct>;

  getOrders(): Promise<ExternalOrder[]>;

  sendMessage(...): Promise<void>;
}
```

Sonra:

```text
CommerceChannel

├── TrendyolAdapter
├── HepsiburadaAdapter
└── ileride AmazonAdapter
```

Mesaj platformlarında:

```text
MessagingChannel

├── WhatsAppAdapter
├── InstagramAdapter
└── ...
```

Backend:

```text
IntegrationsModule
ChannelsModule

integrations/
   trendyol/
   hepsiburada/
   whatsapp/
   instagram/
```

DB:

```text
ChannelConnection

id
storeId
provider
type
status
credentialsEncrypted
connectedAt
processingStartedAt
lastSyncAt
```

`provider`:

```text
TRENDYOL
HEPSIBURADA
WHATSAPP
INSTAGRAM
```

### Frontend

```text
/app/stores/:storeId/integrations
```

Kartlar:

```text
Trendyol
Connected ✓

Hepsiburada
Connect

WhatsApp
Connect

Instagram
Connect
```

### Çok önemli

MVP'de dört entegrasyonu aynı anda yapmayın.

İlk olarak **tek platformu uçtan uca bitirin**.

Örneğin:

```text
Trendyol
```

çalışsın.

Sonra aynı adapter mimarisine Hepsiburada ekleyin.

---

# Aşama 3 — Product Catalog Normalizer

Bu projenin AI'dan bile daha önemli parçalarından biri.

Problem:

Trendyol şöyle veri gönderir:

```json
{
  "stockCode": "...",
  "productMainId": "...",
  "attributes": [...]
}
```

Hepsiburada tamamen başka bir format gönderir.

AI bunlarla uğraşmamalı.

Araya:

```text
Platform API
     ↓
Adapter
     ↓
Normalizer
     ↓
Internal Product Schema
```

koymalısınız.

Örneğin ortak model:

```text
Product

id
storeId
title
description
brand
category
slug
currency
status
createdAt
updatedAt
```

Ancak fiyat ve stok konusunda önemli detay:

### ProductVariant

```text
Product
    ↓
Variant

Variant:
- id
- productId
- sku
- barcode
- color
- size
- price
- stock
```

Çünkü:

```text
Basic T-Shirt
 ├── Red / S
 ├── Red / M
 ├── Red / L
 ├── Black / S
 └── Black / M
```

şeklinde olmalı.

Ayrıca:

```text
ProductImage
ProductAttribute
```

tabloları.

Ve mutlaka:

```text
ExternalProductReference

id
productId
channelConnectionId
externalProductId
externalVariantId
```

Bunun sayesinde:

```text
Trendyol Product #ABC123
       ↓
SaaS Product #987
```

eşleştirmesi yapılır.

---

# Aşama 4 — Product Sync Engine

Şimdi ürünler otomatik gelmeye başlayabilir.

Akış:

```text
Trendyol
   ↓
Fetch Products
   ↓
Normalize
   ↓
Upsert Product
   ↓
Upsert Variants
   ↓
Update stock/price
```

Burada direkt HTTP request içinde 10.000 ürün sync etmeyin.

Burada artık:

```text
Redis
+
BullMQ
```

eklenmesini öneririm.

NestJS:

```text
ProductSyncModule

ProductSyncService
ProductSyncProcessor
ProductNormalizer
```

Queue:

```text
product-sync
```

Job:

```text
SYNC_STORE_PRODUCTS
```

Örneğin:

```json
{
  "storeId": "store_123",
  "channelConnectionId": "conn_123"
}
```

### Sync stratejisi

İlk bağlantıda:

```text
FULL SYNC
```

Sonrasında:

```text
INCREMENTAL SYNC
```

Mümkünse webhook:

```text
Price Changed
Stock Changed
Product Updated
```

Webhook yoksa:

```text
5 dakikada
15 dakikada
30 dakikada
```

polling.

---

# Çok önemli bir mimari kararı

Şunu yapmayın:

```text
Stock → Vector DB → AI
```

Çünkü embedding içinde:

```text
stok: 17
```

yazarsınız, beş dakika sonra stok 0 olur.

AI hâlâ 17 diyebilir.

Dinamik datalar:

```text
stok
fiyat
sipariş
kampanya
variant
```

**doğrudan database/API'den okunmalı.**

RAG daha çok:

```text
iade politikası
kargo açıklaması
SSS
marka bilgileri
ürün açıklamaları
```

gibi içeriklerde kullanılmalı.

---

# Aşama 5 — Incoming Message Infrastructure

Şimdi mesajları kabul etmeye başlayabiliriz.

Ama yine AI yok.

Pipeline:

```text
Webhook
   ↓
Webhook Verification
   ↓
Event Normalizer
   ↓
Duplicate Check
   ↓
Historical Check
   ↓
Event Filter
   ↓
Queue
```

Örneğin:

```text
POST /webhooks/trendyol
POST /webhooks/whatsapp
POST /webhooks/instagram
```

Ama webhook geldiği anda LLM çağırmayın.

Yanlış:

```text
Webhook
 ↓
Gemini
 ↓
10 saniye
 ↓
response
```

Doğrusu:

```text
Webhook
 ↓
Verify
 ↓
Persist
 ↓
Queue
 ↓
200 OK
```

Worker daha sonra işler.

---

# Aşama 6 — Idempotency + Historical Protection

Bunu özellikle ayrı aşama yapardım.

DB:

```text
IncomingEvent

id
channelConnectionId
externalEventId
eventType
externalCreatedAt
receivedAt
processingStatus
payload
```

Unique constraint:

```text
channelConnectionId
+
externalEventId
```

Örneğin:

```text
WhatsApp event:
wamid.123456
```

ilk geliş:

```text
INSERT
```

ikinci geliş:

```text
unique constraint
→ IGNORE
```

Historical koruma için:

ChannelConnection:

```text
processingStartedAt
```

Mesaj:

```text
externalCreatedAt < processingStartedAt
```

ise:

```text
IGNORE
```

Böylece kullanıcı sistemi bağladığında geçmiş 500 mesaja cevap gitmez.

---

# Aşama 7 — Message Filter

Şimdi gelen eventleri temizle.

Ortak internal event formatı oluştur:

```ts
type NormalizedMessage = {
  externalMessageId: string;
  channel: Channel;
  senderId: string;
  text: string;
  createdAt: Date;
  direction: "INBOUND" | "OUTBOUND";
  messageType: "TEXT" | "IMAGE" | "SYSTEM";
};
```

Platformdan ne gelirse gelsin sistemin geri kalanı sadece bunu görsün.

Filtre:

```text
Is new?
↓
Is inbound?
↓
Is actual customer message?
↓
Is not system event?
↓
Is not duplicate?
↓
PROCESS
```

Örneğin WhatsApp:

```text
status update → IGNORE
read receipt → IGNORE
delivery receipt → IGNORE
group message → IGNORE
```

Instagram:

```text
story like → IGNORE
follow → IGNORE
story notification → IGNORE
```

---

# Aşama 8 — Conversation sistemi

Artık Inbox yapılabilir.

DB:

```text
Customer

id
storeId
externalCustomerId
name
phone
username
```

```text
Conversation

id
storeId
customerId
channelConnectionId
status
assignedTo
summary
lastMessageAt
```

```text
Message

id
conversationId
externalMessageId
direction
senderType
content
createdAt
```

`senderType`:

```text
CUSTOMER
AI
HUMAN
SYSTEM
```

Frontend:

```text
/app/stores/:storeId/inbox
```

Görünüm:

```text
┌────────────┬─────────────────────┐
│ Customers  │ Conversation        │
│            │                     │
│ Ahmet      │ Bu ürün XL var mı?  │
│ Mehmet     │                     │
│ Ayşe       │                     │
└────────────┴─────────────────────┘
```

Bu aşamada kullanıcı manuel cevap verebilmeli.

AI hâlâ zorunlu değil.

Bu özellikle önemli.

**AI kapalıyken bile SaaS çalışmalı.**

---

# Aşama 9 — Store Knowledge Base

Şimdi AI'ın bilgisini oluşturuyoruz.

Store:

```text
StoreKnowledge

shippingPolicy
returnPolicy
exchangePolicy
warrantyPolicy
faq
brandDescription
```

Ayrıca:

```text
StoreAISettings

tone
language
emojiUsage
responseLength
autoReplyEnabled
```

Örneğin tone:

```text
Professional
Friendly
Warm
Minimal
Casual
```

Ve:

```text
AIInstruction

id
storeId
type
content
priority
```

Örneğin:

```text
"Rakip markaların ismini söyleme."

"Kesin teslimat tarihi verme."

"Ürün stoğu yoksa alternatif öner."

"Emoji kullanma."
```

Frontend:

```text
/app/stores/:storeId/ai
/app/stores/:storeId/knowledge
```

---

# Aşama 10 — Intent Router

Şimdi ilk AI gelir.

Ama cevap üretmek için değil.

Pipeline:

```text
Customer Message
       ↓
Classifier
       ↓
Structured JSON
```

Örneğin:

```json
{
  "intent": "stock_question",
  "confidence": 0.97,
  "productLookup": true,
  "orderLookup": false,
  "humanReview": false
}
```

Intent enum:

```text
GREETING

PRODUCT_INFO
PRICE
STOCK
SIZE
COLOR

SHIPPING
DELIVERY

RETURN
EXCHANGE

ORDER
CANCELLATION

COMPLAINT

CAMPAIGN

THANKS

OTHER
```

Ama burada önemli bir optimizasyon var.

Her şeyi AI'a sormayın.

Örneğin:

```text
"teşekkürler"
"sağol"
"merhaba"
```

bazı intentler rule based bile çözülebilir.

Pipeline:

```text
Rule Engine
   ↓ unresolved
Small Classifier Model
```

Bu maliyeti düşürür.

---

# Aşama 11 — Product Resolution

Burası sisteminizin en zor parçalarından biri olacak.

Müşteri:

> Bunun siyahı var mı?

diyor.

AI'a "hangi ürün?" sorunu çıkıyor.

Bağlam:

```text
Conversation
    ↓
Linked Product
```

Trendyol ürün sorusunda zaten product ID geliyor olabilir.

Ama Instagram'da:

> Dün attığınız gömleğin XL'ı var mı?

gibi şeyler gelecek.

Bu nedenle:

```text
ProductResolverService
```

oluşturun.

Sonuç:

```json
{
  "productId": "prod_123",
  "confidence": 0.94
}
```

Sonra gerçek stok:

```text
ProductVariant
WHERE
productId = prod_123
AND
color = black
```

---

# Aşama 12 — AI Tool System

Bence en kritik AI mimarisi burası.

LLM'e bütün database'i prompt olarak vermeyin.

Modelin kullanabileceği tool'lar olsun:

```text
search_products
get_product
get_variant_stock
get_product_price
get_shipping_policy
get_return_policy
get_order
```

Örneğin müşteri:

> Kırmızı XL var mı?

LLM:

```text
search_products(...)
        ↓
get_variant_stock(
  productId,
  color="red",
  size="XL"
)
```

Tool sonucu:

```json
{
  "stock": 7
}
```

Sonra model cevap:

> Evet, kırmızı XL şu anda stokta mevcut. 😊

Böylece model:

**stok uyduramaz.**

---

# Aşama 13 — Response Generator

Şimdi ana AI modelini ekleyebilirsiniz.

Girdiler:

```text
System instructions

+

Store settings

+

Conversation summary

+

Recent messages

+

Tool results

+

Customer message
```

Örneğin:

```text
Conversation Summary

Customer is interested in Product #245.
Previously asked about black XL.
```

Recent:

```text
son 6-10 mesaj
```

Bütün 100 mesajı göndermiyoruz.

---

# Aşama 14 — Conversation Memory

Konuşma büyüdüğünde:

```text
Message 1
Message 2
...
Message 50
```

LLM'e:

```text
50 mesaj
```

yerine:

```text
Conversation Summary
+
last 8 messages
```

gönder.

Periyodik:

```text
ConversationMemoryProcessor
```

çalışabilir.

Örneğin:

```text
Every 20 messages
→ summary update
```

DB:

```text
Conversation.summary
Conversation.summaryUpdatedAt
```

---

# Aşama 15 — Safety / Human Escalation Engine

Bu kısmı LLM promptuna bırakmayın.

Ayrı sistem olsun.

Örneğin:

```text
Response drafted
       ↓
Safety Engine
       ↓
Risk Score
```

Kurallar:

```text
refund dispute
legal threat
fraud allegation
high anger
damaged product
payment problem
low confidence
unknown product
missing information
```

ise:

```text
NEEDS_REVIEW
```

Conversation:

```text
OPEN
AI_HANDLING
WAITING_HUMAN
HUMAN_HANDLING
RESOLVED
```

Frontend Inbox'ta:

```text
⚠ Human attention required
```

görünsün.

---

# Çok önemli: AI confidence tek başına yeterli değil

Model:

```json
{
  "confidence": 0.99
}
```

diyebilir ama saçmalıyor olabilir.

Bu nedenle karar:

```text
Model confidence
+
Tool results
+
Business rules
+
Intent risk
```

üzerinden verilmelidir.

Örneğin:

```text
Greeting
risk = 0

Stock question + DB result
risk = low

Refund complaint
risk = high

Legal threat
risk = critical
```

---

# Aşama 16 — Auto Send sistemi

Şimdiye kadar cevap oluşturuyorduk.

Artık göndermeye başlayabiliriz.

```text
AI Draft
 ↓
Policy Check
 ↓
Decision
```

Kararlar:

```text
AUTO_SEND

NEEDS_APPROVAL

DO_NOT_REPLY
```

Örneğin:

```text
stock_question + confidence 0.98
→ AUTO_SEND
```

```text
refund_complaint
→ NEEDS_APPROVAL
```

```text
system_notification
→ DO_NOT_REPLY
```

Gönderme de queue üzerinden olsun:

```text
message-outbound
```

Sonra:

```text
WhatsAppAdapter.sendMessage()

TrendyolAdapter.sendAnswer()
```

---

# Aşama 17 — AI Automation Settings

Şimdi frontend'de kullanıcıya kontrol verin.

```text
AI Automation

[x] Enable AI replies
```

Sonra:

```text
Auto reply mode

○ Draft only
○ Auto reply safe messages
○ Auto reply everything possible
```

Daha güzel model:

```text
Greeting        AUTO
Stock           AUTO
Price           AUTO
Size            AUTO
Shipping        AUTO
Return           REVIEW
Complaint        REVIEW
Refund           REVIEW
```

Bu çok güçlü bir özellik olur.

---

# Aşama 18 — Dashboard

Dashboard en sona yakın yapılmalı.

İlk başta dashboard grafiklerine zaman harcamayın.

Sonradan:

```text
Total conversations

AI resolved

Human escalated

Average response time

Messages today

AI response rate

Most asked products

Most common questions
```

Frontend:

```text
/app/stores/:storeId/dashboard
```

---

# Sonunda mimariniz yaklaşık böyle olacak

```text
                     ┌──────────────┐
                     │   Next.js    │
                     │   Frontend   │
                     └──────┬───────┘
                            │
                            │ REST
                            ▼
                     ┌──────────────┐
                     │    NestJS    │
                     │     API      │
                     └──────┬───────┘
                            │
                ┌───────────┼──────────────┐
                │           │              │
                ▼           ▼              ▼
          PostgreSQL      Redis          LLM API
           + Prisma       BullMQ
                │
                │
 ┌──────────────┼──────────────────────────┐
 │              │                          │
 ▼              ▼                          ▼
Products   Conversations               Knowledge
Variants   Messages                    Policies
Orders     Customers                   AI Settings
```

Platform tarafı:

```text
Trendyol ─────┐
Hepsiburada ──┤
Instagram ────┤
WhatsApp ─────┘
      │
      ▼
 Channel Adapters
      │
      ▼
 Event Normalizer
      │
      ▼
      Queue
      │
      ▼
 Message Pipeline
```

AI tarafı:

```text
Incoming Message
      ↓
Filter
      ↓
Dedupe
      ↓
Conversation
      ↓
Intent Router
      ↓
Product Resolver
      ↓
Required Tools
      ↓
Database / Knowledge
      ↓
Response Generator
      ↓
Policy Engine
      ↓
┌──────────────┬────────────────┐
│              │                │
AUTO SEND     REVIEW          IGNORE
│              │
▼              ▼
Channel       Human Inbox
```

---

# NestJS modüllerini ben böyle ayırırdım

```text
src/

auth/
users/

workspaces/
stores/
members/

integrations/
    trendyol/
    hepsiburada/
    whatsapp/
    instagram/

products/
    products.service.ts
    product-normalizer.service.ts

product-sync/

customers/
conversations/
messages/

webhooks/

channels/

ai/
    classifier/
    responder/
    memory/
    tools/
    retrieval/
    guardrails/

knowledge/

automation/

queues/

analytics/
```

Bu yapı ileride büyüyünce çok işinize yarar.

---

# Frontend yapısını da böyle düşün

```text
/app

/dashboard

/inbox
    /[conversationId]

/products
    /[productId]

/integrations

/knowledge

/ai
    /automation
    /instructions
    /tone

/team

/settings
```

Ve mağaza switcher:

```text
┌────────────────────────────┐
│ TshirtLab              ▼   │
├────────────────────────────┤
│ Dashboard                  │
│ Inbox                      │
│ Products                   │
│ Integrations               │
│                            │
│ AI                         │
│ ├ Automation               │
│ ├ Knowledge                │
│ └ Instructions             │
│                            │
│ Settings                   │
└────────────────────────────┘
```

---

# MVP'yi özellikle küçültün

İlk versiyonda:

**Yapın:**

```text
✓ Auth
✓ Workspace
✓ Store
✓ Trendyol connection
✓ Product import
✓ Product sync
✓ Product variants
✓ Incoming question
✓ Message filtering
✓ Conversations
✓ Intent classification
✓ Product lookup
✓ AI response
✓ Human review
✓ Auto send
✓ Simple AI settings
```

**İlk versiyonda yapmayın:**

```text
✗ Trendyol + Hepsiburada + WhatsApp + Instagram aynı anda
✗ Gelişmiş analytics
✗ 20 farklı AI modeli
✗ Karmaşık vector database
✗ Mikroservis
✗ Kafka
✗ Kubernetes
✗ Kendi event bus sisteminiz
```

Bunların hiçbiri başlangıçta gerekmiyor.

---

# Benim önerdiğim teknoloji seti

```text
Frontend
Next.js
TypeScript
Tailwind
shadcn/ui

Backend
NestJS
TypeScript

Database
PostgreSQL

ORM
Prisma

Queue
BullMQ

Queue / Cache
Redis

AI
2 küçük model
- Router / classifier
- Response model

Validation
Zod veya class-validator

API Documentation
OpenAPI / Swagger

Deployment
Başlangıç:
Docker Compose
```

Ve tek repository bile kullanabilirsiniz:

```text
/apps
   /web
   /api

/packages
   /types
   /config
```

veya daha basit:

```text
/frontend
/backend
```

İkinci seçenek MVP için yeterli.

---

# En önemli 5 mimari karar

Bu projeyi sağlam veya sorunlu yapacak şeyler bence bunlar:

**1. Platform-specific datayı içeride kullanmayın.**

```text
Trendyol
→ Adapter
→ Normalized Product
```

olmalı.

**2. LLM'i database olarak kullanmayın.**

```text
"Stok kaç?"
```

sorusunun cevabını LLM bilmemeli.

Tool çağırıp PostgreSQL'den öğrenmeli.

**3. Webhook request içinde AI çalıştırmayın.**

Her şeyi queue üzerinden async worker'a aktarın.

**4. Multi-tenant yapıyı sonradan eklemeyin.**

İlk migration'dan itibaren:

```text
Workspace
Store
storeId
```

mantığı olsun.

**5. AI karar merci değil, sistemin bir parçası olsun.**

Yani:

```text
AI → "Bence bunu gönderebiliriz."
```

değil,

```text
Classifier
+
Business Rules
+
Database
+
Policy Engine
+
AI
=
Decision
```

olsun.

---

## Şu an başlayacağınız gerçek sıra

Ben sizin yerinizde olsam yarın kodlamaya şu sırayla başlarım:

```text
01 Auth
 ↓
02 Workspace
 ↓
03 Store
 ↓
04 Multi tenant authorization
 ↓
05 ChannelConnection
 ↓
06 Trendyol Adapter
 ↓
07 Product schema
 ↓
08 Trendyol product importer
 ↓
09 Product normalizer
 ↓
10 Product sync
 ↓
11 Webhook infrastructure
 ↓
12 Event normalization
 ↓
13 Idempotency
 ↓
14 Historical message protection
 ↓
15 Customer
 ↓
16 Conversation
 ↓
17 Message
 ↓
18 Basic Inbox UI
 ↓
19 Manual reply
 ↓
20 Intent classifier
 ↓
21 Product resolver
 ↓
22 AI tools
 ↓
23 Knowledge base
 ↓
24 AI response generator
 ↓
25 Safety rules
 ↓
26 Human escalation
 ↓
27 Auto send
 ↓
28 Conversation memory
 ↓
29 AI settings
 ↓
30 Analytics
 ↓
31 Hepsiburada
 ↓
32 WhatsApp
 ↓
33 Instagram
```

Bence **bu sıra projenin gerçek development roadmap'i olarak kullanılabilir**. Özellikle ilk 18 maddeyi AI'sız tamamlamak çok sağlıklı olur. Çünkü 18'e geldiğinizde elinizde zaten çalışan bir omnichannel customer-support altyapısının çekirdeği olur; AI yalnızca bunun üzerine akıllı katman olarak oturur.
