import { escapeEmailHtml, renderEmailLayout } from './email-layout';

export type StockEmailProduct = {
  name: string;
  variant: string;
  stock: number;
  imageUrl: string | null;
};

export type StockEmailEvent = {
  kind: 'LOW_STOCK' | 'OUT_OF_STOCK';
  currentCount: number;
  newCount: number;
  products: StockEmailProduct[];
};

const number = new Intl.NumberFormat('tr-TR');

function safeImageUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function renderStockEmail(input: {
  recipientName: string;
  title: string;
  message: string;
  actionUrl: string;
  preferencesUrl: string;
  event: StockEmailEvent;
}) {
  const depleted = input.event.kind === 'OUT_OF_STOCK';
  const statusColor = depleted ? '#934b43' : '#8c682a';
  const statusBackground = depleted ? '#faecea' : '#fbf3e5';
  const products = input.event.products.slice(0, 3);
  const remainingCount = Math.max(0, input.event.newCount - products.length);
  const productRows = products
    .map((product) => {
      const imageUrl = safeImageUrl(product.imageUrl);
      const imageCell = imageUrl
        ? `<td width="58" style="padding:11px 0 11px 12px;vertical-align:middle"><img src="${escapeEmailHtml(imageUrl)}" width="42" height="42" alt="" style="display:block;width:42px;height:42px;border:0;border-radius:7px;object-fit:cover"></td>`
        : '';
      const variant = product.variant
        ? `<p style="margin:3px 0 0;color:#7a867c;font-size:11px;line-height:1.4;word-break:break-word">${escapeEmailHtml(product.variant.slice(0, 100))}</p>`
        : '';
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 9px;background:#ffffff;border:1px solid #e6ebe7;border-radius:9px"><tr>${imageCell}<td style="padding:11px 8px 11px ${imageUrl ? '10px' : '16px'};vertical-align:middle"><p style="margin:0;color:#28382d;font-size:13px;font-weight:700;line-height:1.4;word-break:break-word">${escapeEmailHtml(product.name.slice(0, 140))}</p>${variant}</td><td width="84" align="right" style="padding:11px 12px 11px 0;vertical-align:middle;white-space:nowrap"><span style="display:inline-block;padding:6px 8px;background:${statusBackground};border-radius:5px;color:${statusColor};font-size:11px;font-weight:700">${depleted ? 'Tükendi' : `${number.format(product.stock)} adet`}</span></td></tr></table>`;
    })
    .join('');
  const summary = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;border-top:1px solid #e8ece9;border-bottom:1px solid #e8ece9"><tr><td style="padding:12px 0;color:#67746b;font-size:12px">Yeni uyarı: <strong style="color:#26382c">${number.format(input.event.newCount)} varyant</strong></td><td align="right" style="padding:12px 0;color:#67746b;font-size:12px">${depleted ? 'Toplam tükenen' : 'Toplam düşük stoklu'}: <strong style="color:#26382c">${number.format(input.event.currentCount)}</strong></td></tr></table>`;
  const more = remainingCount
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 18px;background:#f7f9f7;border:1px dashed #dce5de;border-radius:8px"><tr><td style="padding:12px 16px;color:#536258;font-size:12px;line-height:1.5;text-align:center"><strong style="color:#284f38">+${number.format(remainingCount)} varyant daha</strong> stok takibinde sizi bekliyor.</td></tr></table>`
    : '';

  return {
    subject: input.title,
    html: renderEmailLayout({
      category: 'Stok takibi',
      eyebrow: depleted ? 'Tükenen stok' : 'Kritik stok',
      preheader: input.message,
      title: input.title,
      recipientName: input.recipientName,
      message: input.message,
      detailsHtml: `${summary}${productRows}${more}`,
      actionUrl: input.actionUrl,
      actionLabel: 'Stokları incele',
      footer:
        'Bu e-posta Core Asistan tarafından otomatik olarak gönderilmiştir.',
      preferencesUrl: input.preferencesUrl,
    }),
  };
}
