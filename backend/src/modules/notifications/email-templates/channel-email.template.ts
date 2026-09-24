import {
  SyncEmailDeliveryPhase,
  SyncEmailIncidentKind,
} from '../../../generated/prisma/enums';
import { escapeEmailHtml, renderEmailLayout } from './email-layout';

export type ChannelEmailEvent = {
  providerKey: string;
  storeName: string;
  kind: SyncEmailIncidentKind;
  phase: SyncEmailDeliveryPhase;
};

const providers: Record<string, { name: string; logo: string }> = {
  trendyol: {
    name: 'Trendyol',
    logo: 'https://coreasistan.com/merchants/trendyol.webp',
  },
  hepsiburada: {
    name: 'Hepsiburada',
    logo: 'https://coreasistan.com/merchants/hepsiburada.webp',
  },
};

function operationFor(kind: SyncEmailIncidentKind) {
  if (kind === SyncEmailIncidentKind.FULL)
    return {
      name: 'Ürün senkronizasyonu',
      impact: 'Katalogdaki yeni ürün ve değişiklikler gecikebilir.',
    };
  if (kind === SyncEmailIncidentKind.INVENTORY)
    return {
      name: 'Stok senkronizasyonu',
      impact: 'Stok bilgileri güncel olmayabilir.',
    };
  if (kind === SyncEmailIncidentKind.QUESTION)
    return {
      name: 'Soru senkronizasyonu',
      impact: 'Yeni müşteri soruları geç görünebilir.',
    };
  return null;
}

export function renderChannelEmail(input: {
  recipientName: string;
  title: string;
  message: string;
  actionUrl: string;
  preferencesUrl: string;
  event: ChannelEmailEvent;
}) {
  const { event } = input;
  const isConnection = event.kind === SyncEmailIncidentKind.AUTH;
  const recovered = event.phase === SyncEmailDeliveryPhase.RESOLVED;
  const provider = providers[event.providerKey];
  const providerName = provider?.name ?? event.providerKey;
  const operation = operationFor(event.kind);
  const operationName = operation?.name ?? 'Senkronizasyon';
  const operationImpact = operation?.impact ?? 'Güncel veriler gecikebilir.';
  const statusLabel = recovered
    ? isConnection
      ? 'Bağlı'
      : 'Tamamlandı'
    : isConnection
      ? 'Bağlantı kesildi'
      : 'Sorun var';
  const statusColor = recovered ? '#315f45' : '#996840';
  const statusBackground = recovered ? '#eaf3ec' : '#fbf0e7';
  const heading = isConnection
    ? recovered
      ? 'Kanal bağlantısı yeniden sağlandı'
      : 'Kanal bağlantısı kesildi'
    : `${operationName} ${recovered ? 'yeniden çalışıyor' : 'sorunlu'}`;
  const logo = provider
    ? `<img src="${provider.logo}" width="44" height="44" alt="${escapeEmailHtml(providerName)} logosu" style="display:block;width:44px;height:44px;border:0;border-radius:8px">`
    : `<span style="display:block;width:44px;height:44px;border-radius:8px;background:#eef2ef;color:#486252;text-align:center;line-height:44px;font-size:12px;font-weight:700">${escapeEmailHtml(providerName.slice(0, 2).toLocaleUpperCase('tr-TR'))}</span>`;
  const providerCard = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 16px;background:#fff;border:1px solid #e6ebe7;border-radius:9px"><tr><td width="62" style="padding:12px 0 12px 13px;vertical-align:middle">${logo}</td><td style="padding:12px 6px 12px 8px;vertical-align:middle"><p style="margin:0 0 3px;color:#28382d;font-size:13px;font-weight:700;line-height:1.4">${escapeEmailHtml(providerName)}</p><p style="margin:0;color:#78857b;font-size:11px;line-height:1.4">${escapeEmailHtml(event.storeName)} mağazası</p></td><td align="right" style="padding:12px 13px 12px 0;vertical-align:middle;white-space:nowrap"><span style="display:inline-block;padding:6px 8px;background:${statusBackground};border-radius:5px;color:${statusColor};font-size:11px;font-weight:700">${statusLabel}</span></td></tr></table>`;
  const details = isConnection
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 26px;background:${recovered ? '#f5f8f5' : '#faf7f3'};border:1px solid ${recovered ? '#e3eae4' : '#eee7df'};border-radius:8px"><tr><td style="padding:17px 19px"><p style="margin:0 0 7px;color:${statusColor};font-size:12px;font-weight:700;line-height:1.4">${recovered ? 'Bağlantı yeniden doğrulandı' : 'Etkilenebilecek işlemler'}</p><p style="margin:0;color:#536057;font-size:13px;line-height:1.6">${recovered ? 'Daha önce geciken işlemleri senkronizasyon geçmişinden kontrol edebilirsiniz.' : 'Ürün ve soru senkronizasyonu · Cevap gönderimi'}</p></td></tr></table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 12px;background:#f7f9f7;border:1px solid #e6ebe7;border-radius:8px"><tr><td style="padding:16px 19px;color:#718077;font-size:12px;line-height:1.5">İşlem<br><strong style="color:#27392d;font-size:14px;line-height:1.5">${escapeEmailHtml(operationName)}</strong></td><td align="right" style="padding:16px 19px;color:#718077;font-size:12px;line-height:1.5">Son durum<br><strong style="color:${statusColor};font-size:14px;line-height:1.5">${statusLabel}</strong></td></tr></table><p style="margin:0 0 26px;color:#68766c;font-size:12px;line-height:1.6">${recovered ? 'Son işlem başarılı. Önceki kayıtları geçmişten ayrıca kontrol edebilirsiniz.' : escapeEmailHtml(operationImpact)}</p>`;

  return {
    subject: input.title,
    html: renderEmailLayout({
      category: isConnection ? 'Kanal bağlantısı' : 'Kanal senkronizasyonu',
      eyebrow: recovered ? 'Sorun çözüldü' : 'İşlem gerekiyor',
      preheader: input.message,
      title: heading,
      recipientName: input.recipientName,
      message: input.message,
      detailsHtml: `${providerCard}${details}`,
      actionUrl: input.actionUrl,
      actionLabel: isConnection
        ? 'Kanal bağlantısını görüntüle'
        : 'Senkronizasyon geçmişini aç',
      footer:
        'Bu e-posta Core Asistan tarafından otomatik olarak gönderilmiştir.',
      preferencesUrl: input.preferencesUrl,
    }),
  };
}
