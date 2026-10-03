import type { MockProductSeed } from '../mock-catalog.connector';
import { TRENDYOL_DEFACTO_PRODUCT_SEEDS } from './trendyol-defacto-product-seeds';
import { HEPSIBURADA_DEFACTO_PRODUCT_SEEDS } from './hepsiburada-defacto-product-seeds';
import { HEPSIBURADA_QUESTION_PRODUCT_SEEDS } from './hepsiburada-question-product-seeds';

// Customer wording is copied from public DeFacto product Q&A pages, not invented.
// Older entries retain their original asked dates; newer Hepsiburada pages do not
// expose a reliable year, so those dates are deliberately left unset.
export type DefactoQuestionSeed = {
  id: string;
  targetProvider: 'trendyol' | 'hepsiburada';
  externalProductId: number | string;
  text: string;
  sourceUrl: string;
  sourceAskedAt?: string;
  learningPair?: string;
  scenario?: 'PRODUCT' | 'ABUSIVE' | 'IRRELEVANT';
};

type QuestionRow = [
  id: string,
  externalProductId: number | string,
  text: string,
  sourceAskedAt: string | null,
  learningPair?: string,
];

const trendyolRows: QuestionRow[] = [
  ['z6475-size-53kg', 817211877, '53 kg kaç beden almalı', '2026-08-19'],
  ['z6475-size-44', 817211877, '44 yokmu acabaa', '2025-08-20'],
  ['z6475-season', 817211877, 'Ürün kış içinmi yaz içinmidir', '2024-09-01'],
  ['d0033-size-181-80', 823811179, '181 boy 80 kg hangi beden', '2026-07-03'],
  ['d0033-material', 823811179, 'Merhaba pamukmu', '2026-07-16'],
  [
    'd0033-product-code',
    823811179,
    'Ürün kodunu öğrenebilir miyim',
    '2024-10-10',
  ],
  ['f3269-leg-width', 960188828, 'paça boyu kaç sm?', '2026-06-25'],
  ['f3269-stretch', 960188828, 'Merhaba. Esnek bir kumaş mı?', '2026-07-25'],
  ['f3269-length', 960188828, 'Pantolon boyu kaç cm', '2026-07-07'],
  [
    'z9933-size-160-76',
    680475722,
    'boy 160 kilo 76 kaç beden alınmalı',
    '2026-08-23',
  ],
  ['z9933-size-number', 680475722, '30 nasıl boy?', '2025-04-24'],
  ['z9933-fit', 680475722, 'Kalıbı nasıl ?', '2025-03-25'],
  [
    'e6885-size-chart',
    921656699,
    'b den tablosuna nereden bakılıyor',
    '2025-05-30',
  ],
  ['e6885-color', 921656699, 'Merhaba, renk gri mi yeşil mi?', '2025-04-29'],
  ['e6885-fabric', 921656699, 'kumaşı riklalı mı', '2026-08-24'],
  ['v7699-width-small', 891948853, 's beden kaç gsm', '2026-08-26'],
  ['v7699-fit', 891948853, 'oversize mi?', '2026-08-15'],
  ['v7699-see-through', 891948853, 'merhabalar iç gösteriyormu', '2026-08-22'],
  ['d1902-size-193-102', 929169958, '193 102 kg 2xl olur mu', '2026-06-16'],
  ['d1902-material', 929169958, 'Kumaş özelliği materyal nedir', '2026-07-03'],
  ['d1902-fit', 929169958, 'bol kesim mi bunlar', '2026-06-21'],
  [
    'ty-1081939820-1',
    1081939820,
    'Merhaba kolay gelsin Kalın mı ince midir yazın giyilir mi teşekkür ederim',
    '2026-04-12',
    'ty-denim-thickness',
  ],
  [
    'ty-1081939820-2',
    1081939820,
    'pantolon ince mi kalın mı yada orta kalınlıkta mı',
    '2026-06-05',
    'ty-denim-thickness',
  ],
  ['ty-823811179-1', 823811179, 'hangi kargo', '2025-03-13', 'ty-shipping'],
  [
    'ty-823811179-6',
    823811179,
    'Hangi kargo ile gonderiliyor',
    '2026-02-19',
    'ty-shipping',
  ],
  [
    'ty-1014324580-2',
    1014324580,
    'Salvar qalindirmi?',
    '2025-11-02',
    'ty-winter',
  ],
  [
    'ty-1014324580-3',
    1014324580,
    'Yazın giyilir mi?',
    '2026-08-23',
    'ty-winter',
  ],
  [
    'ty-1147032234-1',
    1147032234,
    '183 kilo 120 kaç beden almaliyim',
    '2026-06-12',
  ],
  ['ty-836261763-1', 836261763, 'Xl göğüs genişliği nedir', '2024-07-22'],
  [
    'ty-1105220038-1',
    1105220038,
    'manken bilgileri nedir 180 70 kiloya hangi beden alınmalı',
    '2026-08-23',
  ],
  [
    'ty-960188828-1',
    960188828,
    'xl pantolon bedenine kaç beden almam lazim',
    '2026-09-04',
  ],
  ['ty-891948853-1', 891948853, 'boy 168 kilo 68', '2026-08-30'],
  ['ty-922840969-1', 922840969, 'kalibi nasil', '2025-07-28'],
  ['ty-1081939777-1', 1081939777, 'beden tablosu yok', '2026-06-21'],
  ['ty-1014324580-1', 1014324580, 'Göğüs 108 bel 100', '2026-08-23'],
  ['ty-926386099-1', 926386099, 'iç gösteriyor mu', '2026-06-10'],
  ['ty-1106919141-1', 1106919141, 'üzerine isim yazıyor musunuz', '2026-04-10'],
  [
    'ty-1123939308-1',
    1123939308,
    'L bedenin göğüs eni və yukarıdan aşağı uzunluğu kaç santim?',
    '2026-07-01',
  ],
  ['ty-943255798-1', 943255798, '105 kilo 1.70 boy hangi beden', '2026-08-20'],
  ['ty-823811179-2', 823811179, '170 cm 85 kilo hangi beden', '2026-09-02'],
  [
    'ty-1147032234-2',
    1147032234,
    '176 boy 150 kg regular fıt de 3xl giyiyorum bu kalıpda hangi bedeni seçmem lazım?',
    '2026-08-29',
  ],
  ['ty-836261763-2', 836261763, 'yuzde kac pamuk', '2024-08-16'],
  ['ty-680475722-2', 680475722, '110 , 105, 61 göğüs bel basen', '2026-08-14'],
  ['ty-921303598-2', 921303598, 'Çekme yapar mı', '2026-07-23'],
  ['ty-922840969-2', 922840969, 'rengi mont yeşilimi çağlamı', '2025-07-05'],
  ['ty-1081939777-2', 1081939777, 'paça uzunluğu kaç santim', '2026-07-14'],
  ['ty-926386099-2', 926386099, 'Merhaba kumaşı ne?', '2025-05-07'],
  [
    'ty-1123939308-2',
    1123939308,
    'kalıp slim mi yoksa normal mi acaba bedenini ona gore secicem',
    '2026-07-23',
  ],
  ['ty-943255798-2', 943255798, 'M beden en boy nedir', '2025-11-06'],
  [
    'ty-1147032234-3',
    1147032234,
    'merhaba mankenin üzerindeki kaç beden',
    '2026-08-13',
  ],
  ['ty-836261763-3', 836261763, 'Merhaba kolaltı genişmi?', '2026-06-19'],
  ['ty-680475722-3', 680475722, '103/100/108 gogus bel kalca', '2026-08-06'],
  ['ty-921656699-3', 921656699, 'ağır kumaş mı?', '2025-06-28'],
  [
    'ty-1081939820-3',
    1081939820,
    'Merhaba paça genişliği kaç cm acaba ?',
    '2026-04-02',
  ],
  ['ty-921303598-3', 921303598, '75 kilo kaç beden olur', '2026-08-06'],
  ['ty-922840969-3', 922840969, 'mrb hangi kargoya veriyorsunuz', '2025-03-28'],
  [
    'ty-1081939777-3',
    1081939777,
    '30 giyiyorum 29/30 yazanla aynimi',
    '2026-08-06',
  ],
  ['ty-926386099-3', 926386099, 'merhaba hangi kargo', '2025-06-18'],
  ['ty-943255798-3', 943255798, 'S beden en boy nedir', '2025-11-06'],
  ['ty-817211877-4', 817211877, '36 bedenin boy uzunluğu nedir', '2025-09-21'],
];

