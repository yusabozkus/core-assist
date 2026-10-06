# Veri Saklama Politikası

Bu politika, Core Asistan veritabanındaki operasyonel tabloların kontrolsüz büyümesini önler. Temizlik işi BullMQ üzerindeki `data-retention` kuyruğunda günlük çalışır ve her kayıt türü için bir çalışmada en fazla 10.000 kaydı, 500 kayıtlık partiler halinde siler.

## Varsayılan süreler

| Kayıt | Saklama süresi | Temizlik koşulu |
| --- | ---: | --- |
| Audit kayıtları | 365 gün | `createdAt` süresi dolmuşsa |
| Başarılı senkronizasyon çalışmaları | 90 gün | Durum `COMPLETED` ve `updatedAt` süresi dolmuşsa |
| Başarısız senkronizasyon çalışmaları | 180 gün | Durum `FAILED` ve `updatedAt` süresi dolmuşsa |
| Çözülen destek talepleri | 365 gün | Durum `RESOLVED` ve `resolvedAt` süresi dolmuşsa |
| Kapatılan destek talepleri | 365 gün | Durum `CLOSED` ve `closedAt` süresi dolmuşsa |
| Arşivlenen iletişim mesajları | 730 gün | Durum `ARCHIVED` ve `archivedAt` süresi dolmuşsa |

Destek talebi silindiğinde ona bağlı mesajlar ilişkisel olarak silinir. Açık, işlemde veya müşteri yanıtı bekleyen destek talepleri temizlenmez. Çalışan senkronizasyonlar temizlenmez.

Destek mesajı görselleri özel B2 bucket'ında tutulur. Görsel yaşam döngüsü, hesap ve talep kayıtlarından bağımsız `support_image_object` tablosunda izlenir:

- B2'ye yüklemeden önce dosya anahtarları `STAGED` olarak kaydedilir. Bir saat içinde mesaja bağlanmayan yüklemeler temizlenir. Başarısız yükleme/mesaj işlemlerinde beş dakikalık bekleme sonrasında temizlik başlar; bu süre devam eden yüklemenin sonuçlanması içindir.
- Mesaja bağlama, PostgreSQL tetikleyicisiyle aynı işlemde `ATTACHED` durumuna geçer. Temizlik tarafından alınmış veya süresi dolmuş dosya mesaja bağlanamaz.
- Talep, mesaj veya hesabın silinmesi bağlı görselleri aynı veritabanı işleminde `PENDING_DELETE` olarak işaretler. İşlem geri alınırsa silme işi de geri alınır. Saklama süresi temizliğinde silme anında durum ve tarih yeniden kontrol edilir; arada yeniden açılan talepler korunur.
- `data-retention` kuyruğundaki ayrı iş her dakika en fazla 20 dosyayı işler. Her dosya için iki dakikalık sahiplik süresi kullanılır; çöken worker'ın işi tekrar alınabilir. B2 hataları bir dakikadan başlayıp en fazla altı saate çıkan bekleme ile tekrar denenir. Başarısız kayıtlar süre doldu diye atılmaz.
- B2 konumu yeni dosyalarla birlikte kaydedilir. Bucket/endpoint değişmişse başka konumdan silmek yerine iş bekletilir. Eski görsellerin konumu önceki uygulamadaki gibi mevcut `SUPPORT_B2_*` ayarları kabul edilir; depolama taşınacaksa dosyalar ve kayıtlı konum birlikte taşınmalıdır.

Temizlik yalnızca tam eşleşen dosya anahtarının bütün sürümlerini ve silme işaretlerini kaldırır. `VersionId` olmadan silme B2'de yalnızca silme işareti eklediğinden kalıcı silmede sürüm kimliği kullanılır. [Backblaze silme davranışı](https://www.backblaze.com/apidocs/s3-delete-object). Anahtarın yalnızca destek bucket'ında `listFiles`, `readFiles`, `writeFiles` ve `deleteFiles` yetkileri olmalıdır. Object Lock veya yetersiz izin silmeyi engellerse kayıt yeniden deneme için saklanır; koruma aşılmaz.

