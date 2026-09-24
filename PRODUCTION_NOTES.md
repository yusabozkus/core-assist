# Production Notes

Bu dosya, Core Asistan production ortamına alınmadan önce tamamlanması gereken işleri takip eder.

## Production alan adları

- Web uygulaması: `https://coreasistan.com`
- Backend API: `https://api.coreasistan.com`
- Google callback: `https://api.coreasistan.com/api/auth/callback/google`
- Microsoft callback: `https://api.coreasistan.com/api/auth/callback/microsoft`

## Harici servislerde marka adı

- [ ] Paddle ürün ve fiyat adlarını `Core Asistan Starter`, `Core Asistan Growth` ve `Core Asistan Business` olarak güncelle.
- [ ] Google OAuth izin ekranındaki uygulama adını `Core Asistan` yap ve production callback adresini ekle.
- [ ] Microsoft Entra uygulama adını `Core Asistan` yap ve production callback adresini ekle.
- [ ] Resend gönderici domainini `coreasistan.com` olarak doğrula; gönderici adını `Core Asistan` yap.

## Ekip davetleri

- [x] Ekip daveti oluşturulduğunda kullanıcıya Resend üzerinden otomatik davet e-postası gönder.
- [x] E-postada hesap adı, verilen rol, erişilebilen mağazalar, son kullanma tarihi ve kabul bağlantısı yer alsın.
- [x] Davet token'ını veritabanında yalnızca hash olarak, bekleyen e-posta içeriğinde şifreli olarak sakla; loglama.
- [x] Davet bağlantısını `FRONTEND_URL` üzerinden oluştur; production ortamında HTTPS kullan.
- [x] Teslimatı idempotent kaydet ve geçici Resend hatalarını yeniden dene.
- [x] Gönderim durumunu ekip ekranında göster; başarısızlıkta daveti koru ve yeniden gönderme sun.

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
