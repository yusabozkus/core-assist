import { Injectable } from '@nestjs/common';
import type { ConnectorContext } from './catalog-connector';
import type {
  ProductQuestionAnswerResult,
  ProductQuestionBatch,
} from './question-connector';

export const MOCK_QUESTIONS_PER_PROVIDER = 20;
export const MOCK_HISTORICAL_QUESTIONS_PER_PROVIDER = 1;

type MockQuestionSeed = {
  productId: number;
  customerName: string;
  text: string;
};

@Injectable()
export class MockQuestionConnector {
  fetchProductQuestions(
    providerKey: string,
    context: ConnectorContext,
    options: { cursor?: string; createdAfter: Date },
  ): Promise<ProductQuestionBatch> {
    void context;

    if (options.cursor) {
      return Promise.resolve({ questions: [] });
    }

    return Promise.resolve({
      questions: createMockQuestions(providerKey, options.createdAfter),
    });
  }

  sendProductQuestionAnswer(
    providerKey: string,
    context: ConnectorContext,
    externalQuestionId: string,
    answer: string,
  ): Promise<ProductQuestionAnswerResult> {
    void context;
    void answer;

    return Promise.resolve({
      externalAnswerId: `${providerKey}-answer-${externalQuestionId}`,
      answeredAt: new Date(),
    });
  }
}

function createMockQuestions(
  providerKey: string,
  createdAfter: Date,
): ProductQuestionBatch['questions'] {
  const isHepsiburada = providerKey === 'hepsiburada';
  const seeds = isHepsiburada
    ? HEPSIBURADA_QUESTION_SEEDS
    : TRENDYOL_QUESTION_SEEDS;
  const questionPrefix = isHepsiburada ? 'hb-question' : 'ty-question';
  const productPrefix = isHepsiburada ? 'hb-listing' : 'ty-content';
  const customerPrefix = isHepsiburada ? 'hb-customer' : 'ty-customer';
  const questionStart = isHepsiburada ? 7001 : 5001;

  const currentQuestions = seeds.map((seed, index) => ({
    externalId: `${questionPrefix}-${questionStart + index}`,
    externalProductId: `${productPrefix}-${seed.productId}`,
    externalCustomerId: `${customerPrefix}-${100 + index}`,
    customerName: seed.customerName,
    text: seed.text,
    createdAt: afterConnection(createdAfter, index + 1),
    rawPayload: { fixture: true, provider: providerKey },
  }));

  return [
    ...currentQuestions,
    {
      externalId: `${questionPrefix}-historical`,
      externalProductId: `${productPrefix}-${seeds[0].productId}`,
      text: 'Bu soru bağlantı kurulmadan önce gönderildi.',
      createdAt: new Date(createdAfter.getTime() - 60 * 60_000),
      rawPayload: {
        fixture: true,
        historical: true,
        provider: providerKey,
      },
    },
  ];
}

const TRENDYOL_QUESTION_SEEDS: MockQuestionSeed[] = [
  {
    productId: 1001,
    customerName: 'Ayşe Y.',
    text: 'Siyah M beden tekrar stoğa gelecek mi?',
  },
  {
    productId: 1002,
    customerName: 'Mehmet A.',
    text: 'Mavi L beden mevcut mu, kalıbı nasıldır?',
  },
  {
    productId: 1003,
    customerName: 'Elif K.',
    text: 'Jean esnek mi, kendi bedenimi almam uygun olur mu?',
  },
  {
    productId: 1004,
    customerName: 'Can B.',
    text: 'Sweatshirt içi polarlı mı ve kışın sıcak tutar mı?',
  },
  {
    productId: 1005,
    customerName: 'Selin D.',
    text: 'Çantanın askısı çıkarılabiliyor mu?',
  },
  {
    productId: 1006,
    customerName: 'Zeynep T.',
    text: 'Elbisenin içi gösteriyor mu, astarı var mı?',
  },
  {
    productId: 1007,
    customerName: 'Buse E.',
    text: 'Hırka yıkamada çekme yapar mı?',
  },
  {
    productId: 1008,
    customerName: 'İrem S.',
    text: 'Pantolonun 38 bedeni siyah renkte stokta mı?',
  },
  {
    productId: 1009,
    customerName: 'Mert Ç.',
    text: 'Mont tamamen su geçirmez mi yoksa sadece su itici mi?',
  },
  {
    productId: 1010,
    customerName: 'Derya N.',
    text: 'Eteğin beli lastikli mi ve ölçüsü nedir?',
  },
  {
    productId: 1011,
    customerName: 'Oğuz H.',
    text: 'Polo tişört slim fit olduğu için bir beden büyük mü almalıyım?',
  },
  {
    productId: 1012,
    customerName: 'Tolga R.',
    text: 'Kemer hakiki deri mi, tokasında kararma olur mu?',
  },
  {
    productId: 1001,
    customerName: 'Gizem P.',
    text: 'Ekru rengin L bedeni ne zaman kargoya verilir?',
  },
  {
    productId: 1002,
    customerName: 'Emre V.',
    text: 'Gömleğin keten oranı nedir ve kolay kırışır mı?',
  },
  {
    productId: 1003,
    customerName: 'Nazlı U.',
    text: 'Füme 30 beden için paça boyu kaç santim?',
  },
  {
    productId: 1006,
    customerName: 'Ceren G.',
    text: 'Elbisenin kemeri ürüne dahil mi?',
  },
  {
    productId: 1008,
    customerName: 'Burcu L.',
    text: 'Vizon renk fotoğraftaki gibi açık tonda mı?',
  },
  {
    productId: 1009,
    customerName: 'Kaan F.',
    text: 'Montun kapüşonu çıkarılabiliyor mu?',
  },
  {
    productId: 1010,
    customerName: 'Pelin M.',
    text: 'Şampanya renginde iç gösterme yapar mı?',
  },
  {
    productId: 1012,
    customerName: 'Serkan İ.',
    text: '100 cm kemer hangi bel ölçülerine uygundur?',
  },
];