`20261006120000_track_support_image_lifecycle` migration'ı mevcut görselleri kaydeder ve tetikleyicileri kurar; B2'ye istek göndermez. Görsel yükleme trafiğini durdurup migration'ı uyguladıktan sonra yeni backend sürümünü başlatın. `db push` tetikleyicileri kurmaz; migration kullanılmalıdır. Önceden veritabanı kaydı silinmiş sahipsiz dosyalar bu migration ile tespit edilemez; bunlar ayrıca bucket envanteriyle değerlendirilmelidir. Bucket lifecycle kuralları ek güvence olarak kullanılabilir, ancak bağlı görselleri yaşa göre otomatik silen kurallar kullanılmamalıdır.

## Faturalandırma operasyon kayıtları

Faturalandırma kuyruğundaki ayrı günlük temizlik işi aşağıdaki sabit politikayı uygular:

| Kayıt | Saklama süresi | Temizlik koşulu |
| --- | ---: | --- |
| Paddle webhook olay kimlikleri | 180 gün | `processedAt` süresi dolmuşsa |
| İptal edilmiş/başarısız checkout kayıtları | 90 gün | Aboneliğe bağlanmamış ve `updatedAt` süresi dolmuşsa |
| Süresi geçmiş plan önizlemeleri | 1 gün ek süre | Durum `PREVIEWED` ve `expiresAt` süresi dolmuşsa |
| Başarısız plan değişiklikleri | 90 gün | Durum `FAILED` ve `updatedAt` süresi dolmuşsa |
| Tamamlanmış plan değişiklikleri | 365 gün | Durum `COMPLETED` ve `updatedAt` süresi dolmuşsa |
| Paddle transaction referansları | 730 gün | Son eşleşmenin `updatedAt` süresi dolmuşsa |

Transaction referanslarında kart, tutar, adres veya ham webhook içeriği tutulmaz; yalnızca admin araması için müşteri hesabı, ortam ve Paddle kimlikleri saklanır.

## E-posta olay kayıtları

Senkronizasyon/kanal ve AI taslak/cevap gönderim e-posta olayları, kapanış e-postası işlemi tamamlandıktan 90 gün sonra ilişkili teslimat kayıtlarıyla birlikte temizlenir. Açık olaylar ve kapanış işlemi bekleyenler saklanır. Temizlik, bildirim e-postası kuyruğunun periyodik kontrolünde yapılır.

Resend teslimat kayıtları, sağlayıcının kabul kimliği ve son gönderim sonucu ile birlikte terminal duruma geçtikten 90 gün sonra temizlenir. Bekleyen kaydın e-posta içeriği yalnızca güvenli tekrar deneme için tutulur; başarılı, kalıcı başarısız veya manuel inceleme gerektiren sonuca ulaşıldığında içerik silinir. Sonucu belirsiz kayıtlar Resend idempotency süresi dolduktan sonra otomatik yeniden gönderilmez.

## Kapsam dışında kalanlar

- Fatura, ödeme, abonelik ve kullanım muhasebesi kayıtları bu temizlik işi tarafından silinmez. Billing operasyon kayıtlarının ayrı saklama politikası vardır.
- Ürünler, sorular, cevaplar ve AI taslak geçmişi bu politikaya dahil değildir.
- Veritabanı yedeklerinin saklama süresi altyapı sağlayıcısında ayrıca belirlenmelidir.

## Ortam değişkenleri

Süreler production ihtiyacına göre aşağıdaki değişkenlerle gün cinsinden değiştirilebilir:

- `DATA_RETENTION_AUDIT_LOG_DAYS`
- `DATA_RETENTION_COMPLETED_SYNC_RUN_DAYS`
- `DATA_RETENTION_FAILED_SYNC_RUN_DAYS`
- `DATA_RETENTION_RESOLVED_SUPPORT_TICKET_DAYS`
- `DATA_RETENTION_CLOSED_SUPPORT_TICKET_DAYS`
- `DATA_RETENTION_ARCHIVED_CONTACT_MESSAGE_DAYS`
- `DATA_RETENTION_CLEANUP_INTERVAL_MS`

Yasal veya sözleşmesel bir saklama zorunluluğu varsa production öncesinde bu değerler ve yedekleme politikası birlikte gözden geçirilmelidir.
