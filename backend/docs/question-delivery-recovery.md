# Soru ve cevap teslimatının toparlanması

Bu akış SYNC-01 ve ANSWER-01 düzeltmelerini açıklar. Sağlayıcıya gönderim için doğrulanmış bir idempotency sözleşmesi kullanılmıyor; belirsiz teslimatlar otomatik tekrar gönderilmez.

## Gelen sorular

`IncomingEvent` yalnızca sorunun alındığının kaydıdır. Aynı event tekrar geldiğinde soru yoksa işlem yeniden denenir. Event satırı PostgreSQL'de kilitlenir; soru oluşturma ve event'i `PROCESSED` yapma aynı transaction'dadır. Birbirine paralel tekrarlar ikinci soru oluşturmaz. Ürün eşleştirmesi hata verirse event `FAILED` kalır ve sonraki deneme tekrar işler.

Soru senkronizasyonu, sağlayıcıdan yeni sayfaları almadan önce aynı bağlantının sorusu olmayan `PENDING`/`FAILED` event'lerini 100 kayıtlık sayfalarla tarar. Saklanan payload, Trendyol/Hepsiburada'nın mevcut normalizer'ından geçirilir. Böylece sorunun sağlayıcının güncel listesinde kalmasına bağımlı olmadan onarım yapılabilir. Abonelik erişimi ve bağlantı tarihi kontrolleri korunur.

Eksik/eski mock payload'lar güvenilir biçimde yeniden oluşturulamaz; taze sağlayıcı verisi beklenir. Operatör event'in kimlik, tarih, metin veya ürün bilgisini tahmin ederek tamamlamamalıdır. Bağlantı aktif değilse/abonelik durduysa önce normal senkronizasyon koşulları düzeltilmelidir. Tek bir tekrarın hâlâ hata vermesi senkronizasyon işini başarısız bırakır; başarılıymış gibi gizlenmez.

## Cevap gönderimi

| Durum | Davranış |
| --- | --- |
| `QUEUED` | PostgreSQL'de kalıcı gönderim niyeti vardır. Redis işi eksikse reconciliation aynı iş kimliğiyle yeniden oluşturur. |
| `PROCESSING` | Sağlayıcı POST'undan hemen önce atomik claim alınmıştır. Bu durumdaki kayıt tekrar POST edilmez. |
| `SENT` | Sağlayıcı başarı sonucu ve soru/cevap güncellemeleri transaction ile kaydedilmiştir veya operatör teslimatı doğrulamıştır. |
| `FAILED` | Dış gönderimden önce durdurulmuştur veya operatör gönderilmediğini doğrulamıştır. Kullanıcı tekrar gönderim isteyebilir. |
| `REVIEW_REQUIRED` | Sağlayıcıya ulaşıp ulaşmadığı belirsizdir. Panelde **Teslimat kontrolü** filtresi ve uyarısı, admin AI kullanımında gönderim sorunları listesi bulunur. Yeni gönderim/taslak engellenir. |

Reconciliation BullMQ üzerinden **60 saniyede bir** çalışır. `PROCESSING` kaydı **15 dakikayı** aşarsa incelemeye alınır. Saatlerce gönderiyor görünmesi önlenir; bu süre sağlayıcıya yeniden gönderim izni değildir. Canlı worker sonradan kesin başarı sonucu alırsa aynı deneme için kaydı `SENT` yapabilir.

Her yeni kullanıcı denemesi, `queuedAt` üzerinden farklı bir iş kimliği taşır. Eski denemenin worker'ı veya son hata callback'i yeni denemeyi gönderemez/değiştiremez. Eski sürümde oluşturulmuş, deneme bilgisi taşımayan işler gönderim yapmadan tamamlanır; reconciliation `QUEUED` kaydını doğru veriyle yeniden kuyruğa alır.

Redis geçici olarak erişilemezse kalıcı niyet korunur. **Redis tamamen silinirse scheduler kaydı da kaybolur:** Redis düzeldikten sonra yeni sürüm backend'i yeniden başlatın; başlangıç scheduler'ı yeniden kurar ve DB'deki kuyruk kayıtları toparlanır. Uygulama Redis'te genel `FLUSHDB`/`FLUSHALL` işlemi yapmaz.

## Sürüm geçişi

