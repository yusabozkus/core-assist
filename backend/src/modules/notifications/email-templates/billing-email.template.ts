import { escapeEmailHtml, renderEmailLayout } from './email-layout';

export type BillingEmailEvent =
  | { kind: 'PAYMENT_FAILED'; plan: string; updatedAt: Date }
  | {
      kind: 'SUBSCRIPTION_ACTIVATED';
      plan: string;
      cycle: string;
      nextBilledAt: Date | null;
    }
  | {
      kind: 'PLAN_CHANGED';
      previousPlan: string;
      plan: string;
      cycle: string;
      nextBilledAt: Date | null;
    }
  | {
      kind: 'CANCELLATION_SCHEDULED';
      plan: string;
      accessEndsAt: Date | null;
    }
  | { kind: 'SUBSCRIPTION_ENDED'; plan: string; endedAt: Date | null }
  | { kind: 'REFUND_APPROVED'; amount: string };

function formatDate(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}

function summaryRows(rows: Array<[string, string | null]>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:${index ? '11px 0' : '0 0 11px'};border-top:${index ? '1px solid #e8ece8' : '0'};color:#68756b;font-size:12px;line-height:1.5">${escapeEmailHtml(label)}</td><td align="right" style="padding:${index ? '11px 0' : '0 0 11px'};border-top:${index ? '1px solid #e8ece8' : '0'};color:#263c2e;font-size:13px;font-weight:700;line-height:1.5">${escapeEmailHtml(value)}</td></tr>`,
    )
    .join('')}</table>`;
}

function detailCard(
  label: string,
  value: string,
  rows: Array<[string, string | null]>,
  warning = false,
) {
  const background = warning ? '#fbf8f4' : '#f6f9f6';
  const border = warning ? '#eee5d9' : '#e3ebe4';
  const accent = warning ? '#614833' : '#214f35';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 18px;background:${background};border:1px solid ${border};border-radius:9px"><tr><td style="padding:20px"><p style="margin:0 0 4px;color:#68756b;font-size:12px;line-height:1.5">${escapeEmailHtml(label)}</p><p style="margin:0 0 18px;color:${accent};font-size:23px;font-weight:700;line-height:1.3">${escapeEmailHtml(value)}</p>${summaryRows(rows)}</td></tr></table>`;
}

export function renderBillingEmail(input: {
  recipientName: string;
  title: string;
  message: string;
  actionUrl: string;
  event: BillingEmailEvent;
}) {
  const event = input.event;
  let category: string;
  let actionLabel: string;
  let detailsHtml: string;
  let note: string;

  switch (event.kind) {
    case 'PAYMENT_FAILED':
      category = 'Ödeme sorunu';
      actionLabel = 'Ödemeyi yönet';
      detailsHtml = detailCard(
        'Yenileme durumu',
        'Ödeme bekleniyor',
        [
          ['Plan', event.plan],
          ['Durum güncellendi', formatDate(event.updatedAt)],
        ],
        true,
      );
      note =
        'Ödeme tamamlanmadığı için bu işlem adına yeni bir fatura bulunmuyor.';
      break;
    case 'SUBSCRIPTION_ACTIVATED':
      category = 'Abonelik etkin';
      actionLabel = 'Faturaları görüntüle';
      detailsHtml = detailCard('Etkin plan', event.plan, [
        ['Faturalama', event.cycle],
        ['Sonraki yenileme', formatDate(event.nextBilledAt)],
      ]);
      note =
        'Faturanız hazır olduğunda Faturalar sayfasından PDF olarak indirebilirsiniz.';
      break;
    case 'PLAN_CHANGED':
      category = 'Plan güncellendi';
      actionLabel = 'Planımı görüntüle';
      detailsHtml = detailCard(
        'Plan geçişi',
        `${event.previousPlan} → ${event.plan}`,
        [
          ['Faturalama', event.cycle],
          ['Sonraki yenileme', formatDate(event.nextBilledAt)],
        ],
      );
      note =
        'Bu değişiklik için yeni bir ödeme alındıysa faturasını Faturalar sayfasında görebilirsiniz.';
      break;
    case 'CANCELLATION_SCHEDULED':
      category = 'İptal planlandı';
      actionLabel = 'Aboneliğimi görüntüle';
      detailsHtml = detailCard(
        'Erişimin sona ereceği tarih',
        formatDate(event.accessEndsAt) ?? 'Dönem sonunda',
        [
          ['Geçerli plan', event.plan],
          ['Yeni yenileme', 'Yapılmayacak'],
        ],
        true,
      );
      note = 'Bu tarihe kadar plan haklarınızı kullanabilirsiniz.';
      break;
    case 'SUBSCRIPTION_ENDED':
      category = 'Abonelik sona erdi';
      actionLabel = 'Planları incele';
      detailsHtml = detailCard(
        'Sona eren plan',
        event.plan,
        [
          ['Erişim bitişi', formatDate(event.endedAt)],
          ['Yeni yenileme', 'Yapılmayacak'],
          ['Kayıtlar ve manuel yanıtlar', 'Kullanılabilir'],
        ],
        true,
      );
      note = 'Önceki ödemelerinizin faturalarına hesabınızdan erişebilirsiniz.';
      break;
    case 'REFUND_APPROVED':
      category = 'İade onaylandı';
      actionLabel = 'Faturaları görüntüle';
      detailsHtml = detailCard('Onaylanan iade', event.amount, [
        ['Kartınıza yansıma', 'Bankanıza bağlı'],
      ]);
      note =
        'İlgili ödeme ve fatura kayıtlarını Faturalar sayfasından inceleyebilirsiniz.';
      break;
  }

  return {
    subject: input.title,
    html: renderEmailLayout({
      category,
      eyebrow: 'Plan ve faturalama',
      preheader: input.message,
      title: input.title,
      recipientName: input.recipientName,
      message: input.message,
      detailsHtml: `${detailsHtml}<p style="margin:0 0 22px;color:#69766c;font-size:12px;line-height:1.65">${escapeEmailHtml(note)}</p>`,
      actionUrl: input.actionUrl,
      actionLabel,
      footer:
        'Bu e-posta abonelik veya ödeme kaydınızla ilgili otomatik olarak gönderilmiştir.',
    }),
  };
}