const hepsiburadaRows: QuestionRow[] = [
  [
    'hb-f6265-color',
    'HBCV00009U88OT',
    'Merhaba ürün rengi nedir',
    '2026-07-18',
  ],
  [
    'hb-f6265-width-xl',
    'HBCV00009U88OT',
    'xl bedenin eni kac cm',
    '2026-07-26',
  ],
  [
    'hb-f6265-width-large',
    'HBCV00009U88OT',
    'L bedenin eni kac cm',
    '2026-07-26',
  ],
  ['hb-d9882-piece', 'HBCV00009ID3EZ', 'şort geliyormu', '2026-05-19'],
  ['hb-d9882-width-small', 'HBCV00009ID3EZ', 's beden en boy ne', '2026-04-06'],
  [
    'hb-d9882-size-186-120',
    'HBCV00009ID3EZ',
    'boy 186kilo 120 hangi beden olur acaba',
    '2026-05-10',
  ],
  [
    'hb-hbcv00009u88ot-1',
    'HBCV00009U88OT',
    'Renk sarı mı gelecek yeşil mi orada yeşil yazıyor da ama görüntü sarı',
    null,
  ],
  ['hb-hbcv00009u88ot-2', 'HBCV00009U88OT', 'kalıbı nasıl', null],
  [
    'hb-hbcv00009u88ot-3',
    'HBCV00009U88OT',
    'ürün çok kirişiyor mu?ütü gerektirir mi?',
    null,
  ],
  [
    'hb-hbcv00009id3ez-1',
    'HBCV00009ID3EZ',
    'bu relax fit modeller pantolon içine sokulmuyor mu',
    null,
  ],
  [
    'hb-hbcv00008sikcu-1',
    'HBCV00008SIKCU',
    'erkek gabardin pantalon 34 beden bacak boyunu ogrenebilirmiyim',
    null,
  ],
  ['hb-hbcv00008sikcu-2', 'HBCV00008SIKCU', 'Ürünün iç bacak boyu nedir', null],
  [
    'hb-hbcv00008bj9m0-1',
    'HBCV00008BJ9M0',
    'iyi günler beyaz rengi iç gösteriyor mu?',
    null,
  ],
  ['hb-hbcv00008bj9m0-2', 'HBCV00008BJ9M0', 'Ürün likralı mı', null],
  [
    'hb-hbcv00008bj9m0-3',
    'HBCV00008BJ9M0',
    'merhaba beli lastikli mi acaba',
    null,
  ],
  [
    'hb-hbcv00008bj9m0-4',
    'HBCV00008BJ9M0',
    '1.86 boy 105kg 38 beden olurmu',
    null,
  ],
  [
    'hb-hbcv00008bj9m0-5',
    'HBCV00008BJ9M0',
    'Boy 1.70 kilo 75 hangi beden alınmalı',
    null,
  ],
  [
    'hb-hbcv00008bj9m0-6',
    'HBCV00008BJ9M0',
    '46 beden kumaş pantolon giyiyorum bunu kaç beden almam gerekli',
    null,
  ],
  ['hb-hbcv00009kp8f4-1', 'HBCV00009KP8F4', 'L beden ölçüleri en ve boy', null],
  ['hb-hbcv00007wi3z3-1', 'HBCV00007WI3Z3', 'ürün çekme yaparmı', null],
  [
    'hb-hbcv00007wi3z3-2',
    'HBCV00007WI3Z3',
    '187 boyunda 90 kilo kaç eden olur',
    null,
  ],
  [
    'hb-hbcv00007wi3z3-3',
    'HBCV00007WI3Z3',
    'Arka çep düğmelimi yani düğme ile kapanıyor mu',
    null,
  ],
  [
    'hb-hbcv00007wi3z3-4',
    'HBCV00007WI3Z3',
    'paça genişliğini öğrenebilir miyim',
    null,
  ],
  [
    'hb-hbcv00007wi3z3-5',
    'HBCV00007WI3Z3',
    'merhaba 34/32 de 32 boy mu?',
    null,
  ],
  [
    'hb-hbcv0000dbvzuz-1',
    'HBCV0000DBVZUZ',
    'ürünün beden ölçülerini alabilir miyim 3xl',
    null,
  ],
  [
    'hb-hbcv0000dbvzuz-2',
    'HBCV0000DBVZUZ',
    'İyi çalışmalar. 6X large bedenin boy göğüs ve diğer ölçülerini alabilir miyim?',
    null,
  ],
  [
    'hb-hbcv0000dbvzuz-3',
    'HBCV0000DBVZUZ',
    'Fotoğrafta eşofman altı var bende bu sebeple sipariş verdim tişört istemiyorum yani',
    null,
  ],
  ['hb-hbcv00007vkpe9-1', 'HBCV00007VKPE9', 'ne renk acaba', null],
  [
    'hb-hbcv00007vkpe9-2',
    'HBCV00007VKPE9',
    'Merhaba Canvas model mi ? Yoksa Jogger mı ?\n\nsormuştum ama cevap alamadığım için yine sormak istedim.',
    null,
  ],
  [
    'hb-hbcv00007vkpe9-3',
    'HBCV00007VKPE9',
    '175 boy, 83 kilo olan birisine hangi bedeni almalıyım',
    null,
  ],
  ['hb-hbcv0000aamhqi-1', 'HBCV0000AAMHQI', 'iç kısmı polar mı', null],
  ['hb-hbcv0000aamhqi-2', 'HBCV0000AAMHQI', 'Kapşonlu tarafı çıkıyor mu', null],
  ['hb-hbcv0000d8y1s4-1', 'HBCV0000D8Y1S4', 'İÇ CEBİ VARMI', null],
  [
    'hb-hbcv0000b3y1cq-1',
    'HBCV0000B3Y1CQ',
    'M beden montun ağırlığı nedir? yani hafif midir?',
    null,
  ],
  [
    'hb-hbcv0000b3y1cq-2',
    'HBCV0000B3Y1CQ',
    'yıkama talimatına nerden ulasabilirz',
    null,
  ],
  [
    'hb-hbcv000087hsh8-1',
    'HBCV000087HSH8',
    'Ürünün 2xl ve 3xl göğüs ölçüsü nedir',
    null,
  ],
  [
    'hb-hbcv000087hsh8-2',
    'HBCV000087HSH8',
    'çekme yaparmi boyu kısalır mı',
    null,
  ],
  [
    'hb-hbcv000087hsh8-3',
    'HBCV000087HSH8',
    'Bedeni Normal tişörtlere göre yani oversize olmayanlara göre boyu kısamı',
    null,
  ],
  [
    'hb-hbcv000087hsh8-4',
    'HBCV000087HSH8',
    'Oversize olmayan basic beyaz tshirt arıyodum içime sinen pek olmadı bunu almayı düşünüyorum 1.78 boyunda 70 kg yim bol olsun istemiyorum üstüme yapışmasınıda istemiyorum hangi beden almalıyım',
    null,
  ],
  [
    'hb-hbcv000087hsh8-5',
    'HBCV000087HSH8',
    'm beden en uzunluğu nedir acaba',
    null,
  ],
  [
    'hb-hbcv000087hsh8-6',
    'HBCV000087HSH8',
    'ürün ölçüleri ile ilgili bilgi alabilir miyim',
    null,
  ],
  [
    'hb-hbcv000087hsh8-7',
    'HBCV000087HSH8',
    'M bedenin boy ölçüsü nedir? Tshirtün uzunluğu?',
    null,
  ],
  [
    'hb-hbcv000087hsh8-8',
    'HBCV000087HSH8',
    'Merhaba ürün kalın kumaş mı ?',
    null,
  ],
  [
    'hb-hbcv000087hsh8-9',
    'HBCV000087HSH8',
    'Kumaş türü nedir % kaç pamuk',
    null,
  ],
  ['hb-hbcv000087hsh8-10', 'HBCV000087HSH8', 'En ve boy ölçüleri nedir?', null],
  ['hb-hbcv00008j0e0v-1', 'HBCV00008J0E0V', 'Merhaba ürün yazlıkmı', null],
  [
    'hb-hbcv00008j0e0v-2',
    'HBCV00008J0E0V',
    'üst beden kaç cm kışlık  yeri kalınmı',
    null,
  ],
  [
    'hb-hbcv00008j0e0v-3',
    'HBCV00008J0E0V',
    'Merhaba alt eşofman boyu kaç cm',
    null,
    'hb-inseam',
  ],
  [
    'hb-hbcv00008j0e0v-4',
    'HBCV00008J0E0V',
    'alt üst ikisi birlikte mi',
    null,
    'hb-two-piece',
  ],
  ['hb-hbcv00008j0e0v-5', 'HBCV00008J0E0V', 'crop mu normal mi', null],
  [
    'hb-hbcv00008j0e0v-6',
    'HBCV00008J0E0V',
    'Ürün erkekler için uygun mu dur?',
    null,
  ],
  ['hb-hbcv00008j0e0v-7', 'HBCV00008J0E0V', 'merhaba içi polardi?', null],
  [
    'hb-hbcv00008j0e0v-8',
    'HBCV00008J0E0V',
    'Merhaba, bu ürün alt üst takım mı?',
    null,
    'hb-two-piece',
  ],
  [
    'hb-hbcv00008j0e0v-9',
    'HBCV00008J0E0V',
    'Alt üst takım mı yoksa 2 adet alt mı? Tam açıklayıcı bir başlık olmamış malesef.',
    null,
  ],
  [
    'hb-hbcv00008j0e0v-10',
    'HBCV00008J0E0V',
    'Alt kısmın boyu kaç cm acaba',
    null,
    'hb-inseam',
  ],
  [
    'hb-hbcv00008j0e0v-11',
    'HBCV00008J0E0V',
    'Merhaba. Ürün makinalarda çekme yapar mı acaba?',
    null,
  ],
  [
    'hb-hbcv00008j0e0v-12',
    'HBCV00008J0E0V',
    'iki iplikmi kumaşı',
    null,
    'hb-knit',
  ],
  [
    'hb-hbcv00008j0e0v-13',
    'HBCV00008J0E0V',
    'merhaba takımın içi pamuklu veya yünlü mü ileride tiftiflenme yapar mı?',
    null,
  ],
  ['hb-hbcv00008j0e0v-14', 'HBCV00008J0E0V', 'içi polarmı', null],
  [
    'hb-hbcv00008j0e0v-15',
    'HBCV00008J0E0V',
    'dokumasi kaç iplik',
    null,
    'hb-knit',
  ],
];