1. Veritabanı yedeği alın. **Eski sürümün bütün backend/answer worker instance'larını durdurun.** Eski worker ile yeni sürümü paralel çalıştırmayın; eski kod yeni gönderim korumasını uygulamaz.
2. Yeni sürümle backend dizininde `npm run db:migrate:deploy` çalıştırın. İki migration vardır: `REVIEW_REQUIRED` enum değeri ve önceki sürümün belirsiz denemelerini ayıran veri güncellemesi. Sıraları korunmalıdır.
3. Eski `PROCESSING` kayıtları ve `attempts > 0` olan eski `QUEUED`/`FAILED` kayıtları incelemeye alınır. Eski kod dış çağrıdan önce sayacı artırdığı için bunların bir kısmı gerçekte hiç gönderilmemiş olabilir; buna karşın otomatik yeniden gönderim güvenli kabul edilemez. Hiç denenmemiş kuyruk kayıtları ve `SENT` kayıtları korunur.
4. Kaynak kurulumunda `npm run db:generate` ve `npm run build` çalıştırın. Docker image'ı bunları build sırasında yapar. Frontend'i de yeni durum etiketiyle yayınlayın; sonra yalnızca yeni backend'i başlatın.
5. Soru senkronizasyonu ve cevap reconciliation işinin çalıştığını, inceleme kayıtlarının panelde göründüğünü kontrol edin. Eski sürüme kontrolsüz rollback yapmayın: eski queue kodu yeni durumu tanımaz.

Migrationlar bu geliştirme çalışmasında yalnızca izole test veritabanlarına uygulandı. Mevcut uygulama veritabanının güncellenmesi, yukarıdaki durdurma/başlatma sırasıyla yapılmalıdır.

## Belirsiz teslimatı sonuçlandırma

Bu bir müşteriye açık API değildir; DB erişimi olan operatörün kontrollü bakım komutudur. Kullanıcı panelindeki “Destek talebi oluştur” yolu üzerinden inceleme istenebilir.

1. İlgili cevabın ID'sini admin gönderim sorunları listesinin API verisinden veya DB'den bulun. Cevap metni ve pazaryeri soru kimliğiyle doğru kaydı eşleştirin.
2. **Bütün backend/answer worker instance'larını durdurun.** Yalnızca kuyruğu pause etmek, hâlihazırdaki POST'u durdurmaz. Komuttaki `--workers-stopped` operatörün beyanıdır; başka makinelerin durumunu otomatik doğrulamaz.
3. Sağlayıcının paneli/kayıtları üzerinden cevabın gerçekten gönderildiğini veya gönderilmediğini doğrulayın. Hemen görünmemesi tek başına gönderilmediğinin kanıtı değildir; sonuç belirsizse kayıt incelemede kalır.
4. Derlenmiş yeni backend dizininden çalıştırın:

```powershell
# Cevap pazaryerinde doğrulandı; tekrar gönderim yapılmaz.
npm run repair:answer -- <answer-id> sent "operator-name" "Kontrol edilen soru ve teslimat kanıtı" --workers-stopped

# Gönderilmediği doğrulandı; yeniden gönderme seçeneği açılır, bu komut göndermez.
npm run repair:answer -- <answer-id> not-sent "operator-name" "Gönderilmediğini doğrulayan kontrol" --workers-stopped
```

Komut yalnızca `REVIEW_REQUIRED` durumunu değiştirir; kayıt kilitlenir, soru/taslak güncellemeleri ve audit kaydı aynı transaction'da yazılır. `sent` sonucunda gerçek sağlayıcı teslimat zamanı bilinmediği için tarih uydurulmaz (`sentAt`/`answeredAt` boş kalır); doğrulama zamanı audit metadata'sındadır. `not-sent` otomatik gönderimi yeniden etkinleştirmez; kullanıcı yeni gönderim isteği vermelidir. Yeni sürüm worker'ları işlem bittikten sonra yeniden başlatın.

## Regresyon testleri

Backend dizininde:

```powershell
npm run check
```

Eski cevap teslimatı entegrasyon test dosyası kaynakta bulunmuyor. `check`, mevcut yerel testleri ve build'i çalıştırır; teslimat/reconciliation akışının uçtan uca geçtiği anlamına gelmez. Güncel otomatik kapsam: [kalite kontrol rehberi](quality-checks.md).

Staging kabulünde event sonrası hata, transaction rollback, eşzamanlı tekrar, Redis enqueue kaybı/belirsizliği, çift worker, sağlayıcı yanıt kaybı, gönderim sonrası DB hatası, sahipsiz `PROCESSING`, operatör kararı/audit ve `SAFE_AUTO` koşulları ayrıca sınanmalıdır.

Fiziksel process-kill, VDS yeniden başlatma ve gerçek pazaryeri sandbox kabulü de [staging kabul kaydında](../../deploy/STAGING_ACCEPTANCE.md) takip edilir.
