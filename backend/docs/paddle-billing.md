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
npm run db:generate
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

## 4. Ödeme ile çalışma alanının güvenilir eşleştirilmesi

Backend, kullanıcı yetkisini ve seçilen planı doğruladıktan sonra Paddle
transaction oluşturur. Transaction kimliğini tarayıcıya vermeden önce
`billing_checkout` tablosuna şu bilgileri kaydeder:

- Çalışma alanı ve ödemeyi başlatan kullanıcı.
- Sandbox/production ortamı, beklenen fiyat kimliği, plan ve ödeme dönemi.
- Paddle transaction kimliği; varsa mevcut müşteri ve önceki abonelik kimliği.
- Webhook ile doğrulandığında bağlanan abonelik kimliği ve bağlanma zamanı.

İlk bağlantı, `subscription.created` olayındaki `transaction_id` üzerinden kurulur.
Sonraki olaylar kayıtlı abonelik ve müşteri kimlikleriyle doğrulanır.
`custom_data` yalnızca tanılama amaçlıdır; çalışma alanını veya planı seçmek
için **hiçbir zaman kullanılmaz**. Bu ayrım önemlidir çünkü custom data,
[Paddle.js üzerinden de gönderilebilir](https://developer.paddle.com/build/transactions/custom-data/).
İlk transaction kimliğinin hangi olayda geldiği
[subscription.created belgesinde](https://developer.paddle.com/webhooks/subscriptions/subscription-created/)
açıklanır.

Fiyat kimliği backend yapılandırmasında tanınmalı; ilk bağlantıda kaydedilen
plan ve fiyatla da eşleşmelidir. Abonelik tek kalem, bir adet ve ilgili aylık
veya yıllık yenileme döneminde olmalıdır. Bilinmeyen fiyat veya uyuşmayan
eşleştirme yetki vermez; webhook `409` döner ve olay işlenmiş sayılmaz.
Olaylar ters sırayla gelirse ilk bağlantıyı kuracak olay işlendiğinde diğer
olay yeniden denenebilir. Paddle/Hookdeck üzerindeki başarısız teslimatlar
izlenmelidir; kalıcı fiyat veya müşteri uyuşmazlıkları yeniden denemeyle
düzelmez.

Çalışma alanının veritabanı satırı kilitlenerek eşzamanlı webhook'ların farklı
abonelikleri birbirinin üzerine yazması engellenir. Mevcut abonelik kimliği
yalnızca iptal edilmiş veya süresi dolmuş abonelikten sonra, bu önceki kimliği
kaydeden yeni bir checkout ile değişebilir. Eski checkout tekrar kullanılarak
mevcut bağlantı değiştirilemez.

### Mevcut kurulumlara geçiş

- `20260909203000_add_trusted_billing_checkouts` migration'ını uygulayın,
  Prisma istemcisini üretin ve backend'i yeniden başlatın. Veriler silinmez.
- Zaten kayıtlı Paddle abonelikleri müşteri/abonelik kimlikleri ve tanınan
  fiyatlarıyla çalışmaya devam eder; metadata'dan geriye dönük bağlantı üretilmez.
- Bu güncellemeden **önce açılmış, henüz bağlanmamış** checkout'lar için yeni
  checkout başlatın. Ödeme zaten alınmışsa tekrar ödeme yaptırmayın; ilgili
  transaction ve çalışma alanını yönetici olarak Paddle ve sunucu kayıtlarıyla
  doğrulamadan manuel bağlantı kurmayın.
- Fiyat kimliklerini değiştirirken mevcut aboneliklerin kullandığı fiyatları
  eşleştirmeden kaldırmayın; tanınmayan eski fiyatlar da güvenli biçimde reddedilir.
- Paddle paneline yeni bir metadata alanı veya farklı webhook hedefi eklemek
  gerekmez; yukarıdaki olayların seçili olması yeterlidir.

## 5. Aynı çalışma alanında mükerrer checkout koruması

`20260909210000_serialize_billing_checkouts` migration'ı checkout durumunu ve
çalışma alanı başına tek bekleyen işlem kısıtını ekler. Önce migration'ları
uygulayın, ardından Prisma istemcisini üretip backend'i yeniden başlatın.

- **Eşzamanlı istekler:** Kısa bir PostgreSQL satır kilidi altında rezervasyon
  yapılır. `CREATING` kaydı, Paddle isteğinden **önce** commit edilir. Kısmi unique
  index `CREATING`, `OPEN` ve `REVIEW_REQUIRED` durumlarında aynı çalışma alanı
  için ikinci bir kaydı engeller; koruma birden fazla backend instance'ında da
  geçerlidir. Ağ istekleri veritabanı kilidi tutulmadan yapılır.
- **Yenileme ve tekrar deneme:** Aynı plan/dönem için açık transaction Paddle'dan
  kontrol edilip yeniden kullanılır. Başka sekmede hazırlanıyorsa frontend
  kısa süre bekler ve aynı endpoint'i tekrar sorgular; ikinci create çağrısı
  yapılmaz. Tarayıcı belleği/localStorage güvenlik mekanizması değildir.
- **Ödeme alındı, webhook gecikti:** `paid`/`completed` veya aboneliğe dönüşmüş
  işlem için ikinci form açılmaz; webhook doğrulaması beklenir. Paddle API'den
  ödeme durumunu okumak tek başına plan yetkisi vermez.
- **Farklı plan:** Açık transaction'ın tutarı sessizce değiştirilmez ve başka
  transaction oluşturulmaz. Kullanıcı mevcut ödeme sayfasına yönlendirilir.
  Yeni işlem yalnızca öncekinin Paddle tarafından iptal edildiği doğrulanınca
  açılabilir; pencereyi kapatmak veya zaman geçmesi ödeme iptali sayılmaz.
- **Hata veya timeout:** Paddle isteği açıkça reddettiyse kayıt `FAILED` olur ve
  tekrar denemeye izin verilir. Sonuç belirsizse `REVIEW_REQUIRED` olur; yanıtı
  kaydetmeden süreç çökerse `CREATING` kalabilir. Bu kayıtlar zaman aşımıyla
  silinmez veya başka istek tarafından devralınmaz.

Paddle genel amaçlı istemci idempotency key desteği sunmadığından, timeout
sonrası körlemesine yeni transaction oluşturmak güvenli değildir.
[Paddle SDK tekrar deneme rehberi](https://developer.paddle.com/sdks/libraries/)
mevcut işlemin önce kontrol edilmesini önerir.

### Belirsiz işlemin yönetici tarafından çözümlenmesi

Sunucu logundaki checkout kimliği ve varsa transaction kimliğiyle Paddle
kaydını bulun. `coreassist_checkout_id` yalnızca aramayı kolaylaştırır;
metadata tek başına sahiplik kanıtı değildir. Çalışma alanı, beklenen fiyat,
müşteri, önceki abonelik ve API kayıtlarını birlikte doğrulayın. İşlem varsa
doğru transaction kimliğini aynı rezervasyona bağlayıp ilgili webhook'u yeniden
teslim edin. Yeni ödeme aldırmayın. Ancak işlemin oluşmadığı veya artık
ödenemeyecek şekilde iptal edildiği kesinleştikten sonra rezervasyonu kapatın.

Migration eski verilerde bir çalışma alanı için birden fazla bağlanmamış
checkout bulursa bilinçli olarak durur; olası tahsilatları silmez veya rastgele
birini seçmez. Önce bu işlemleri Paddle kayıtlarıyla uzlaştırın.

## 6. Webhook sıralaması ve abonelik durumu

Abonelik erişiminin tek kaynağı `subscription.*` olaylarıdır. Başarılı ödeme,
başarısız ödeme ve gecikmiş transaction olayları imza kontrolünden sonra
`billing_webhook_event` tablosuna kaydedilip tekrarları engellenir; fakat planı,
abonelik durumunu, dönem tarihlerini veya `paddleUpdatedAt` değerini değiştirmez.
Eski bir fatura ödemesi, tek seferlik tahsilat veya kart güncellemesi bu sayede
duraklatılmış/iptal edilmiş aboneliği aktif yapamaz. Yenileme ve başarısız ödeme
sonrası durum değişimleri `subscription.updated` ve ilgili abonelik olaylarından
alınır. Bu yaklaşım [Paddle erişim yönetimi rehberine](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/)
dayanır.

`paddleUpdatedAt`, son uygulanan **abonelik olayının** `occurred_at` değeridir;
sunucuya geliş zamanı değildir. Abonelik güncellenirken bu alan da aynı işlemde
yazılır. Geçersiz olay tarihine sunucunun güncel tarihi atanmaz; olay reddedilir.

Çalışma alanı, ardından abonelik satırı kilitlenir. Kayıt kilitten sonra yeniden
okunur; abonelik kimliği ve tarih karşılaştırması, durum güncellemesi ve webhook
kaydının commit edilmesi aynı transaction içindedir. Böylece eşzamanlı gelen
eski bir olay yeni durumun üzerine yazamaz. Aynı tarihli çelişen durumlarda daha
kısıtlayıcı olan durum önceliklidir; aynı durum/tarih tekrar uygulanmaz. İptal
edilmiş bir abonelik kimliği tekrar aktifleştirilmez; yeni abonelik için yeni,
doğrulanmış checkout bağlantısı gerekir.

Yerel deneme süresi kontrolü de yalnızca hâlâ Paddle'a bağlanmamış bir denemeyi
koşullu olarak sonlandırır; aynı anda gelen aktivasyon webhook'unu ezmez.
Paddle denemesinin durumu webhook'tan alınır; erişim kontrolü deneme bitiş
tarihini ayrıca kontrol etmeye devam eder.

### Yerel doğrulama

- Başarılı ödeme sonrasında webhook hedefinde özellikle `subscription.created`
  ve `subscription.updated` seçili olmalıdır (yukarıdaki mevcut liste değişmedi).
- `transaction.completed` ilk gelirse ödeme sayfası abonelik olayını bekler.
  Yalnızca transaction olayını yeniden teslim etmek planı aktifleştirmez.
- İlk bağlama olayı gelmeden ulaşan `subscription.updated`, bağlama kurulunca
  tekrar işlenebilir; eşleştirilemeyen olay işlenmiş sayılmaz.
- Hookdeck'ten eski bir `subscription.past_due` olayını daha yeni
  `subscription.updated`/`subscription.activated` sonrasında teslim ettiğinizde
  durum ve dönem tarihleri geri gitmemelidir.
- Duraklatılmış aboneliğe `transaction.completed` teslim edilmesi erişim
  açmamalıdır; yeniden açılma yalnızca daha yeni abonelik olayıyla yapılır.

Bu adım için yeni migration veya yeni Paddle ortam değişkeni gerekmez.

## 7. Başarısız webhook ve yeniden teslim

Tekrar kontrolü yalnızca `billing_webhook_event.id` üzerindeki
`INSERT ... ON CONFLICT ("id") DO NOTHING` ile yapılır. Müşteri, abonelik veya
checkout alanlarındaki unique çakışmaları (`P2002`) tekrar teslim sayılmaz.

- Olay kaydı ve abonelik güncellemesi aynı veritabanı transaction'ındadır.
  Eşleştirme, fiyat doğrulaması veya veritabanı hatasında ikisi de geri alınır.
  Başarısız olay için kalıcı bir “işlendi” kaydı bırakılmaz.
- Eşzamanlı aynı event ID teslimleri veritabanında bekleşir. İlk işlem başarılı
  olursa ikincisi `duplicate: true` alır; ilk işlem geri alınırsa diğeri aynı
  olayı işlemeyi deneyebilir.
- Eşleşmeyen abonelik olayları `409`, geçersiz olay verisi `400`, beklenmeyen
  işlem/veritabanı hataları `503` döner. Hatalar `200` ile onaylanmaz.
- Backend logunda `eventId`, `eventType`, `errorCode` ve unique hatalarında
  `constraintFields` bulunur. Webhook gövdesi, imza, müşteri bilgileri ve ham
  veritabanı hata mesajı bu loga veya hata yanıtına yazılmaz.
- Abonelik durumu için bilinçli olarak kullanılmayan transaction ve diğer olay
  türleri `processed: false, ignored: true` ile onaylanır ve yalnızca teslim
  kaydı tutulur. Bu durum, işlenmesi gereken bir abonelik olayının eşleşmemesi
  ile aynı değildir. Güvenle atlanan eski abonelik olayları da yeniden durum
  değişikliği yapmadan onaylanır.

### Hatalı olayı tekrar işleme

1. Paddle/Hookdeck teslim kaydındaki event ID ile backend logunu eşleştirin.
2. Logdaki hata koduna göre eksik checkout/abonelik bağlantısını veya kimlik
   çakışmasını araştırın. Sadece metadata'ya bakarak bağlantı oluşturmayın ve
   yeni bir ödeme aldırmayın.
3. Sorun giderilince aynı olayı yeniden teslim edin. Başarısız işlem event ID'yi
   tüketmediği için yeni teslim normal şekilde işlenir; başarılı teslimin
   tekrarında yalnızca `duplicate: true` dönmelidir.

Paddle başarısız teslimleri otomatik tekrar dener; denemeler bittiyse panel/API
üzerinden yeniden teslim başlatılabilir. Sandbox tekrar deneme sınırı live'dan
daha düşüktür. [Paddle teslim ve tekrar deneme rehberi](https://developer.paddle.com/webhooks/about/respond-to-webhooks/)

Önceki hatalı sürümün zaten “işlendi” diye kaydettiği olaylar otomatik silinmez.
Böyle bir geçmiş kayıt varsa ilgili olayı ve mevcut abonelik durumunu ayrıca
doğrulayarak düzeltmek gerekir. Bu güncelleme yeni bir migration gerektirmez.

## 8. Hesap silme ve tahsilatların kapatılması

Hesap silme artık `POST /users/me/delete` üzerinden yapılır. Better Auth'un
genel `delete-user` endpoint'i kapalıdır; bu endpoint ile ödeme kontrolleri
atlanamaz. İptal ve silme işlemleri için son bir saat içinde açılmış, hâlâ geçerli
oturum, izinli frontend origin'i ve birebir yazılı onay gerekir.

Hesap silme penceresi `GET /users/me/deletion-status` ile yalnızca kullanıcının
**sahibi olduğu** çalışma alanlarını inceler. Başkasının çalışma alanına üye
olmak onun aboneliğini iptal etme yetkisi vermez.

1. Yerel abonelik ve tüm checkout referansları Paddle'dan kontrol edilir.
   Aktif, denemede, duraklatılmış ve gecikmiş abonelikler silmeyi engeller.
   Dönem sonu iptal talebi, iptalin tamamlandığı anlamına gelmez. Pencerede
   planlanan iptal/erişim tarihi gösterilir.
2. `TAHSİLATI DURDUR` onayı ile `POST /users/me/close-billing`, doğrulanmış
   abonelikleri **hemen** iptal eder ve iptal edilebilir açık checkout'ları
   kapatır. Bu adım hesabı silmez; erişim hemen biter ve otomatik iade yapılmaz.
   Dönem sonuna kadar kullanmak isteyen kullanıcı hesabını daha sonra siler.
3. Billed/past-due faturalar, henüz işlenmekte olan ödemeler, belirsiz
   `CREATING`/`REVIEW_REQUIRED` kayıtları veya eşleştirilmemiş abonelikler
   otomatik silinmez/affedilmez. İşlem kesinleşmeli veya destek incelemesiyle
   güvenilir eşleştirme yapılmalıdır. 404/timeout doğrulanmış iptal sayılmaz.
4. İptallerin yalnızca bir kısmı başarılı olsa bile hesap korunur. Dış sistemde
   tamamlanan iptaller veritabanı rollback'iyle geri alınamaz; kullanıcıya bu
   belirtilir. Tekrar denemede Paddle durumu yeniden okunur; iptal edilmiş
   abonelik yeniden iptal edilmeye çalışılmaz.
5. `HESABIMI SİL` onayında Paddle tekrar kontrol edilir. Ardından kullanıcı,
   çalışma alanı, abonelik ve mağaza satırları kilitlenerek snapshot değişimi ve
   çalışan/kuyruktaki işler kontrol edilir. Arada yeni checkout açılmışsa silme
   durur. Finansal kapanış kaydı ve kullanıcı silme aynı transaction'dadır.

Abonelik iptal davranışı için [Paddle iptal API'si](https://developer.paddle.com/api-reference/subscriptions/cancel-subscription/),
açık ödeme iptali için [transaction güncelleme API'si](https://developer.paddle.com/api-reference/transactions/update-transaction/)
kullanılır. API anahtarında abonelik okuma/yazma ve transaction okuma/yazma
izinleri bulunmalıdır. Gerçek hesaplar üzerinde otomatik iptal testi yapılmaz.

### Finansal kayıtlar

`BillingClosureRecord`, kullanıcı ve çalışma alanına cascade bağı olmayan ayrı
bir kapanış kaydıdır. Yalnızca çalışma alanı referansı, Paddle ortamı,
abonelik/müşteri/transaction kimlikleri, iptal ve doğrulama zamanları,
fiyat/plan referansları ve doğrulanan işlem tutarları tutulur. İsim, e-posta,
adres, kart/token bilgisi, webhook gövdesi, katalog veya mesaj içerikleri
arşivlenmez. Bunlar anonim değil, sınırlı **takma kimlikli finansal referanslardır**.
Paddle müşteri/fatura kayıtları hesabı silme işlemiyle silinmez. Kapanış kaydı
normal kullanıcı API'lerinden sunulmaz; veritabanı erişimi yetkili operatörlerle
sınırlandırılmalıdır.

Kapatılan aboneliğe sonradan gelen imzalı webhook, abonelik kimliği + müşteri
kimliği + ortam bu kayıtla eşleşirse durumu yeniden oluşturmaz. Eşleşmeyen
olaylar önceki hata/tekrar deneme kurallarına tabidir.

Üretime çıkmadan finansal kayıtların saklama süresi, yetkili erişim ve tasfiye
politikası işletmenin yükümlülüklerine göre ayrıca belirlenmelidir. Bu adım
bir yasal saklama süresi varsaymaz veya otomatik mali kayıt tasfiyesi yapmaz.

`20260909220000_add_billing_closure_records` migration'ını uygulayın ve Prisma
istemcisini yeniden üretin. Yeni ortam değişkeni gerekmez.

## 9. Çalışma alanı finans yetkisi

Finans erişimi `BillingAuthorizationService` üzerinden kontrol edilir.
Çalışma alanının `ownerId` ile tanımlanan sahibi veya o çalışma alanında
`WorkspaceRole.OWNER` / `WorkspaceRole.ADMIN` üyeliği olan kullanıcı yetkilidir.
Mağazadaki `StoreRole.OWNER` veya `StoreRole.ADMIN` rolü tek başına yeterli
değildir. Başka bir çalışma alanındaki yönetici rolü de yetki vermez.

Aşağıdaki endpoint'ler her istekte veritabanından bu yetkiyi doğrular:

- `GET /workspaces/:workspaceId/billing/summary`
- `GET /workspaces/:workspaceId/billing/invoices`
- `GET /workspaces/:workspaceId/billing/invoices/:transactionId/pdf`
- `POST /workspaces/:workspaceId/billing/checkout`
- `POST /workspaces/:workspaceId/billing/portal-session`

Yetkisiz istekler `403 / BILLING_FORBIDDEN` alır; Paddle çağrısı veya checkout
oluşturma başlamaz. PDF indirmede ilgili faturanın doğru Paddle müşterisine
ait olması kontrolü ayrıca korunur. Sistem içi kota ve erişim kontrolleri
bu finans yetkisinden bağımsız çalışmaya devam eder.

`GET /workspaces/:workspaceId/billing/access` yalnızca erişebildiği çalışma alanı için
kullanıcının kendi `canManageBilling` değerini döner; fatura, üye veya ödeme
bilgisi içermez. Sidebar, finans yetkisi bulunan çalışma alanlarının listesine göre bağlantıyı gösterir. Plan,
fatura ve ödeme sayfaları da sunucuda kontrol yapar. İstemcinin gönderdiği bir
rol/yetki alanı güvenlik kararı için kullanılmaz.

Ayrı bir billing rolü veya migration eklenmedi; mevcut çalışma alanı rolleri
kullanılır. Hesap kapatma işlemleri önceki adımdaki gibi yalnızca kullanıcının
**sahibi olduğu** çalışma alanlarını kapsar; finans yöneticiliği başka bir
kullanıcının hesabını silme yetkisi vermez.

## 10. Mevcut abonelikte plan değişikliği

Plan kartları, aktif Paddle aboneliğinde yeni checkout açmak yerine mevcut
aboneliğe yönelik ücret önizlemesi gösterir. İlk satın alma checkout üzerinden
devam eder; mevcut abonelikle doğrudan `/checkout` açmak planlar sayfasına döner.

### Uygulanan ürün politikası

- Hem yükseltme hem düşürme **onaydan sonra hemen** uygulanır. Dönem sonuna
  plan değişikliği zamanlayan ayrı bir görev yoktur.
- Paddle `prorated_immediately` ile kullanılmayan süreyi ve yeni plan ücretini
  hesaplar. Önizlemede şimdi ödenecek tutar, alacak/ücret farkı, sonraki ödeme
  tarihi ve tutarı ile yeni limitler gösterilir. Alacak, nakit iade vaadi değildir.
- `onPaymentFailure: prevent_change` kullanılır. Ödeme reddedilirse plan
  değiştirilmez. Plan/limitlerin yerel kaydı yalnızca doğrulanmış abonelik
  webhook'u ile güncellenir; başarılı HTTP yanıtı tek başına yetki vermez.
- Aktif mağaza, çalışma alanı üyesi veya aktif ürün sayısı yeni limiti aşarsa
  geçiş engellenir. Veri silinmez/arşivlenmez. Kapasite onaydan önce tekrar
  sayılır; işlem sürerken yeni kaynak ekleme eski ve yeni limitin küçüğüne tabidir.
- Aylık soru kullanımı düşürmede silinmez. Yeni kota tükenmişse AI kota
  kontrolleri çalışmaya devam eder; manuel yanıt engellenmez. Ücretli aboneliğin
  `usagePeriodAnchor` değeri korunur: plan veya aylık/yıllık dönem değiştirerek
  ek soru kotası alınamaz. Önizleme kota yenileme tarihini ayrıca gösterir.
- `past_due`, duraklatılmış veya deneme durumundaki Paddle abonelikleri,
  planlanmış iptal/duraklatmalar ve yenilemeye 30 dakikadan az kalan durumlar
  önce çözülmelidir. Bu akış iptal talebini sessizce kaldırmaz.

### Güvenlik ve tekrar denemeler

- `POST /workspaces/:workspaceId/billing/plan-changes/preview`: beş dakika geçerli,
  kullanıcı/çalışma alanı/abonelik/kaynak fiyat/hedef fiyat bağlantılı önizleme.
- `POST /workspaces/:workspaceId/billing/plan-changes/:changeId/confirm`: yalnızca bu
  önizlemeyi oluşturan, hâlâ finans yetkisi olan kullanıcı onaylayabilir.
- `GET /workspaces/:workspaceId/billing/plan-changes/:changeId`: finans yetkisiyle
  durum sorgulama. Başka çalışma alanının işlem kimliği kabul edilmez.
- POST endpoint'lerinde `Origin` de doğrulanır. Üretimde `FRONTEND_URL` doğru
  tanımlanmalıdır. İstemciden tutar, fiyat ID'si, abonelik ID'si veya uygulanma
  biçimi alınmaz; yalnızca sunucudaki plan/fiyat eşleştirmesi kullanılır.
- Onayda Paddle önizlemesi yeniden alınır. Tutar, indirim, adres, abonelik veya
  fiyat değişmişse kullanıcıdan yeni önizleme/onay istenir. Prorasyon dakikaya
  bağlı olduğu için beklerken tutar değişmesi normaldir.
- Çalışma alanı kilidi ve kısmi benzersiz indeks, aynı anda yalnızca bir
  `PROCESSING` / `AWAITING_WEBHOOK` / `REVIEW_REQUIRED` işleme izin verir.
  Gönderim rezervasyonu dış API çağrısından **önce** kalıcılaşır.
- Çift tıklama, ikinci sekme veya tekrar POST aynı işlemi yeniden göndermez.
  Belirsiz bağlantı hatası/yeni süreç başlangıcı rezervasyonu düşürmez.
  `REVIEW_REQUIRED` durumunda ilgili işlem referansı loglanır; yeni PATCH
  gönderilmez. Paddle panelindeki abonelik ve işlem geçmişi doğrulanmalı,
  ilgili `subscription.updated` webhook'u yeniden gönderilmelidir. Uygulanmış
  işlem webhook ile kapanır; uygulanmamış olduğuna dair kanıt olmadan yerel
  durumu sıfırlamayın. Otomatik kör tekrar/otomatik zaman aşımı serbest bırakma yoktur.
- Bekleyen değişiklik checkout ve hesap silmeyi engeller. Kullanıcı arayüzü
  durumu kısa süre aralıklarla sorgular; uzun beklemede manuel yenileme sunar.

### Kurulum ve sandbox kontrolü

`20260910090000_add_subscription_plan_changes` migration'ını uygulayın ve
`npm run db:generate` çalıştırın. API anahtarında **subscription.read** ve
**subscription.write** izinleri gerekir. Mevcut aylık/yıllık fiyat ID'leri
kullanılır; ek Paddle ürünü veya webhook adresi gerekmez.

Sandbox'ta aktif bir abonelikle farklı planı seçin, tutar/limitleri inceleyip
onaylayın. Aynı Paddle abonelik ID'sinin korunduğunu, webhook sonrası planın
güncellendiğini ve yeni checkout açılmadığını doğrulayın. Limit aşan küçük plan,
kart reddi, iki sekme ve geç gelen webhook senaryolarını da kontrol edin.

Kaynaklar: [Paddle plan yükseltme/düşürme](https://developer.paddle.com/build/subscriptions/replace-products-prices-upgrade-downgrade/),
[ücret önizlemesi](https://developer.paddle.com/api-reference/subscriptions/preview-subscription-update/),
[prorasyon](https://developer.paddle.com/concepts/subscriptions/proration/).

## 11. Mağazadan bağımsız faturalandırma

Finans API'leri artık `/workspaces/:workspaceId/billing/*` altında çalışır.
Eski mağaza kapsamlı finans endpoint'leri kaldırıldı; frontend ve backend
birlikte güncellenmelidir. Ürün, kanal ve soru kotası kontrolleri değişmedi.

- `GET /billing/workspaces` yalnızca kullanıcının finans yönetim yetkisi
  bulunan çalışma alanlarının kimlik ve adlarını döner. Mağaza veya tamamlanmış
  onboarding gerekmez; ilgisiz çalışma alanları listelenmez.
- `POST /billing/workspaces`, çalışma alanı olmayan kullanıcının açık
  isteğiyle kendi alanını hazırlar. Kullanıcı satırı onboarding ile ortak
  kilitlenir. Tekrar istekler mevcut sahip olunan alanı kullanır; boş veya
  süresi dolmuş bir alanı yenisiyle değiştirmez. Mağaza oluşturmaz,
  onboarding'i tamamlamaz veya var olan deneme süresini sıfırlamaz.
- `/billing`, oturum açtıktan sonra finans çalışma alanını seçtirir.
  Tek alan varsa doğrudan açılır. Hiç yoksa oluşturma formu gösterilir;
  başka bir alanın yöneticisi olmakla karıştırılmamalıdır.
- Abonelik `/billing/:workspaceId`, planlar `/billing/:workspaceId/plans`,
  faturalar `/billing/:workspaceId/invoices` adresindedir. Bu sayfalar
  dashboard/onboarding yönlendirmelerinden bağımsızdır; her finans isteğinde
  backend yetki kontrolü korunur.
- Checkout adresi `/checkout?workspaceId=...&plan=...&cycle=...` biçimindedir.
  Mağaza çerezi ödeme hedefi belirlemez. Başka sekmede mağaza değiştirmek,
  sayfayı yenilemek veya yeniden denemek aynı çalışma alanı bağını korur.
  Ödeme tamamlanınca aynı alanın abonelik sayfasına dönülür.
- Son mağaza silindikten sonra, deneme süresi bitmiş veya abonelik
  duraklatılmış olsa bile fatura/ödeme/iptal yönetimi açıktır. Yeni mağaza
  oluşturma ve AI kullanımı ise plan erişim/kapasite kontrollerine tabidir.
- Onboarding'deki “Plan ve faturalama” bağlantısı, mağaza oluşturulamaması
  durumunda aboneliğe erişim sağlar. Eski dashboard billing bağlantıları
  Next.js yönlendirmeleriyle yeni giriş sayfasına gider.

Bu adım yeni migration veya Paddle ayarı gerektirmez. Geliştirme sunucusu
`next.config.ts` değişikliğini otomatik almazsa frontend'i yeniden başlatın.

### Kısa manuel kontrol

1. Test hesabında son mağazayı kaldırın; kurulum ekranından **Plan ve faturalama**
   bağlantısını açın. Aynı abonelik ve faturalar görünmelidir.
2. Süresi dolmuş denemede mağaza ekleyemeseniz bile plan seçme/ödeme sayfasına
   erişebilmelisiniz. Sandbox ödemesi ve webhook sonrası mağaza kurulumu devam eder.
3. İki çalışma alanı varsa seçilen alanın adı ve URL kimliği aynı kalmalı;
   ödeme, portal ve fatura istekleri yalnızca o alana gitmelidir.
4. Mağaza yöneticisi olan ama çalışma alanı finans yetkisi olmayan kullanıcı,
   URL'yi bilse bile fatura/ödeme/iptal endpoint'lerinden 403 almalıdır.

## 12. Abonelik erişimi, kota ve iş yürütme politikası

Soru kotası ile abonelik erişimi farklı kontrollerdir. Erişim kararı
`billing-access.policy.ts` üzerinden hem veritabanı zamanlayıcı filtresinde
hem worker'da aynı koşullarla verilir. Kontrol çalışma alanının aboneliğidir;
mağaza yetkileri ve bağlantı güvenlik kontrolleri ayrıca uygulanmaya devam eder.

| İşlem | Aktif abonelik/deneme | Yalnızca AI kotası dolu | Abonelik erişimi kapalı |
| --- | --- | --- | --- |
| Yeni sorular için AI taslağı | Kota dahilinde | Durur | Durur |
| Dahil yeniden oluşturma hakları | Kullanılabilir | Mevcut haklar korunur | Durur |
| Önceden hazırlanmış güvenli cevabın otomatik gönderimi | Güvenlik kontrolleriyle | Devam eder, tekrar kota düşmez | Durur, manuel incelemeye bırakılır |
| Katalog, stok ve soru senkronizasyonu | Devam eder | Devam eder | Otomatik ve elle başlatılan işler durur |
| Beden tablosu görsel analizi | Devam eder | AI soru kotasından bağımsız | Kuyruktaki analiz de durur |
| Kayıtlı sorulara manuel yanıt / kayıtlı taslağı elle gönderme | Açık | Açık | Açık |
| Kayıtlı veriler, performans geçmişi ve faturalama | Açık | Açık | Açık; finans yetkisi korunur |

### Erişim ne zaman kapanır?

- `TRIALING`: yalnızca `trialEndsAt` gelecekteyse erişim vardır.
- `ACTIVE`: `currentPeriodEnd` gelecekteyse erişim vardır. Otomatik yenilenen
  Paddle aboneliğinde dönem sonrası en fazla 30 dakikalık doğrulama penceresi
  uygulanır; ayrıntılar bölüm 13'tedir.
- `cancelAtPeriodEnd=true` tek başına erişimi kapatmaz. Dönem sonunda iptal
  planlanmışsa, süre bitene kadar mevcut aktif erişim korunur.
- `PAST_DUE`, `PAUSED`, `CANCELED`, `EXPIRED` veya eksik abonelikte erişim
  kapalıdır. Bu sürümde başarısız ödeme için ek kullanım süresi tanımlanmamıştır.
  Paddle yenileme webhook'u gecikirse sınırlı doğrulama penceresi ve periyodik
  karşılaştırma kullanılır; pencere dolunca doğrulanmamış erişim uzatılmaz.
- Zamanlayıcı, eksik abonelik için yeni deneme başlatmaz. Kota dolması,
  aboneliği iptal etmez veya bağlantıyı hata durumuna geçirmez.

### Kuyruk ve senkronizasyon davranışı

- Otomatik gönderim kuyruğa alınırken, worker başlarken ve canlı stok
  doğrulamasından sonra **pazaryerine gönderilmeden hemen önce** erişim
  yeniden okunur. Bu kontrol AI kota kontrolü değildir.
- Erişim kapanmışsa gönderim `FAILED` ve açıklayıcı neden ile kapanır,
  taslak metni korunur; soru `NEEDS_REVIEW` olur. Taslağın otomatik gönderim
  uygunluğu kaldırılır. Eski cevap abonelik yenilendi diye kendiliğinden
  yeniden gönderilmez; kullanıcı inceleyip manuel gönderebilir veya yeni
  değerlendirme oluşturabilir.
- Ürün/stok ve soru zamanlayıcıları yalnızca erişimi açık alanları seçer.
  Elle güncelleme, tekrar deneme ve onboarding dahil kuyruk girişinde ayrıca
  kontrol vardır. Kuyrukta beklerken süre dolması worker tarafından yakalanır.
- Çok sayfalı senkronizasyonda her API sayfasından önce ve sonra erişim
  kontrol edilir. Kesilmiş tam katalog senkronizasyonunda eksik ürünleri
  arşivleme adımına geçilmez. Daha önce kaydedilen sayfalar geri silinmez;
  sonraki senkronizasyon mevcut upsert/eşleştirme akışıyla devam eder.
- Abonelik/kota engeli, geçici sağlayıcı hatası gibi üç kez denenmez.
  İşin uygulama kaydı kapatılır, bağlantının çalışma kilidi serbest bırakılır.
  Senkronizasyon geçmişinde mevcut `FAILED` durumu ve abonelik kaynaklı
  durdurma açıklaması gösterilir; kanal `ERROR` yapılmaz.
- Beden tablosu analizi de erişim kontrolünden geçer. Abonelik yüzünden duran
  analiz sonraki tam katalog senkronizasyonunda yeniden kuyruğa alınabilir.
- Abonelik yeniden aktif olduğunda periyodik senkronizasyon sonraki
  zamanlayıcı turunda devam eder; elle güncelleme de tekrar kullanılabilir.
  Kota yenilenince bekleyen sorular soru senkronizasyonunda yeniden
  değerlendirilir.
- Dış sistemin zaten kabul ettiği bir HTTP isteği geri alınamaz. Kontroller,
  yeni istek başlamadan uygulanır; başlamış bir AI/API çağrısının süre
  bittikten sonra yanıt dönmesi tamamen engellenebilecek bir garanti değildir.

### Kullanıcıya gösterilenler ve kontrol

Abonelik sayfası aktif erişim, kota dolması ve erişim kapanması için farklı
açıklamalar gösterir. İptal ekranı aynı politikayı açıklar. Erişim kapalıyken
stok ekranındaki kayıtlar canlı kabul edilmemeli; son güncelleme tarihine
ait oldukları abonelik ekranında belirtilir.

Kısa yerel/sandbox kontrolü:

1. Kuyrukta otomatik cevap varken test aboneliğini erişimsiz duruma alın.
   Pazaryerine gönderilmemeli, taslak manuel inceleme için korunmalıdır.
2. Aktif abonelikte yalnızca soru kotasını tüketin. Stok/soru güncelleme ve
   hazırlanmış güvenli cevabın gönderimi devam etmeli; yeni soru taslağı
   `AI_QUESTION_QUOTA_EXCEEDED` almalıdır.
3. Erişimi kapatıp stok veya soru güncellemeyi deneyin:
   `402 / BILLING_ACCESS_REQUIRED` alınmalı. Aynı durumda mevcut soruya
   manuel cevap gönderimi kullanılabilir olmalıdır.
4. Gelecekte bitiş tarihi olan aktif abonelikte dönem sonu iptalini açın.
   Süre bitmeden senkronizasyon ve otomatik gönderim durmamalıdır.
5. Aboneliği yeniden aktif yapın: yeni senkronizasyon çalışmalı; durdurulmuş
   eski otomatik cevap kullanıcı incelemesi olmadan yeniden gönderilmemelidir.

Bu adım migration, yeni ortam değişkeni veya Paddle paneli değişikliği
gerektirmez. Yerel odaklı kontrollerde gerçek tahsilat, AI çağrısı veya
pazaryerine gönderim yapılmaz.

## 13. Geciken yenileme ve kaçırılan webhook için toparlanma

### Bekleme politikası

Yalnızca `ACTIVE`, Paddle kimliği bağlı ve dönem sonunda iptal/duraklatma
planlanmamış aboneliklerde `currentPeriodEnd + 30 dakika` sabit son sınırdır.
Sayfa yenilemek, API hatası veya tekrar denemek bu süreyi uzatmaz.
`PAST_DUE`, `PAUSED`, `CANCELED`, `EXPIRED` ve deneme için ek süre verilmez.
Paddle'ın doğruladığı ödeme sorunu hemen erişim politikasına uygulanır.
Planlı iptal veya duraklatma, bildirilen yürürlük tarihinde erişimi kapatır.

Bu pencere yeni bir aylık AI kotası açmaz. Kullanım, son doğrulanmış dönemin
kotası üzerinden sürer; Paddle yeni dönemi doğrulayınca mevcut aylık sayaç
ankrajı normal şekilde ilerler. Deneme bitişi güncellemesi durum, Paddle
kimliği ve `updatedAt` koşullarıyla yapılır; eşzamanlı ödeme aktivasyonu ezilmez.

### Otomatik karşılaştırma

- `billing-recovery` BullMQ zamanlayıcısı dakikada bir en fazla 20 zamanı
  gelmiş kaydı seçer. Yenilemeye 24 saatten az kalan/geçmiş yakın dönem,
  `PAST_DUE` veya ilk ödeme bekleyen abonelikler yaklaşık 5 dakikada bir;
  diğer Paddle abonelikleri saatte bir kontrol edilir. Kuyruk yoğunluğu
  bu süreleri etkileyebilir.
- Karşılaştırma yalnızca Paddle'dan **okur**. Yeni ödeme oluşturmaz,
  karttan tahsilat yapmaz veya abonelik iptal etmez. Ana akış webhook'tur.
- Bağlı abonelik `GET /subscriptions/{id}` ile karşılaştırılır. İlk
  `subscription.created` kaçırılmışsa yalnızca backend'in kaydettiği açık
  checkout'un transaction ID'si okunur; tamamlanmış işlemdeki subscription ID
  üzerinden güvenilir fiyat/müşteri/önceki abonelik eşleştirmesi tekrar yapılır.
  `customData` yetki kaynağı değildir. ID'si kaybolmuş `CREATING` veya
  `REVIEW_REQUIRED` ödemeler tahmin edilerek bağlanmaz; yönetici incelemesi gerekir.
- API sonucu ve webhook aynı güncelleme yolunu kullanır. Paddle kaydının
  `updated_at` sürümü `paddleSnapshotAt` alanında, webhook zarf zamanı ise
  `paddleUpdatedAt` alanında tutulur. Eski snapshot yeni durumu ezemez.
  Ağ çağrısı sırasında yerel kayıt değişirse workspace/satır kilidi altında
  `updatedAt` karşılaştırması başarısız olur ve kontrol yeniden denenir.
- Kısa DB çalışma kilidi birden fazla worker'ı korur; çöken işin kilidi beş
  dakika sonra alınabilir. API bekleme sınırı çağrı başına 15 saniyedir.
  Mevcut SDK isteği fiziksel olarak iptal edemez; geç gelen salt-okuma
  yanıtı veritabanını güncelleme adımına ilerleyemez.
- API/izin/eşleştirme hatalarında 5, 10, 20, 40, ardından en fazla 60 dakika
  arayla kontrol yapılır. `lastReconciledAt`, `reconcileAfter`,
  `reconcileFailures`, `reconcileErrorCode` izlenebilir. Başarısız kontrol
  başarılı tarihini ilerletmez; loglarda gizli anahtar veya ham ödeme verisi yoktur.

### Kullanıcı uyarıları ve bekleyen sorular

Ödeme sorunu ve doğrulanamayan yenileme için `BILLING_PAYMENT_ISSUE`
uygulama içi bildirimi oluşturulur. Alıcılar yalnızca çalışma alanı sahibi ve
`OWNER`/`ADMIN` çalışma alanı üyeleridir; mağaza yöneticiliği yeterli değildir.
Bildirim mağaza gerektirmez, aynı dönem için tekrar tekrar oluşturulmaz ve
abonelik güncellemesiyle aynı transaction içinde kaydedilir. Finans bildirimleri
zorunlu uygulama içi uyarılardır; mağaza bazlı e-posta/tarayıcı tercihleriyle
dışarıya gönderilmez. Abonelik sayfasında ödeme yöntemini Paddle portalında
güncelleme bağlantısı ve gecikme açıklaması vardır. Görünür sayfa 30 saniyede
bir yerel özeti kontrol eder; durum değişince ekran yenilenir.

Kota engeli `BLOCKED_QUOTA`, abonelik engeli `BLOCKED_SUBSCRIPTION` olarak
tutulur. Gelen kutusunda **Kota bekliyor** / **Abonelik bekliyor** görünür;
bunlar genel AI üretim hatası veya her soru için ayrı hata bildirimi değildir.
Engel sürerken AI işi tekrar kuyruğa eklenmez. Beş dakikalık ayrı yerel
kontrol, erişimi ve kotası açılan aktif mağazaların hâlâ bekleyen, bağlı ürünü
ve kanalı olan sorularını mevcut otomasyon moduna göre yeniden kuyruğa alır.
Manuel yanıtlanmış sorular ve daha önce güvenlik nedeniyle durdurulmuş
otomatik gönderimler kendiliğinden tekrar gönderilmez.

### Kurulum ve kısa test

Bu adım `20260910120000_add_billing_recovery` migration'ını gerektirir:

```powershell
cd backend
npm run db:migrate:deploy
npm run db:generate
```

Backend'i yeniden başlatın; Redis ve BullMQ worker'ları açık olmalıdır.
Yeni Paddle anahtarı gerekmez. Mevcut API anahtarının abonelik ve işlem
okuma izinleri (`subscription.read`, `transaction.read`) olmalıdır.
Webhook imza kontrolü ve mevcut bildirim hedefi değişmez.

Sandbox'ta yenileme bildiriminin teslimini durdurup yeni dönem oluşmasını
bekleyerek API karşılaştırmasının yerel dönemi onardığını doğrulayabilirsiniz.
Ödeme başarısızlığı olayında finans uyarısı ve ödeme yöntemi bağlantısı;
kota dolmasında ise yeni AI çağrısı olmadan bekleme durumu görülmelidir.
Gerçek ortamda test amacıyla tahsilat veya iptal yapmayın.

Resmî kaynaklar: [Paddle erişim ve periyodik karşılaştırma rehberi](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/),
[abonelik okuma](https://developer.paddle.com/api-reference/subscriptions/get-subscription/).
30 dakikalık pencere Paddle'ın zorunlu kuralı değil, CoreAssist'in ürün politikasıdır.