export const DEFACTO_LEARNING_CASES = [
  {
    id: 'ty-denim-thickness',
    provider: 'trendyol',
    answer:
      'Orta kalınlıkta denim kumaştır; günlük kullanımda yazın da giyilebilir.',
    questionIds: ['ty-1081939820-1', 'ty-1081939820-2'],
  },
  {
    id: 'ty-shipping',
    provider: 'trendyol',
    answer:
      'Trendyol Express, MNG, Aras veya PTT Kargo ile gönderilebilir; kargo sipariş sonrası belirlenir.',
    questionIds: ['ty-823811179-1', 'ty-823811179-6'],
  },
  {
    id: 'ty-winter',
    provider: 'trendyol',
    answer:
      'Sıcak tutan kışlık bir pantolondur; sıcak yaz günlerine uygun değildir.',
    questionIds: ['ty-1014324580-2', 'ty-1014324580-3'],
  },
  {
    id: 'hb-two-piece',
    provider: 'hepsiburada',
    answer: 'Ürün alt ve üstten oluşan 2 parçalı takımdır.',
    questionIds: ['hb-hbcv00008j0e0v-4', 'hb-hbcv00008j0e0v-8'],
  },
  {
    id: 'hb-inseam',
    provider: 'hepsiburada',
    answer: "Alt eşofmanın iç bacak boyu 68 cm'dir.",
    questionIds: ['hb-hbcv00008j0e0v-3', 'hb-hbcv00008j0e0v-10'],
  },
  {
    id: 'hb-knit',
    provider: 'hepsiburada',
    answer: 'Kumaş 3 ipliktir.',
    questionIds: ['hb-hbcv00008j0e0v-12', 'hb-hbcv00008j0e0v-15'],
  },
] as const;

function toSeeds(
  targetProvider: DefactoQuestionSeed['targetProvider'],
  rows: QuestionRow[],
  products: MockProductSeed[],
): DefactoQuestionSeed[] {
  const sourceUrls = new Map(
    products.map((product) => [
      String(product.source?.productId),
      product.source?.url,
    ]),
  );

  return rows.map(
    ([id, externalProductId, text, sourceAskedAt, learningPair]) => {
      const sourceUrl = sourceUrls.get(String(externalProductId));
      if (!sourceUrl) {
        throw new Error(`Mock question ${id} has no matching source product.`);
      }
      return {
        id,
        targetProvider,
        externalProductId,
        text,
        sourceUrl,
        sourceAskedAt: sourceAskedAt ?? undefined,
        learningPair,
      };
    },
  );
}

export const DEFACTO_QUESTION_SEEDS: DefactoQuestionSeed[] = [
  ...toSeeds('trendyol', trendyolRows, TRENDYOL_DEFACTO_PRODUCT_SEEDS),
  ...toSeeds('hepsiburada', hepsiburadaRows, [
    ...HEPSIBURADA_DEFACTO_PRODUCT_SEEDS,
    ...HEPSIBURADA_QUESTION_PRODUCT_SEEDS,
  ]),
];
