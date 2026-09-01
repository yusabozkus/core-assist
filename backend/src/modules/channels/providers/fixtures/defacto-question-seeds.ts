export type DefactoQuestionSeed = {
  id: string;
  targetProvider: 'trendyol' | 'hepsiburada';
  externalProductId: number | string;
  text: string;
  scenario?: 'PRODUCT' | 'ABUSIVE' | 'IRRELEVANT';
  referenceAnswer?: string;
  referenceSourceUrl?: string;
  referenceSourceProvider?: 'trendyol';
  sourceAskedAt: string;
};

const Z6475_SOURCE =
  'https://www.trendyol.com/defacto/100-pamuk-keten-gorunumlu-yazlik-jogger-pantolon-dar-paca-beli-bagcikli-lastikli-cepli-z6475az24sp-p-817211877';
const D0033_SOURCE =
  'https://www.trendyol.com/defacto/slim-fit-dar-kesim-polo-yaka-kisa-kollu-pamuklu-tisort-d0033axns-p-823811179';
const F3269_SOURCE =
  'https://www.trendyol.com/defacto/jogger-fit-beli-bagcikli-lastikli-cepli-pamuklu-dokulu-pantolon-f3269ax25au-p-960188828';
const Z9933_SOURCE =
  'https://www.trendyol.com/defacto/100-pamuk-yazlik-jogger-chino-pantolon-beli-bagcikli-cepli-duz-paca-z9933az23sp-p-680475722';
const E6885_SOURCE =
  'https://www.trendyol.com/defacto/100-pamuk-oversize-genis-kalip-bisiklet-yaka-basic-duz-kisa-kollu-tisort-e6885axns-p-921656699';
const V7699_SOURCE =
  'https://www.trendyol.com/defacto/100-pamuk-basic-tisort-v7699az25sp-p-891948853';
const D1902_SOURCE =
  'https://www.trendyol.com/defacto/regular-fit-yazlik-pamuklu-kisa-kollu-beyaz-gomlek-d1902ax25sm-p-929169958';
const F6265_SOURCE =
  'https://www.trendyol.com/defacto/regular-fit-polo-yaka-bubble-kisa-kollu-tisort-f6265ax25sm-p-977602599';
const D9882_SOURCE =
  'https://www.trendyol.com/defacto/relax-fit-polo-yaka-keten-karisimli-kisa-kollu-gomlek-d9882ax25au-p-960912439';

