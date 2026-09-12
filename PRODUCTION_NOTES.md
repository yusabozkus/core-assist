# Production Notes

Bu dosya, CoreAssist production ortamına alınmadan önce tamamlanması gereken işleri takip eder.

## Ekip davetleri

- [ ] Ekip daveti oluşturulduğunda kullanıcıya otomatik davet e-postası gönder.
- [ ] E-posta sağlayıcısı olarak Resend değerlendirilebilir.
- [ ] E-postada davet eden çalışma alanı, verilen rol, erişilebilen mağazalar, son kullanma tarihi ve tek kullanımlık kabul bağlantısı yer alsın.
- [ ] Davet token'ı e-postaya yalnızca kabul bağlantısı içinde eklensin; loglarda veya veritabanında açık biçimde saklanmasın.
- [ ] Production uygulama adresi ortam değişkeninden alınsın ve davet bağlantısı bu adres üzerinden oluşturulsun.
- [ ] E-posta gönderimi tekrar denemeye uygun ve idempotent olsun; aynı davet için yanlışlıkla birden fazla e-posta gönderilmesin.
- [ ] Gönderim başarısız olduğunda davet kaydı korunarak ekip ekranında hata ve yeniden gönderme seçeneği sunulsun.

## Rol bazlı e-posta bildirimleri

Yalnızca önemli, işlem gerektiren veya güvenlikle ilgili olaylar e-posta olarak gönderilmelidir. Sık gerçekleşen operasyonel olaylar tek tek gönderilmemeli; tercihe bağlı veya özet olmalıdır.

| Olay | Alıcılar | Gönderim şekli |
| --- | --- | --- |
| Davet oluşturuldu | Davet edilen kişi | Anında ve zorunlu |
| Davet kabul edildi | Hesap sahibi ve daveti oluşturan yönetici | Anında |
| Rol veya mağaza erişimi değişti | Yetkisi değişen kullanıcı | Anında ve zorunlu |
| Üye ekipten çıkarıldı | Çıkarılan kullanıcı | Anında ve zorunlu |
| Ödeme başarısız oldu, abonelik veya plan değişti | Hesap sahibi ve hesap yöneticileri | Anında ve zorunlu |
| Fatura veya iade oluştu | Hesap sahibi ve hesap yöneticileri | Anında |
| AI kotası `%80`, `%95` veya `%100` oldu | Hesap sahibi ve hesap yöneticileri | Her eşikte bir kez |
| Kanal bağlantısı koptu | İlgili mağaza yöneticileri ve hesap yöneticileri | Anında |
| Ürün veya soru senkronizasyonu tekrar tekrar başarısız oldu | İlgili mağaza yöneticileri | Hata eşiği aşıldığında |
| Otomatik yanıt gönderilemedi veya otomasyon durdu | İlgili mağaza yöneticileri ve temsilciler | Anında |
| İnceleme bekleyen sorular birikti | İlgili mağaza yöneticileri ve temsilciler | Günlük özet |
| Düşük veya tükenen stok | İlgili mağaza yöneticileri | Tercihe bağlı özet |
| Yeni cihazdan giriş veya giriş sağlayıcısı değişikliği | İlgili kullanıcı | Anında ve zorunlu |
| Hesap silme talebi | İlgili kullanıcı ve hesap sahibi | Anında ve zorunlu |

### Teslimat kuralları

- [ ] Backend'de merkezi bir `olay -> alıcı rolleri` politikası oluştur.
- [ ] `createForStoreMembers` ile tüm mağaza üyelerine yayın yapmak yerine rol ve mağaza erişimine göre alıcı seç.
- [ ] Hesap sahibi finans, güvenlik, ekip ve kritik operasyon e-postalarını alsın.
- [ ] Hesap yöneticileri finans, ekip ve tüm mağazaların kritik bildirimlerini alsın.
- [ ] Mağaza yöneticileri ve temsilciler yalnızca erişebildikleri mağazalarla ilgili e-postaları alsın.
- [ ] Görüntüleyicilere varsayılan olarak operasyonel e-posta gönderme.
- [ ] Finans ve güvenlik e-postaları kapatılamasın; stok, AI ve senkronizasyon e-postaları kullanıcı tercihine bağlı olsun.
- [ ] Aynı olay için mükerrer gönderimi engelle; yoğun bildirimlerde hız sınırı ve günlük özet kullan.
