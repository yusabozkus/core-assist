# Admin paneli inceleme notları

İnceleme tarihi: 22 Eylül 2026

## Sonuç

Admin panelinin ana sayfa kapsamı yeterli. Öncelik yeni sayfalar eklemek değil; destek işlemlerinin tutarlılığını, gösterilen verilerin doğruluğunu ve arıza anında panelin kullanılabilirliğini iyileştirmek olmalı.

Aşağıdaki maddeler mevcut koddan çıkarıldı. Bazıları izole servis senaryolarıyla yeniden üretildi; yalnızca kod akışından doğrulananlar ayrıca belirtildi. Her maddeyi “kritik güvenlik açığı” olarak değerlendirmiyorum. Bu incelemede doğrudan bir admin yetki atlatma açığı doğrulanmadı; bu, kapsamlı bir sızma testi yapıldığı anlamına gelmez.

Uygulama kodu, veritabanı ve Redis verileri bu inceleme sırasında değiştirilmedi. Bu dosya inceleme notudur, tamamlanmış geliştirme listesi değildir.

## 1. Destek işlemleri birbirlerinin güncellemesini ezebiliyor — Yüksek

**Durum: 22 Eylül 2026 tarihinde çözüldü.** Admin yanıtı, durum değişikliği,
sorumlu ataması, müşteri yanıtı ve müşterinin açma/kapatma işlemleri artık ticket
satırını transaction içinde kilitleyip güncel durum üzerinden karar veriyor.
Eşzamanlı kapanış–atama ve kapanış–müşteri mesajı regresyon senaryoları
doğrulandı.