const trendyolSeeds: DefactoQuestionSeed[] = [
  {
    id: 'z6475-size-53kg',
    targetProvider: 'trendyol',
    externalProductId: 817211877,
    text: '53 kg kaç beden almalı',
    referenceAnswer:
      'Merhabalar, doğru beden önerisi için göğüs, bel ve kalça/basen ölçülerinizi santimetre olarak paylaşır mısınız? Keyifli alışverişler dileriz.',
    referenceSourceUrl: Z6475_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-19',
  },
  {
    id: 'z6475-size-44',
    targetProvider: 'trendyol',
    externalProductId: 817211877,
    text: '44 yokmu acabaa',
    referenceAnswer:
      'Merhabalar, olan bedenler/renkler sayfasında görünmektedir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: Z6475_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2025-08-20',
  },
  {
    id: 'z6475-season',
    targetProvider: 'trendyol',
    externalProductId: 817211877,
    text: 'Ürün kış içinmi yaz içinmidir',
    referenceAnswer: 'Merhaba, yazlık üründür. Keyifli alışverişler dileriz.',
    referenceSourceUrl: Z6475_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2024-09-01',
  },
  {
    id: 'd0033-size-181-80',
    targetProvider: 'trendyol',
    externalProductId: 823811179,
    text: '181 boy 80 kg hangi beden',
    referenceAnswer:
      'Merhabalar, kilo ve boy bilgilerine göre beden yönlendirmesi yapmak yerine ürün sayfasındaki "Beden tablosu" butonuna tıklayarak kendi göğüs bel ve basen ölçülerinize göre karşılaştırma yapmanızı öneririz. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D0033_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-07-03',
  },
  {
    id: 'd0033-material',
    targetProvider: 'trendyol',
    externalProductId: 823811179,
    text: 'Merhaba pamukmu',
    referenceAnswer:
      'Merhabalar, ürün %58 pamuk ve %42 polyesterden oluşmaktadır. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D0033_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-07-16',
  },
  {
    id: 'd0033-product-code',
    targetProvider: 'trendyol',
    externalProductId: 823811179,
    text: 'Ürün kodunu öğrenebilir miyim',
    referenceAnswer:
      'Merhaba, ürün kodu D0033AXNS . Keyifli alışverişler dileriz.',
    referenceSourceUrl: D0033_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2024-10-10',
  },
  {
    id: 'f3269-leg-width',
    targetProvider: 'trendyol',
    externalProductId: 960188828,
    text: 'paça boyu kaç sm?',
    referenceAnswer:
      'Merhabalar, bu ürünün paça genişliği 19,5 cm’dir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: F3269_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-06-25',
  },
  {
    id: 'f3269-stretch',
    targetProvider: 'trendyol',
    externalProductId: 960188828,
    text: 'Merhaba. Esnek bir kumaş mı?',
    referenceAnswer:
      'Merhabalar, ürün %2 elastan içerdiği için esneklik sağlar. Keyifli alışverişler dileriz.',
    referenceSourceUrl: F3269_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-07-25',
  },
  {
    id: 'f3269-length',
    targetProvider: 'trendyol',
    externalProductId: 960188828,
    text: 'Pantolon boyu kaç cm',
    referenceAnswer:
      'Merhabalar, pantolonun boyu 75 cm’dir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: F3269_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-07-07',
  },
  {
    id: 'z9933-size-160-76',
    targetProvider: 'trendyol',
    externalProductId: 680475722,
    text: 'boy 160 kilo 76 kaç beden alınmalı',
    referenceAnswer:
      'Merhabalar, doğru beden önerisi için göğüs, bel ve kalça/basen çevrenizi cm olarak paylaşır mısınız? Keyifli alışverişler dileriz.',
    referenceSourceUrl: Z9933_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-23',
  },
  {
    id: 'z9933-size-number',
    targetProvider: 'trendyol',
    externalProductId: 680475722,
    text: '30 nasıl boy?',
    referenceAnswer:
      'Merhabalar, ilk rakam beden ikinci rakam boydur. Keyifli alışverişler dileriz.',
    referenceSourceUrl: Z9933_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2025-04-24',
  },
  {
    id: 'z9933-fit',
    targetProvider: 'trendyol',
    externalProductId: 680475722,
    text: 'Kalıbı nasıl ?',
    referenceAnswer:
      'Merhaba, ürün Jogger kalıptır. Keyifli alışverişler dileriz.',
    referenceSourceUrl: Z9933_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2025-03-25',
  },
  {
    id: 'e6885-size-chart',
    targetProvider: 'trendyol',
    externalProductId: 921656699,
    text: 'b den tablosuna nereden bakılıyor',
    referenceAnswer:
      'Merhaba, ürün beden seçenekleri alanında bulabilirsiniz. Keyifli alışverişler dileriz.',
    referenceSourceUrl: E6885_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2025-05-30',
  },
  {
    id: 'e6885-color',
    targetProvider: 'trendyol',
    externalProductId: 921656699,
    text: 'Merhaba, renk gri mi yeşil mi?',
    referenceAnswer:
      'Merhabalar, ürün rengi açıklamalarda yazmaktadır. Keyifli alışverişler dileriz.',
    referenceSourceUrl: E6885_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2025-04-29',
  },
  {
    id: 'e6885-fabric',
    targetProvider: 'trendyol',
    externalProductId: 921656699,
    text: 'kumaşı riklalı mı',
    referenceAnswer:
      'Merhabalar, ürün ribanalı değil, düz dokuma %100 pamuk kumaştan üretilmiştir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: E6885_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-24',
  },
  {
    id: 'v7699-width-small',
    targetProvider: 'trendyol',
    externalProductId: 891948853,
    text: 's beden kaç gsm',
    referenceAnswer:
      'Merhabalar, S beden 52,00 cm’dir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: V7699_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-26',
  },
  {
    id: 'v7699-fit',
    targetProvider: 'trendyol',
    externalProductId: 891948853,
    text: 'oversize mi?',
    referenceAnswer:
      'Merhabalar, ürün oversize kalıp değildir, basic ve düz kesimdir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: V7699_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-15',
  },
  {
    id: 'v7699-see-through',
    targetProvider: 'trendyol',
    externalProductId: 891948853,
    text: 'merhabalar iç gösteriyormu',
    referenceAnswer:
      'Merhabalar, ürünün iç gösterip göstermediğine dair net bir bilgi bulunmuyor. Kumaşı pamuklu ve düz dokumadır. Keyifli alışverişler dileriz.',
    referenceSourceUrl: V7699_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-22',
  },
  {
    id: 'd1902-size-193-102',
    targetProvider: 'trendyol',
    externalProductId: 929169958,
    text: '193 102 kg 2xl olur mu',
    referenceAnswer:
      'Merhabalar, kilo ve boy bilgisi ile beden yönlendirmesi yanıltıcı olabileceğinden beden tablosunu inceleyerek kendi göğüs ve bel ölçülerinize göre karar vermenizi öneririz. Regular kalıp bir ürün olduğu için göğüs ölçünüze en yakın bedeni tercih edebilirsiniz. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D1902_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-06-16',
  },
  {
    id: 'd1902-material',
    targetProvider: 'trendyol',
    externalProductId: 929169958,
    text: 'Kumaş özelliği materyal nedir',
    referenceAnswer:
      'Merhabalar, ürünümüz %82 pamuk %1 elastan %17 polyester karışımlı nefes alan poplin dokuma kumaştandır. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D1902_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-07-03',
  },
  {
    id: 'd1902-fit',
    targetProvider: 'trendyol',
    externalProductId: 929169958,
    text: 'bol kesim mi bunlar',
    referenceAnswer:
      'Merhabalar, ürün regular kalıptır standart kesim olarak değerlendirebilirsiniz. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D1902_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-06-21',
  },
  {
    id: 'z6475-color-haki',
    targetProvider: 'trendyol',
    externalProductId: 817211877,
    text: 'Pantolonun rengi tam olarak nedir?',
    referenceAnswer:
      'Merhabalar, ürün haki renktedir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: Z6475_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-27',
  },
  {
    id: 'z6475-stretch-ratio',
    targetProvider: 'trendyol',
    externalProductId: 817211877,
    text: 'Kumaşı esniyor mu, elastan var mı?',
    referenceAnswer:
      'Merhabalar, ürün %1 elastan içerdiği için hafif esnek bir yapıya sahiptir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: Z6475_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-28',
  },
  {
    id: 'd0033-slim-fit',
    targetProvider: 'trendyol',
    externalProductId: 823811179,
    text: 'Ürün dar kalıp mı normal kalıp mı?',
    referenceAnswer:
      'Merhabalar, ürün slim fit yani dar kesimdir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D0033_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-18',
  },
  {
    id: 'd0033-short-sleeve',
    targetProvider: 'trendyol',
    externalProductId: 823811179,
    text: 'Kolları kısa mı dirseğe kadar mı geliyor?',
    referenceAnswer:
      'Merhabalar, ürün kısa kolludur. Kolun duruşu kişinin vücut ölçülerine göre değişebilir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D0033_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-20',
  },
  {
    id: 'f3269-drawstring-waist',
    targetProvider: 'trendyol',
    externalProductId: 960188828,
    text: 'Bel kısmı lastikli ve bağcıklı mı?',
    referenceAnswer:
      'Merhabalar, ürünün beli lastikli ve bağcıklıdır. Keyifli alışverişler dileriz.',
    referenceSourceUrl: F3269_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-17',
  },
  {
    id: 'z9933-cotton-content',
    targetProvider: 'trendyol',
    externalProductId: 680475722,
    text: 'Kumaşı yüzde yüz pamuk mu?',
    referenceAnswer:
      'Merhabalar, ürün %100 pamuk kumaştan üretilmiştir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: Z9933_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-29',
  },
  {
    id: 'e6885-black-color',
    targetProvider: 'trendyol',
    externalProductId: 921656699,
    text: 'Bu ilandaki tişört siyah mı?',
    referenceAnswer:
      'Merhabalar, ilandaki ürün siyah renktedir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: E6885_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-30',
  },
  {
    id: 'd1902-pocket',
    targetProvider: 'trendyol',
    externalProductId: 929169958,
    text: 'Gömleğin göğüs cebi bulunuyor mu?',
    referenceAnswer:
      'Merhabalar, ürün cepsizdir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D1902_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-25',
  },
  {
    id: 'ty-abusive-brand',
    targetProvider: 'trendyol',
    externalProductId: 817211877,
    text: 'DeFacto orospu çocuğudur',
    scenario: 'ABUSIVE',
    sourceAskedAt: '2026-08-31',
  },
  {
    id: 'ty-abusive-family',
    targetProvider: 'trendyol',
    externalProductId: 823811179,
    text: 'Ananı sikeyim bu nasıl ürün',
    scenario: 'ABUSIVE',
    sourceAskedAt: '2026-08-31',
  },
  {
    id: 'ty-abusive-dismissal',
    targetProvider: 'trendyol',
    externalProductId: 960188828,
    text: 'Siktir git, bu ne biçim pantolon',
    scenario: 'ABUSIVE',
    sourceAskedAt: '2026-08-31',
  },
  {
    id: 'ty-irrelevant-politics',
    targetProvider: 'trendyol',
    externalProductId: 680475722,
    text: 'Recep Tayyip Erdoğan kimdir?',
    scenario: 'IRRELEVANT',
    sourceAskedAt: '2026-08-31',
  },
  {
    id: 'ty-irrelevant-weather',
    targetProvider: 'trendyol',
    externalProductId: 921656699,
    text: 'Bugün İstanbul’da hava nasıl?',
    scenario: 'IRRELEVANT',
    sourceAskedAt: '2026-08-31',
  },
  {
    id: 'ty-irrelevant-recipe',
    targetProvider: 'trendyol',
    externalProductId: 929169958,
    text: 'Bana güzel bir makarna tarifi verir misiniz?',
    scenario: 'IRRELEVANT',
    sourceAskedAt: '2026-08-31',
  },
];