const HEPSIBURADA_QUESTION_SEEDS: MockQuestionSeed[] = [
  {
    productId: 2001,
    customerName: 'Deniz K.',
    text: 'Siyah rengin 42 numarası şu anda stokta mı?',
  },
  {
    productId: 2002,
    customerName: 'Burak T.',
    text: 'Çantanın hacmi kaç litre ve suya dayanıklı mı?',
  },
  {
    productId: 2003,
    customerName: 'Ece A.',
    text: 'Koşu ayakkabısı düz taban için uygun mu?',
  },
  {
    productId: 2004,
    customerName: 'Arda C.',
    text: 'MacBook Pro 16 inç bu çantaya sığar mı?',
  },
  {
    productId: 2005,
    customerName: 'Yusuf E.',
    text: 'Bot karda kullanım için uygun mu ve sıcak tutar mı?',
  },
  {
    productId: 2006,
    customerName: 'Seda B.',
    text: 'Cüzdanda kaç kart bölmesi bulunuyor?',
  },
  {
    productId: 2007,
    customerName: 'Aslı D.',
    text: 'Sandaletin tabanı gerçekten ortopedik mi?',
  },
  {
    productId: 2008,
    customerName: 'Barış M.',
    text: 'Spor çantası uçakta kabin bagajı olarak kabul edilir mi?',
  },
  {
    productId: 2009,
    customerName: 'Kerem O.',
    text: 'Loafer dar kalıp mı, taraklı ayak için uygun olur mu?',
  },
  {
    productId: 2010,
    customerName: 'Nihan P.',
    text: 'Valizin tekerlekleri 360 derece dönebiliyor mu?',
  },
  {
    productId: 2011,
    customerName: 'Melis Ş.',
    text: 'Terliğin 38/39 numarası pudra renkte mevcut mu?',
  },
  {
    productId: 2012,
    customerName: 'Onur G.',
    text: 'Bel çantasının telefon bölmesi büyük ekranlı telefona uygun mu?',
  },
  {
    productId: 2001,
    customerName: 'Hakan V.',
    text: 'Beyaz sneaker kolay temizleniyor mu?',
  },
  {
    productId: 2002,
    customerName: 'Damla R.',
    text: 'Sırt çantasında laptop bölmesi bulunuyor mu?',
  },
  {
    productId: 2003,
    customerName: 'Umut İ.',
    text: 'Ayakkabının 41 numarası gri renkte ne zaman stoklanır?',
  },
  {
    productId: 2005,
    customerName: 'Gökhan S.',
    text: 'Botun tabanı ıslak zeminde kayar mı?',
  },
  {
    productId: 2006,
    customerName: 'Leyla Ç.',
    text: 'RFID koruması tüm kart bölmelerinde çalışıyor mu?',
  },
  {
    productId: 2008,
    customerName: 'Sinan Y.',
    text: 'Çantanın ayakkabı bölmesi ayrı fermuarlı mı?',
  },
  {
    productId: 2010,
    customerName: 'Esra F.',
    text: 'Valizin boş ağırlığı kaç kilogram?',
  },
  {
    productId: 2012,
    customerName: 'Ali N.',
    text: 'Turuncu rengin görseldeki tonu neon mu?',
  },
];

function afterConnection(date: Date, offsetMs: number) {
  return new Date(Math.max(Date.now() - 5 * 60_000, date.getTime() + offsetMs));
}