Kaynaklar: [admin-support.service.ts](backend/src/modules/admin/admin-support.service.ts#L161), [atama işlemi](backend/src/modules/admin/admin-support.service.ts#L320), [müşteri yanıtı](backend/src/modules/support/support.service.ts#L157).

**Sorun:** Talep bilgisi transaction dışında okunuyor. Yanıt, atama ve durum değişikliği daha sonra yalnızca `id` üzerinden güncelleniyor; arada başka bir işlem yapılıp yapılmadığı kontrol edilmiyor.

Örnek: Bir admin açık talebi başka admine atarken diğeri talebi kapatıyor. Atama işlemi eski `OPEN` bilgisiyle devam ederek talebi tekrar `IN_PROGRESS` yapabiliyor. Müşteri/admin mesajı ile kapatma işlemi arasında da benzer yarış var. Audit kaydındaki önceki durum ve bildirim alıcısı da eski bilgiye dayanabiliyor.

**Doğrulama:** İzole servis testinde atama başlamadan okunan durum `OPEN`, transaction başladığında gerçek durum `CLOSED` olacak şekilde işlem sırası kuruldu. Sonuç `IN_PROGRESS` oldu ve `closedAt` dolu kaldı. Gerçek veritabanında talep değiştirilmedi.

**Yapılmalı:** Talebi transaction içinde kilitleyip yeniden okumak veya `updatedAt`/sürüm üzerinden koşullu güncelleme yapmak. Çakışan işlem sessizce kabul edilmemeli; güncel kayıtla tekrar değerlendirilmelidir. Audit ve bildirimler de kabul edilen güncellemeye dayanmalı.

**Kabul testi:** İki adminin kapatma/atama/yanıt işlemleri ve müşterinin eşzamanlı cevabı birlikte çalıştırıldığında durum, kapanış tarihi ve bildirim alıcısı tutarlı kalmalı.

## 2. Destek sohbeti ve canlı bildirimlerin güncellenmesi eksik — Yüksek

**Durum: 22 Eylül 2026 tarihinde çözüldü.** Müşteri ve admin sohbetleri artık
bildirim SSE olayında, sekme yeniden görünür olduğunda, pencere odağa geldiğinde
ve 20 saniyelik güvenlik polling'inde yenileniyor. Devam eden yenileme istekleri
mutasyon başlarken iptal ediliyor ve istek sürümü doğrulanmadan state'e
yazılamıyor. Mutasyon sırasında gelen olaylar işlem sonrasına kuyruğa alınıyor.
Admin ticket detayında görsel header gizli kalırken bildirim merkezi headless
modda çalışmaya devam ediyor.

Kaynaklar: [müşteri sohbeti](frontend/components/dashboard/support/support-ticket-conversation.tsx#L40), [admin sohbeti](frontend/components/admin/support/admin-support-ticket-conversation.tsx#L110), [admin header](frontend/components/admin/admin-header.tsx#L110), [bildirim merkezi](frontend/components/shared/dashboard/notification-center.tsx).

Birbirini tamamlayan üç problem var:

- **Müşteri sohbeti gelen admin cevabını kendiliğinden almıyor.** Ticket state'i ilk açılışta kuruluyor; sonrasında yalnızca müşterinin kendi mesaj/durum işlemiyle güncelleniyor. Sohbete ait polling veya olay aboneliği yok. Bildirim merkezinin yenilenmesi sohbet mesajlarını yenilemiyor.
- **Admin polling cevabı yeni veriyi eski veriyle değiştirebilir.** Mutasyon kontrolü GET isteği başlamadan yapılıyor; önceden başlamış yavaş GET, başarılı mesaj gönderiminin ardından sonuçlanıp eski ticket snapshot'ını state'e yazabiliyor.
- **Ticket detayında admin bildirim dinleyicisi de kaldırılıyor.** Header bu sayfada `null` döndürüyor; bildirim merkezi ve toast/olay dinleme mantığı header içinde. Admin bir taleple ilgilenirken başka talebin canlı bildirimini bu bileşen üzerinden alamıyor. Kalıcı bildirimin veritabanında oluşturulması bundan ayrı; kayıt kaybolmuyor.

**Doğrulama:** Bileşenlerin state, effect, istek ve render akışları incelendi. İki tarayıcıyla canlı arayüz testi bu incelemede yapılmadı.

**Yapılmalı:** Bildirim dinleyicisini görünür header'dan bağımsız, admin layout seviyesinde çalıştırmak. Sohbeti ilgili ticket olayında/sekme odağında yenilemek veya görünürken kontrollü polling kullanmak. Eski GET sonuçlarını istek sürümü/iptal mekanizmasıyla elemek; yazılmakta olan mesajı korumak. Header'ın sohbet ekranında gizli kalması sorun değil.

**Kabul testi:** Müşteri ve admin aynı talebi açık tutarken cevap yenileme gerektirmeden görünmeli; geciktirilmiş GET yeni mesajı kaybettirmemeli. Admin sohbet ekranındayken başka talebin bildirimi gelmeli.

## 3. Admin kota göstergeleri önceki dönemi güncel kullanım gibi gösterebiliyor — Yüksek

**Durum: 22 Eylül 2026 tarihinde çözüldü.** Kullanıcı ve admin tarafı artık aynı
salt-okunur dönem hesaplayıcısını kullanıyor. Admin faturalama ve müşteri
özetleri yalnızca hesaplanan dönem başlangıcıyla eşleşen kullanım kaydını kabul
ediyor; kayıt henüz oluşmamışsa geçmiş dönemi taşımak yerine sıfır gösteriyor.
AI analizindeki kota listesi kullanım satırlarından değil tekil, erişimi açık
aboneliklerden üretildiği için çakışan deneme/ücretli dönemler aynı hesabı iki
kez gösteremiyor. Fatura detayının üst özeti de dönem geçmişindeki ilk satır
yerine bu güncel kullanım özetini kullanıyor.

Kaynaklar: [admin faturalama sorgusu](backend/src/modules/admin/admin-billing.service.ts#L53), [faturalama özeti](backend/src/modules/admin/admin-billing.service.ts#L519), [müşteri özeti](backend/src/modules/admin/admin-customers.service.ts#L406), [fatura detayı](frontend/components/admin/billing/admin-billing-detail.tsx#L47).

**Sorun:** Admin ekranları `periodStart desc / take: 1` ile bulunan en son kullanım kaydını alıyor. Bu kayıt her zaman mevcut kullanım dönemi değil. Yenilemeden sonra henüz AI kullanılmadıysa yeni dönem kaydı oluşmamış olabilir; eski kullanım yeni limitlerle gösterilir.

Kullanıcı tarafı ise [gerçek kullanım aralığını](backend/src/modules/billing/billing-usage.service.ts#L42) hesaplayıp o dönemde kayıt yoksa sıfır gösteriyor. Dolayısıyla müşteri ve admin aynı hesap için farklı kota görebilir. Bu bulgu, kota uygulama mekanizmasının mutlaka yanlış çalıştığı anlamına gelmez; doğrulanan hata admin görünümündedir.

**Doğrulama:** Yenilenmiş aktif abonelik ve sadece önceki döneme ait `1490` kullanım kaydıyla servis özeti çalıştırıldı. Admin özeti eski dönemin `1490` değerini döndürdü; ortak dönem çözücüsünün bulduğu güncel dönem farklıydı.

**Yapılmalı:** Admin tarafı da `resolveUsageWindow` politikasını kullanmalı; o dönemde kayıt yoksa kullanım sıfır olmalı. Geçmiş dönem ayrı gösterilmeli. AI analizindeki kota listesi de aynı hesabı çakışan deneme/ücretli dönemler nedeniyle iki kez göstermemeli. Salt okunur admin sorgusu için abonelik oluşturan bir servisi doğrudan çağırmak yerine dönem hesaplama mantığı paylaşılmalı.

**Kabul testi:** Aylık yenileme, yıllık aboneliğin aylık kota yenilenmesi ve denemeden ücretliye geçişte admin/kullanıcı kullanım değerleri eşleşmeli.

## 4. Arıza sırasında operasyon ekranı gereksiz yere erişilemez olabiliyor — Yüksek

**Durum: 22 Eylül 2026 tarihinde çözüldü.** Operasyon özeti ve kuyruk detayındaki
BullMQ/Redis okumaları artık kuyruk başına iki saniyelik son tarihle
sınırlandırılıyor. Bir kuyruk yanıt vermediğinde PostgreSQL'deki senkronizasyon
geçmişi açılmaya devam ediyor; ilgili kuyruk ve toplam yük alanı sıfırmış gibi
gösterilmek yerine “bilgi alınamadı” durumuna ve tanı koduna düşüyor. Admin
yetkilendirmesi ayrı ve fail-closed kalırken ilk header özeti alınamazsa layout
render edilmeye devam ediyor. Sonraki header yenileme hatalarında da eski
“sağlıklı” snapshot korunmuyor; metrikler ve sistem durumu açıkça bilinmiyor
olarak gösteriliyor.

Kaynaklar: [kuyruk detayı](backend/src/modules/admin/admin-operations.service.ts#L287), [operasyon kuyruk özeti](backend/src/modules/admin/admin-operations.service.ts#L502), [admin layout](frontend/app/admin/layout.tsx#L31), [header API erişimi](frontend/lib/admin-access.server.ts), [header yenilemesi](frontend/components/admin/admin-header.tsx#L51).

**Sorun A:** Sistem sağlığı servisinde timeout var; operasyon servisinin `getJobCounts`, `isPaused`, `getJobs` ve Redis sayaç sorgularında aynı koruma yok. Promise hiç sonuçlanmazsa `catch` çalışmaz. Operasyon listesindeki veritabanı sonuçları da kuyruk özetini bekliyor.

**Sorun B:** İlk admin render'ı header sayaç isteğinin başarılı olmasına bağlı. Oturum doğrulanmış olsa bile bu yardımcı özet hata verirse layout render edilemiyor. Ekran açıldıktan sonraki header yenilemelerinde ise hata sessizce yutulup eski sağlık durumu korunuyor; veri eskimiş olsa da sağlıklı görünebilir.

**Doğrulama:** Hiç sonuçlanmayan kuyruk çağrısıyla detay isteği üç saniye sonunda hâlâ bekliyordu; kaynak kodunda bu beklemeyi sınırlandıran servis timeout'u yok. Header davranışı hata ve render akışından doğrulandı. Gerçek Redis durdurulmadı.

**Yapılmalı:** Operasyon sorgularında kuyruk başına son tarih/timeout uygulanmalı. Redis erişilemiyorsa PostgreSQL'den gelen işlem geçmişi gösterilebilmeli ve kuyruk alanı “bilgi alınamadı” demeli. Header özeti başarısızlığında yetkilendirme kontrolünü gevşetmeden panel açılabilmeli. Eski sağlık verisi güncelmiş gibi sunulmamalı.

**Kabul testi:** Yanıt vermeyen Redis ve yalnızca header özetinin hata vermesi ayrı ayrı denenmeli; erişim kontrolü çalışırken panelin ilgili diğer bölümleri kullanılabilir kalmalı.

## 5. Başarısız yeniden deneme kanal hatasını silebiliyor — Yüksek

**Durum: 22 Eylül 2026 tarihinde çözüldü.** Yeniden deneme uygunluğu artık
başarısız işlem, mağaza, kanal, kimlik bilgisi, aktif kilit, sağlayıcı desteği ve
abonelik erişimini tek politikada doğruluyor. `ERROR` durumundaki bağlantı bir
kurtarma denemesi olarak kuyruğa alınabiliyor; ancak kanal durumu ve son hata
işlem gerçekten başarıyla tamamlanana kadar korunuyor. Redis/kuyruk hatasında
kilit geri bırakılıyor ve önceki kanal teşhisi silinmiyor. Admin ekranı da aynı
politikadan gelen uygunluk sonucunu ve engel nedenini gösteriyor. Pasif mağaza,
süresi bitmiş abonelik ve erişilemeyen kuyruk senaryoları izole olarak
doğrulandı.

Kaynaklar: [retrySyncRunRecord](backend/src/modules/channels/channels.service.ts#L344), [ürün kuyruğu erişim kontrolü](backend/src/modules/product-sync/product-sync-queue.service.ts#L41), [soru kuyruğu erişim kontrolü](backend/src/modules/question-sync/question-sync-queue.service.ts#L41).

**Sorun:** `ERROR` durumundaki kanal, yeniden deneme kuyruğa alınmadan önce `CONNECTED` yapılıyor ve `failureReason` temizleniyor. Sonrasında abonelik erişimi, mağaza durumu veya kuyruk bağlantısı nedeniyle işlem reddedilirse kanal değişikliği geri alınmıyor.

**Doğrulama:** Enqueue işlemi `SUBSCRIPTION_ACCESS_DENIED` hatası verecek şekilde servis çalıştırıldı. İstek başarısız oldu ama kanal `CONNECTED`, hata bilgisi `null` kaldı.

**Yapılmalı:** Ön koşullar önce doğrulanmalı; denemenin başlatılması bağlantının gerçekten düzeldiği anlamına gelmemeli. Son hata başarılı işlemle temizlenmeli veya ayrı “yeniden deneniyor” bilgisi tutulmalı. Kuyruğa ekleme başarısızlığında eski teşhis korunmalı. Adminin yeniden dene butonundaki uygunluk/neden bilgisi de backend kurallarıyla eşleşmeli.

**Kabul testi:** Aboneliği bitmiş, mağazası pasif ve Redis'i erişilemeyen üç senaryoda da hatalı kanal yanlışlıkla sağlıklıya dönmemeli.

## 6. Sağlık ölçümü takılan az sayıdaki işi fark etmeyebilir — Orta

**Durum: 22 Eylül 2026 tarihinde çözüldü.** Kuyruk sağlığı artık bağlı worker
sayısını, en eski bekleyen işin yaşını ve en uzun aktif işin çalışma süresini de
ölçüyor. Bekleme ve çalışma eşikleri kuyruk türüne göre ayrıldı. Uzun çalışan
bir iş yalnızca süre eşiğini aşmasıyla değil, ilerleme değeri de ilgili süre
boyunca değişmediğinde takılmış kabul ediliyor; böylece yavaş fakat ilerleyen
işler gereksiz alarm üretmiyor. Sistem sağlığı ve operasyon ekranları son 24
saatteki retained başarısız işleri aynı ortak sayaçla, yeni kayıtlardan eskiye
doğru zaman skoruyla tarayarak hesaplıyor; 100 kayıt örnekleme sınırı kaldırıldı.
Worker, bekleme ve çalışma teşhisleri sağlık tablosunda, operasyon kartlarında
ve kuyruk detayında gösteriliyor. Tek takılmış iş, ilerleyen uzun iş ve 101
yakın tarihli hata senaryoları izole olarak doğrulandı.

Kaynaklar: [kuyruk sağlığı](backend/src/modules/admin/admin-system-health.service.ts#L524), [operasyon hata sayacı](backend/src/modules/admin/admin-operations.service.ts#L618).

**Sorun:** Kuyruk sağlığı bekleyen iş sayısı, pause durumu, geçmiş hatalar ve gecikmiş zamanlanmış işler üzerinden hesaplanıyor. Worker canlılığı, en eski bekleyen işin yaşı ve çalışan işin süresi ölçülmüyor. Örneğin gönderim kuyruğundaki tek bir iş hiç ilerlemese bile adet uyarı eşiğinin altında kalır; diğer sinyaller de normalse kuyruk sağlıklı görünebilir.

**Doğrulama:** Bir bekleyen/bir aktif iş, sıfır hata ve sıfır gecikmiş zamanlanmış iş döndüren izole kuyrukla tüm kuyruklar `HEALTHY` döndü. Gerçek bir worker durdurulmadı; doğrulanan nokta sağlık hesabında ilerleme/canlılık sinyallerinin bulunmaması.

İkinci doğruluk sorunu: Sistem sağlığı son **100** failed işi örnekleyip sonucu “24 saat hata” olarak gösteriyor; operasyonlar aynı sayaç için retained failed kümesinin tamamını sayıyor. Bir günde 100'den fazla hata varsa ekranlar farklı sayılar verebilir. Tam küme de kuyrukta saklanan kayıtlardır; kalıcı tüm hata geçmişi değildir.

**Yapılmalı:** Kuyruk türüne göre en eski bekleme ve aşırı çalışma süresi eşikleri, gerektiğinde worker heartbeat'i eklenmeli. Yavaş ama ilerleyen işler yanlış alarm üretmemeli. Son 24 saat sayacı ortak yöntemle hesaplanmalı; örneklenmiş değerler kesin toplam diye sunulmamalı. Redis'ten tüm failed kümesini taşımak yerine zaman skoru üzerinden sayım değerlendirilebilir.

**Kabul testi:** Eşik altında tek takılmış iş ve 101 yakın tarihli başarısız iş senaryoları. Sağlık sayfası ile operasyonlar aynı anlamdaki değerleri göstermeli.

## 7. SLA bildirimi taraması ilk 500 talepte takılabiliyor — Orta, hacme bağlı

**Durum: 22 Eylül 2026 tarihinde çözüldü.** SLA taraması artık en eski 500
gecikmiş talebi körlemesine almak yerine, mevcut support adminlerinden en az
birinin bildirimi eksik olan talepleri veritabanında aday olarak seçiyor. Aday
satırlar işlem boyunca kilitleniyor; böylece bildirim yazılmadan hemen önce
talebin hâlâ açık, yanıtsız ve süresi geçmiş olduğu aynı atomik işlem içinde
doğrulanıyor. Alıcı bazındaki benzersiz `dedupeKey` korunuyor ve yalnızca
gerçekte oluşturulan bildirimlerin canlı yenileme olayı gönderiliyor.

Geçici tablolarla ve tamamen geri alınan bir SQL regresyonunda 501 gecikmiş
talep oluşturuldu: ilk 500'ün bildirimi varken 501. talep bulundu; onun bildirimi
de eklendiğinde tekrarlanan tarama sıfır aday döndürdü. Sorgunun gerçek şema ve
kilit sözdizimi ayrıca PostgreSQL üzerinde `EXPLAIN` ile doğrulandı.

Kaynak: [notifyOverdueTickets](backend/src/modules/support/support-notification.service.ts#L161).

**Sorun:** Her taramada en eski 500 gecikmiş talep alınıyor; bu taleplere daha önce bildirim gönderilip gönderilmediği sonradan kontrol ediliyor. İlk 500 hâlâ açıksa ve bildirimleri zaten varsa sonraki taleplere ilerlenmiyor.

**Doğrulama:** 501 gecikmiş talep ve ilk 500'üne gönderilmiş bildirimlerle iki tarama çalıştırıldı. İkisinde de aynı 500 kayıt incelendi, yeni bildirim üretilmedi; 501. talep kapsanmadı. Mevcut veritabanında bu hacimde talep yok; gelecekteki hacim hatasıdır.

**Yapılmalı:** Cursor ile sonraki sayfalara ilerlemek veya alıcı bazında bildirimi olmayan adayları sorgulamak. Deduplication korunmalı; gönderim öncesinde talebin hâlâ gecikmiş/yanıtsız olması da doğrulanmalı.

**Kabul testi:** İlk 500'ü bildirilmiş 501+ talepte sonraki talebin bildirimi oluşmalı; tekrarlı tarama aynı bildirimi çoğaltmamalı.

## 8. AI analizindeki bazı sayaçlar yanlış problemi anlatıyor — Orta

**Durum: 22 Eylül 2026 tarihinde çözüldü.** Admin AI ekranındaki engel alanı
artık tarih aralığına göre değişen geçmiş taslak kayıtlarını karıştırmak yerine
o anda müdahale bekleyen durumları gösteriyor. AI üretim hatası yalnızca hâlâ
`PENDING + FAILED` olan taslak işlerini, cevap gönderim hatası ise ayrı olarak
`QuestionAnswer.FAILED` kayıtlarını sayıyor. Kota ve abonelik engelleri de
yalnızca hâlâ bekleyen sorulardan hesaplanıyor.

Eksik ürün bilgisi sayacı yalnızca `DRAFTED + NEEDS_REVIEW` durumundaki ve
henüz hiçbir cevap gönderim kaydı oluşmamış soruları kapsıyor. Böylece manuel
cevap kuyruğa alındığında veya soru cevaplandığında kayıt aktif engelden çıkıyor.
Bilgi çakışması sayacı da API'de hesaplanıp arayüzde kaybolmak yerine aynı panelde
ayrı gösteriliyor.

Cevap kuyruğuna ekleme, mağaza durumu, otomasyon güvenlik kontrolü ve pazaryeri
teslimatı hataları artık başarılı oluşturulmuş `AiDraftAttempt` kaydını
`FAILED` yapmıyor. Teslimat `QuestionAnswer.FAILED` olarak kalıyor; güvenlik
kontrolünden dönen taslak yeniden incelenebilir `AVAILABLE + NEEDS_REVIEW`
durumuna getiriliyor. Eski yanlış `FAILED` sonuçlarının ücretsiz yeniden üretim
sayımını etkilememesi için kota hesaplaması da bütün oluşturulmuş taslakları
sayacak biçimde düzeltildi. Global durum sorguları için gerekli indeksler
`20260922150000_add_ai_operation_status_indexes` migration'ıyla eklendi.

Kabul senaryoları izole olarak doğrulandı: cevaplanmış ve cevap kuyruğuna alınmış
eksik-bilgili sorular aktif engel sayılmadı; manuel cevap oluşunca son aktif
engel sıfıra indi. Pazaryeri teslimatının nihai hatasında taslak sonucuna hiçbir
güncelleme yapılmadığı worker seviyesinde doğrulandı.

Kaynaklar: [AI analiz sorguları](backend/src/modules/admin/admin-ai-usage.service.ts#L85), [işlem engelleri kartı](frontend/components/admin/ai-usage/admin-ai-usage-dashboard.tsx#L102), [gönderim worker'ı](backend/src/modules/question-answer/question-answer-worker.service.ts#L328).

- “Eksik ürün bilgisi” sayacı, `NEEDS_REVIEW` ve eksik bilgi alanlarını kontrol ediyor ama sorunun hâlâ yanıtsız olması şartını aramıyor. Manuel cevap gönderilmesi bu taslak alanlarını temizlemiyor. Cevaplanmış soru, seçilen tarih aralığında güncellendiyse işlem engeli gibi sayılabilir.
- “Üretim hatası” kartı mevcut üretim hatalarını `AiDraftAttempt.outcome = FAILED` sayısıyla topluyor. Oysa cevap gönderimi başarısız olduğunda da taslağın outcome'u `FAILED` yapılıyor. Başarılı üretilmiş ama pazaryerine gönderilememiş cevap üretim hatası gibi gösterilebilir.

**Doğrulama:** Sayaç sorguları ile gönderim worker'ının yaptığı alan güncellemeleri karşılaştırıldı. Mevcut demo veride cevaplanmış eksik-bilgili soru örneği bulunmadı; bu bölüm gerçek kullanıcı olayında yeniden üretildi iddiası taşımaz.

**Yapılmalı:** “Şu an bekleyen işler”, “dönemde üretim hatası” ve “gönderim hatası” ayrı tanımlanmalı. Sayaçlar uygun durum ve tarih alanlarından türetilmeli. İşlem yapılması beklenen sayaçtan ilgili soru/mağaza listesine geçiş faydalı; sadece yeni bir özet kart eklemek sorunu çözmez.

**Kabul testi:** Eksik bilgili soru manuel yanıtlanınca aktif engellerden çıkmalı. Üretilen taslağın gönderimi başarısız olunca üretim hatası sayısı artmamalı.

## 9. Destek erişimi aktif mağazaya fazla bağımlı — Orta

**Durum: 22 Eylül 2026 tarihinde çözüldü.** Müşteri destek API'si mağaza
parametresinden çıkarılıp oturum kullanıcısının tek müşteri hesabına bağlandı.
Liste ve detay sorguları `workspaceId` sınırında çalışıyor; cevap ve durum
değişiklikleri ticket satırı kilitlendikten sonra aynı hesap kimliği yeniden
doğrulanmadan ilerlemiyor. Böylece başka mağaza seçili olsa da eski ticket
bağlantısı açılıyor, hesaplar arası ticket erişimi ise aynı 404 yanıtıyla kapalı
kalıyor.

Yeni destek talebinde mağaza artık opsiyonel. Seçili mağaza varsa kullanıcının o
mağazadaki erişimi doğrulanıp talebe ekleniyor; mağaza yoksa talep doğrudan müşteri
hesabı altında açılıyor. Henüz görünmeyen müşteri hesabı oluşmamış kullanıcıda ilk
talep işlemi mevcut workspace oluşturma kilidini kullanarak hesabı güvenli biçimde
hazırlıyor. Destek rotası onboarding ve aktif mağaza zorunluluğu olmayan ayrı bir
layout'a taşındı; onboarding hesap menüsüne de yardım bağlantısı eklendi. Diğer
dashboard sayfalarının mağaza koruması değiştirilmedi.

Frontend liste isteği artık hatayı boş liste gibi göstermiyor. Ticket detayında
yalnızca backend'in gerçek 404 yanıtı `notFound()` oluyor; timeout, bağlantı ve 5xx
hataları destek rotasına özel, yeniden deneme sunan hata ekranına düşüyor. Ticket
listesinde mağaza adı veya “Genel hesap talebi” bağlamı da görünür hale geldi.

Doğrulama: Backend production build'i ve frontend Next.js production build'i
başarıyla tamamlandı. Next route çıktısında `/dashboard/support` ile ticket detay
rotası yeni mağazadan bağımsız layout altında üretildi.

Kaynaklar: [destek sayfası](frontend/app/(support-dashboard)/dashboard/support/page.tsx), [müşteri ticket sayfası](frontend/app/(support-dashboard)/dashboard/support/tickets/[ticketId]/page.tsx), [ticket erişim sorgusu](backend/src/modules/support/support.service.ts#L106), [admin cevabı bildirimi](backend/src/modules/support/support-notification.service.ts#L85).

Admin işleminin müşteriye ulaşmasını etkilediği için ilişkili kullanıcı akışı da incelendi:

- Destek sayfası mağaza yoksa onboarding'e yönlendiriyor. Mağaza kuramayan veya son mağazasını silmiş hesap uygulama içinden bu akışla talep açamıyor.
- Ticket URL'si yalnızca ticket kimliği taşıyor; sayfa ise sorguyu o anda seçili mağazayla yapıyor. Başka mağaza seçiliyken eski bir talebin doğrudan bağlantısını açmak, kullanıcının gerçek erişimi olsa bile 404'e düşebilir.
- **Admin ticket sayfasında düzeltilen “her hatayı 404 sayma” davranışı kullanıcı tarafında duruyor.** Detay isteğindeki timeout/500 dahil bütün hatalar `null` yapılıp `notFound()` olarak gösteriliyor. Destek listesi de hata durumunda boş liste gösterebiliyor.

**Doğrulama:** Sayfa yönlendirmeleri, store/ticket erişim filtresi ve catch blokları incelendi.

**Yapılmalı:** Ticket kimliğinden gerçek hesabı/mağazayı bulup oturumun erişimini backend'de doğrulamak; aktif mağaza seçimini erişim yetkisi yerine kullanmamak. Hesap seviyesinde, mağazası opsiyonel destek talebi açılabilmeli. Yalnızca gerçek 404 bulunamadı sayılmalı, servis hatalarında yeniden deneme sunulmalı.

**Kabul testi:** Başka mağaza seçiliyken eski ticket bağlantısı; mağazasız hesapla destek açma; backend 500 verirken doğru hata ekranı. Hesaplar arası erişim kesinlikle açılmamalı.

## 10. Paddle aramasında yenileme transaction'ları eksik kalıyor — Orta, gerekli kapsam tamamlama

**Durum: 22 Eylül 2026 tarihinde çözüldü.** İmzalı Paddle transaction
webhook'ları artık erişim yetkisi vermeden, güvenilir abonelik/müşteri/checkout
eşleşmesi üzerinden asgari bir transaction referansı oluşturuyor. Sandbox ve
production kayıtları ayrı tutuluyor; çelişen hesap eşleşmesi webhook'u retry
edilebilir hata olarak durduruyor. İlk checkout kayıtları migration sırasında
geriye dönük ekleniyor; yenileme transaction kimlikleri hem global aramada hem
admin faturalandırma aramasında ilgili müşteri hesabını buluyor. Kart, tutar ve
ham webhook içeriği saklanmıyor; referanslar 730 gün sonra günlük, sınırlı
partilerle temizleniyor.

Kaynaklar: [global arama](backend/src/modules/admin/admin-global-search.service.ts#L174), [admin billing araması](backend/src/modules/admin/admin-billing.service.ts#L403), [webhook modeli](backend/prisma/schema.prisma#L285), [transaction webhook davranışı](backend/src/modules/billing/paddle-billing.service.ts#L454).

**Mevcut olan:** Arama artık gerçek müşteri, mağaza, ticket, senkronizasyon ve Paddle kayıtlarını sorguluyor. İlk satın almadaki checkout transaction kimliği de aranıyor. Önceki “arama sadece sabit sayfalarda çalışıyor” bulgusu artık geçerli değil.

**Kalan eksik:** Transaction araması yerel checkout kayıtlarına dayanıyor. Sonraki aylarda Paddle'ın oluşturduğu yenileme işlemi bu checkout transaction'ı değil. Webhook event tablosu da transaction–müşteri eşleştirmesini tutmuyor. Dolayısıyla yalnızca yenilemenin `txn_...` kimliğini veren müşterinin hesabı bu aramadan bulunamayabilir.

**Doğrulama:** Aranan veri kaynakları, modeller ve transaction event işleme akışı incelendi. Paddle'a canlı istek gönderilmedi. Bu bulgu yenileme tahsilatı/abonelik güncellemesinin bozuk olduğu anlamına gelmez; adminin ödeme araştırma imkânı eksik.

**Yapılmalı:** Ham ödeme verisini saklamadan asgari transaction–abonelik–müşteri referansları tutulabilir veya tam transaction kimliğiyle yetkili, salt okunur Paddle sorgusu yapılabilir. Sandbox/live ayrımı, hata/timeout kontrolü ve veri saklama politikası korunmalı.

**Kabul testi:** İlk checkout transaction'ı ve sonraki yenileme transaction'ı aynı doğru müşteri hesabına ulaşmalı.

## Demo veriye ilişkin ayrı not

Mevcut veritabanı salt okunur sorgularla kontrol edildi: 12 kullanıcı, 9 müşteri hesabı ve 8 destek talebi var. Demo verinin ekrandaki çeşitliliği göstermesi, gerçek entegrasyonların doğrulandığı anlamına gelmiyor.

[seed-realistic-demo.ts](backend/src/scripts/seed-realistic-demo.ts#L520) içinde:

- Paddle abonelik referansları `sub_demo_...` gibi yapay değerler; adminin gerçek Paddle kontrolü bu kayıtlarla başarı senaryosu olarak test edilemez. Reconciliation zamanı da ileriye atılmış.
- `DEMO_AI_BATCH` kullanım olaylarının **18 tanesinin tarihi bağlı olduğu kullanım döneminin dışında**. Bu durum dönem kullanımı ile tarih bazlı AI grafiğinin karşılaştırılmasını yanıltır.

Bu kayıtlar bu incelemede düzeltilmedi. Seed'in dönem/tarih tutarlılığı ayrıca iyileştirilmeli; Paddle akışları için gerçek sandbox kayıtları kullanılmalı. Yapay müşteri/hata kayıtlarını gerçek bir sistem arızası diye değerlendirmemek gerekir.

## İncelemede mevcut olduğu doğrulananlar

- Admin erişimi backend'de oturum, doğrulanmış e-posta ve tam allowlist eşleşmesiyle kontrol ediliyor.
- İncelenen admin controller'larında `AuthGuard` ve `AdminGuard`; durum değiştiren admin endpointlerinde Origin koruması var.
- Audit kayıtlarında işlem anındaki aktör adı/e-posta snapshot'ı bulunuyor; admin hesap işlemleri için audit entegrasyonları mevcut.
- Yeni talep, müşteri mesajı, admin cevabı, atama ve SLA için kalıcı bildirim altyapısı var. Eksik olan bütün bildirim sistemi değil, yukarıdaki teslim/görünürlük sınır durumları.
- Dahili destek mesajları müşteri mesaj sorgusundan filtreleniyor.
- Admin ticket detayında gerçek 404 ayrımı ve `/admin/error.tsx` mevcut.
- Gerçek global arama, tarih indeksleri ve [veri saklama politikası](DATA_RETENTION.md) eklenmiş; bunları yeniden “yok” diye listelemek doğru olmaz.
- Admin hesap güvenliği bildirimleri `/admin/account` adresini kullanıyor.

İki kişilik iç ekip için mevcut e-posta allowlist yaklaşımını başlı başına hata saymıyorum. Ayrıntılı admin rol editörü, müşterinin hesabına girme, gelişigüzel kota değiştirme, veritabanı düzenleme veya iade başlatma gibi yeni yetkileri bu incelemede gerekli özellik olarak önermiyorum. İhtiyaç doğmadan eklenmeleri paneli daha güvenilir yapmaz.

## Kontroller ve sınırlar

- Backend `npm run build`: başarılı.
- Frontend `npm run typecheck`: başarılı.
- Backend admin/support ve demo seed dosyalarında ESLint: hata yok.
- Frontend admin sayfaları/bileşenleri/API yardımcılarında ESLint: hata yok; sidebar'da kullanılmayan `Layers01Icon` import'u için tek uyarı var. İşlevsel bulgu olarak önceliklendirilmedi.
- Yeni derlenen servislerle, taklit bağımlılıklar üzerinden destek yarışı, başarısız retry, SLA tarama sınırı, eski kota dönemi, kuyruk sağlık kararı ve sonuçlanmayan kuyruk isteği senaryoları çalıştırıldı. Bunlar gerçek DB eşzamanlılık/arayüz testinin yerine geçmez.
- Veritabanı sorguları `BEGIN READ ONLY` içinde yürütüldü. Veri, oturum, abonelik ve kuyruk kayıtları değiştirilmedi.
- Kontrol sırasında `localhost:4001` API'sine bağlantı kurulamadı. Bu nedenle oturumlu HTTP/browser uçtan uca test yapılmış gibi bir sonuç çıkarılmamalı. Harici Paddle/marketplace işlemleri denenmedi.

## Önerilen geliştirme sırası

1. Destekte eşzamanlı güncelleme koruması ve çift yönlü sohbet/bildirim yenilemesi — maddeler 1–2.
2. Kanal retry işleminde hata bilgisinin korunması ve operasyon/header hata dayanıklılığı — maddeler 4–5.
3. Kota dönemlerinin ve AI sayaçlarının doğru ortak tanımlarla hesaplanması — maddeler 3 ve 8.
4. Kuyruk ilerleme ölçümü, tutarlı hata sayacı ve SLA taramasının sayfalanması — maddeler 6–7.
5. Aktif mağazadan bağımsız destek erişimi ve yenileme transaction araması — maddeler 9–10.
6. Demo tarihlerini düzeltip bu senaryoları kalıcı regresyon testlerine dönüştürmek; ardından iki oturumlu tarayıcı ve gerçek Paddle sandbox doğrulaması.

Bu listenin amacı yeni bir büyük admin modülü başlatmak değil; var olan paneli günlük kullanımda güvenilir hâle getirmek.