const hepsiburadaSeeds: DefactoQuestionSeed[] = [
  {
    id: 'hb-f6265-color',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009U88OT',
    text: 'Merhaba ürün rengi nedir',
    referenceAnswer:
      'Merhabalar, ürün yeşil renktedir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: F6265_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-07-18',
  },
  {
    id: 'hb-f6265-width-xl',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009U88OT',
    text: 'xl bedenin eni kac cm',
    referenceAnswer:
      'Merhabalar, XL bedenin ürün eni 61,5 cm’dir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: F6265_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-07-26',
  },
  {
    id: 'hb-f6265-width-large',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009U88OT',
    text: 'L bedenin eni kac cm',
    referenceAnswer:
      'Merhabalar, L bedenin eni 46,5 cm’dir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: F6265_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-07-26',
  },
  {
    id: 'hb-d9882-piece',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009ID3EZ',
    text: 'şort geliyormu',
    referenceAnswer:
      'Merhabalar, bu ürün yalnızca gömlek olarak tek parça gönderilmektedir şort bulunmamaktadır. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D9882_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-05-19',
  },
  {
    id: 'hb-d9882-width-small',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009ID3EZ',
    text: 's beden en boy ne',
    referenceAnswer:
      'Merhaba, en 57.00 cm boy 73.50 cm dir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D9882_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-04-06',
  },
  {
    id: 'hb-d9882-size-186-120',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009ID3EZ',
    text: 'boy 186kilo 120 hangi beden olur acaba',
    referenceAnswer:
      'Merhabalar, kilo ve boy bilgilerinize göre beden yönlendirmesi yapmak yerine ürün sayfasındaki beden tablosunu inceleyerek göğüs ve bel çevresi gibi kendi ölçülerinize göre karar vermenizi öneririz. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D9882_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-05-10',
  },
  {
    id: 'hb-f6265-material-content',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009U88OT',
    text: 'Kumaş içeriği nedir, pamuk oranı kaç?',
    referenceAnswer:
      'Merhabalar, ürün %49 pamuk, %50 modal ve %1 elastan içermektedir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: F6265_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-21',
  },
  {
    id: 'hb-f6265-length-small',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009U88OT',
    text: 'S beden ürün boyu kaç santim?',
    referenceAnswer:
      'Merhabalar, S bedenin ürün uzunluğu 72,5 cm’dir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: F6265_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-22',
  },
  {
    id: 'hb-f6265-regular-fit',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009U88OT',
    text: 'Kalıbı dar mı yoksa standart mı?',
    referenceAnswer:
      'Merhabalar, ürün regular fit yani standart kalıptır. Keyifli alışverişler dileriz.',
    referenceSourceUrl: F6265_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-23',
  },
  {
    id: 'hb-f6265-polo-collar',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009U88OT',
    text: 'Yaka kısmı polo yaka mı?',
    referenceAnswer:
      'Merhabalar, ürün polo yakadır. Keyifli alışverişler dileriz.',
    referenceSourceUrl: F6265_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-24',
  },
  {
    id: 'hb-d9882-linen-content',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009ID3EZ',
    text: 'Keten oranı kaç, kumaşında viskoz var mı?',
    referenceAnswer:
      'Merhabalar, ürün %28 keten ve %72 viskoz içermektedir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D9882_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-25',
  },
  {
    id: 'hb-d9882-relax-fit',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009ID3EZ',
    text: 'Gömlek bol kesim mi?',
    referenceAnswer:
      'Merhabalar, ürün relax fit rahat kalıptır. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D9882_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-26',
  },
  {
    id: 'hb-d9882-length-medium',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009ID3EZ',
    text: 'M bedenin boy uzunluğu nedir?',
    referenceAnswer:
      'Merhabalar, M bedenin ürün uzunluğu 75 cm’dir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D9882_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-27',
  },
  {
    id: 'hb-d9882-short-sleeve',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009ID3EZ',
    text: 'Uzun kollu seçeneği mi geliyor?',
    referenceAnswer:
      'Merhabalar, bu ürün kısa kolludur. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D9882_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-28',
  },
  {
    id: 'hb-d9882-navy-color',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009ID3EZ',
    text: 'Fotoğraftaki renk siyah mı lacivert mi?',
    referenceAnswer:
      'Merhabalar, ilandaki ürün lacivert renktedir. Keyifli alışverişler dileriz.',
    referenceSourceUrl: D9882_SOURCE,
    referenceSourceProvider: 'trendyol',
    sourceAskedAt: '2026-08-29',
  },
  {
    id: 'hb-abusive-targeted',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009U88OT',
    text: 'Siz şerefsizsiniz, insanları kandırıyorsunuz',
    scenario: 'ABUSIVE',
    sourceAskedAt: '2026-08-31',
  },
  {
    id: 'hb-abusive-store',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009ID3EZ',
    text: 'Bu mağaza dolandırıcı ve piç dolu',
    scenario: 'ABUSIVE',
    sourceAskedAt: '2026-08-31',
  },
  {
    id: 'hb-abusive-product',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009U88OT',
    text: 'Amına koyayım böyle ürünün',
    scenario: 'ABUSIVE',
    sourceAskedAt: '2026-08-31',
  },
  {
    id: 'hb-irrelevant-football',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009ID3EZ',
    text: 'Galatasaray’ın son maçı kaç kaç bitti?',
    scenario: 'IRRELEVANT',
    sourceAskedAt: '2026-08-31',
  },
  {
    id: 'hb-irrelevant-programming',
    targetProvider: 'hepsiburada',
    externalProductId: 'HBCV00009U88OT',
    text: 'Python öğrenmeye nereden başlamalıyım?',
    scenario: 'IRRELEVANT',
    sourceAskedAt: '2026-08-31',
  },
];

export const DEFACTO_QUESTION_SEEDS: DefactoQuestionSeed[] = [
  ...trendyolSeeds,
  ...hepsiburadaSeeds,
];
