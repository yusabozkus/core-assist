import { escapeEmailHtml, renderEmailLayout } from './email-layout';

export type AiEmailEvent =
  | { kind: 'REVIEW_DIGEST'; pendingCount: number; newCount: number }
  | { kind: 'USAGE'; used: number; limit: number; remaining: number }
  | {
      kind: 'OPERATION_FAILURE';
      process: 'draft' | 'answer';
      phase: 'initial' | 'summary';
      affectedCount: number;
    }
  | { kind: 'OPERATION_RECOVERED'; process: 'draft' | 'answer' }
  | { kind: 'AUTOMATION_PAUSED'; reason: 'quota' | 'subscription' };

const number = new Intl.NumberFormat('tr-TR');

function card(content: string, warning = false) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 27px;background:${warning ? '#faf8f5' : '#f6f8f6'};border:1px solid ${warning ? '#ebe6de' : '#e7ece8'};border-radius:9px"><tr><td style="padding:18px 20px">${content}</td></tr></table>`;
}

function metric(label: string, value: string) {
  return `<p style="margin:0 0 7px;color:#647168;font-size:12px;line-height:1.4">${escapeEmailHtml(label)}</p><p style="margin:0;color:#203d2f;font-size:27px;line-height:1.1;font-weight:700">${escapeEmailHtml(value)}</p>`;
}

export function renderAiEmail(input: {
  recipientName: string;
  title: string;
  message: string;
  actionUrl: string;
  preferencesUrl?: string;
  event: AiEmailEvent;
}) {
  const event = input.event;
  let category: string;
  let actionLabel: string;
  let detailsHtml: string;

  switch (event.kind) {
    case 'REVIEW_DIGEST':
      category = 'Yanıt incelemesi';
      actionLabel = 'Soruları incele';
      detailsHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 27px;background:#f6f8f6;border:1px solid #e7ece8;border-radius:9px"><tr><td width="50%" style="padding:18px 20px;border-right:1px solid #e5ebe6;vertical-align:top">${metric('İnceleme bekleyen', number.format(event.pendingCount))}</td><td width="50%" style="padding:18px 20px;vertical-align:top">${metric('Yeni soru', number.format(event.newCount))}</td></tr></table>`;
      break;
    case 'USAGE': {
      const percentage =
        event.limit > 0
          ? Math.min(
              100,
              Math.max(0, Math.round((event.used / event.limit) * 100)),
            )
          : 0;
      const exhausted = event.remaining <= 0;
      category = 'Kullanım bildirimi';
      actionLabel = exhausted
        ? 'Plan seçeneklerini incele'
        : 'Kullanımı görüntüle';
      detailsHtml = card(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="color:#6c6b61;font-size:12px;line-height:1.5">Bu dönemki kullanım</td><td align="right" style="color:#343b34;font-size:15px;line-height:1.5;font-weight:700">${number.format(event.used)} / ${number.format(event.limit)}</td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:13px 0 10px;background:#eae7de;border-radius:5px"><tr><td width="${percentage}%" height="7" style="height:7px;background:${exhausted ? '#aa7155' : '#aa8549'};border-radius:5px;font-size:1px;line-height:1px">&nbsp;</td><td style="font-size:1px;line-height:1px">&nbsp;</td></tr></table><p style="margin:0;color:#6d6a60;font-size:12px;line-height:1.5">${exhausted ? 'Soru hakkınızın tamamı kullanıldı. Mevcut soruları manuel yanıtlayabilirsiniz.' : `${number.format(event.remaining)} soru hakkınız kaldı.`}</p>`,
        true,
      );
      break;
    }
    case 'OPERATION_FAILURE': {
      const process =
        event.process === 'draft' ? 'AI taslakları' : 'Cevap gönderimi';
      category = process;
      actionLabel = 'Soruları kontrol et';
      detailsHtml = card(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="vertical-align:middle">${metric(event.phase === 'summary' ? 'Son bildirimden beri etkilenen soru' : 'Etkilenen soru', number.format(event.affectedCount))}</td><td align="right" style="color:#827467;font-size:12px;line-height:1.4">İşlem tamamlanamadı</td></tr></table>`,
        true,
      );
      break;
    }
    case 'OPERATION_RECOVERED':
      category =
        event.process === 'draft' ? 'AI taslakları' : 'Cevap gönderimi';
      actionLabel = 'Gelen kutusuna git';
      detailsHtml = card(
        `<p style="margin:0 0 5px;color:#66756a;font-size:12px;line-height:1.4">Güncel durum</p><p style="margin:0;color:#264d37;font-size:15px;line-height:1.4;font-weight:700">${escapeEmailHtml(category)} yeniden çalışıyor</p>`,
      );
      break;
    case 'AUTOMATION_PAUSED':
      category = 'Otomasyon durumu';
      actionLabel =
        event.reason === 'quota'
          ? 'Plan ve kullanımı incele'
          : 'Ödeme durumunu incele';
      detailsHtml = card(
        `<p style="margin:0 0 5px;color:#756c60;font-size:12px;line-height:1.4">AI otomasyonu duraklatıldı</p><p style="margin:0;color:#423b32;font-size:15px;line-height:1.4;font-weight:700">${event.reason === 'quota' ? 'AI soru hakkı doldu' : 'Abonelik erişimi aktif değil'}</p>`,
        true,
      );
      break;
  }

  return {
    subject: input.title,
    html: renderEmailLayout({
      category,
      eyebrow: category,
      preheader: input.message,
      title: input.title,
      recipientName: input.recipientName,
      message: input.message,
      detailsHtml,
      actionUrl: input.actionUrl,
      actionLabel,
      footer: input.preferencesUrl
        ? 'Bu e-posta Core Asistan tarafından otomatik olarak gönderilmiştir.'
        : 'Bu kritik kota bildirimi, e-posta tercihinizden bağımsız olarak hesap yöneticilerine gönderilir.',
      preferencesUrl: input.preferencesUrl,
    }),
  };
}
