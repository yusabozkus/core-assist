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

Destek talebi silindiğinde ona bağlı mesajlar ilişkisel olarak silinir. Açık, işlemde veya müşteri yanıtı bekleyen destek talepleri temizlenmez. Çalışan senkronizasyonlar temizlenmez.

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
- `DATA_RETENTION_CLEANUP_INTERVAL_MS`

Yasal veya sözleşmesel bir saklama zorunluluğu varsa production öncesinde bu değerler ve yedekleme politikası birlikte gözden geçirilmelidir.
