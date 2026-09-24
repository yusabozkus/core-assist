import { escapeEmailHtml, renderEmailLayout } from './email-layout';

export type ProductCapacityEmailEvent = {
  planName: string;
  used: number;
  limit: number;
  skippedCount: number | null;
};

const number = new Intl.NumberFormat('tr-TR');

export function renderProductCapacityEmail(input: {
  recipientName: string;
  title: string;
  message: string;
  actionUrl: string;
  preferencesUrl: string;
  event: ProductCapacityEmailEvent;
}) {
  const used = Math.max(0, input.event.used);
  const limit = Math.max(0, input.event.limit);
  const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const barPercentage = Math.min(100, percentage);
  const skippedCount = input.event.skippedCount;
  const skippedText =
    skippedCount === null
      ? 'Kapasite nedeniyle içe alınamıyor'
      : `${number.format(Math.max(0, skippedCount))} ürün alınamadı`;
  const details = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 19px;background:#faf9f5;border:1px solid #ebe7dd;border-radius:9px"><tr><td style="padding:18px 20px 17px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="color:#6c6b61;font-size:12px;line-height:1.5">${escapeEmailHtml(input.event.planName)} planı · Ürün kullanımı</td><td align="right" style="color:#343b34;font-size:15px;line-height:1.5;font-weight:700">${number.format(used)} / ${number.format(limit)}</td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:13px 0 10px;background:#eae7de;border-radius:5px"><tr><td width="${barPercentage}%" height="7" style="height:7px;background:#aa8549;border-radius:5px;font-size:1px;line-height:1px">&nbsp;</td></tr></table><p style="margin:0;color:#746e61;font-size:12px;line-height:1.5">Plan kapasitesinin %${number.format(percentage)}'ü kullanılıyor.</p></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 27px;border-top:1px solid #e9eeea;border-bottom:1px solid #e9eeea"><tr><td style="padding:12px 0;color:#68756b;font-size:12px">Mevcut ürünler</td><td align="right" style="padding:12px 0;color:#315f45;font-size:12px;font-weight:700">Güncellenmeye devam eder</td></tr><tr><td style="padding:12px 0;border-top:1px solid #edf1ed;color:#68756b;font-size:12px">Yeni ürünler</td><td align="right" style="padding:12px 0;border-top:1px solid #edf1ed;color:#8c682a;font-size:12px;font-weight:700">${escapeEmailHtml(skippedText)}</td></tr></table>`;

  return {
    subject: input.title,
    html: renderEmailLayout({
      category: 'Katalog kapasitesi',
      eyebrow: 'Plan limiti',
      preheader: input.message,
      title: 'Ürün kapasitesine ulaşıldı',
      recipientName: input.recipientName,
      message: input.message,
      detailsHtml: details,
      actionUrl: input.actionUrl,
      actionLabel: 'Plan ve kullanımı incele',
      footer:
        'Bu e-posta Core Asistan tarafından otomatik olarak gönderilmiştir.',
      preferencesUrl: input.preferencesUrl,
    }),
  };
}
